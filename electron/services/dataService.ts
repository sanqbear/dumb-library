import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { LibraryData, Program, CreateProgramData, UpdateProgramData, Settings, CreateSteamProgramData } from '../../src/types'
import { isProviderId } from '../../src/types'
import { normalizeExecutablePathForStorage } from './executablePath'
import logger from './logger'

// Paths
const getUserDataPath = () => app.getPath('userData')
const getLibraryPath = () => path.join(getUserDataPath(), 'library.json')
const getSettingsPath = () => path.join(getUserDataPath(), 'settings.json')
const getIconsPath = () => path.join(getUserDataPath(), 'icons')
const getThumbnailsPath = () => path.join(getUserDataPath(), 'thumbnails')
const getPreviewsPath = () => path.join(getUserDataPath(), 'previews')

// Default data
const DEFAULT_LIBRARY_DATA: LibraryData = {
  version: '1.0',
  programs: []
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  viewMode: 'grid',
  language: 'ko'
}

// Ensure directories exist
const ensureDirectories = (): void => {
  const dirs = [getIconsPath(), getThumbnailsPath(), getPreviewsPath()]
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      logger.info(`Created directory: ${dir}`)
    }
  })
}

// Write to *.tmp then rename — survives crashes/power loss mid-write
const writeFileAtomic = (filePath: string, content: string): void => {
  const tempPath = `${filePath}.tmp`
  fs.writeFileSync(tempPath, content, 'utf-8')
  fs.renameSync(tempPath, filePath)
}

// Trim each entry, drop blanks (whitespace-only), and remove exact duplicates
// while preserving order. Used for both tags and keywords on
// create/update/migrate so no empty or untrimmed value is ever persisted.
const normalizeTags = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of tags) {
    if (typeof tag !== 'string') continue
    const trimmed = tag.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

// Coerce a memo value to a stored string. Non-strings become ''. Outer
// whitespace is trimmed while interior newlines (multi-line notes) are kept.
const normalizeMemo = (memo: unknown): string => {
  return typeof memo === 'string' ? memo.trim() : ''
}

// True only when child resolves to a location strictly inside parent
const isPathInside = (child: string, parent: string): boolean => {
  const rel = path.relative(path.resolve(parent), path.resolve(child))
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

const isValidLibrary = (value: unknown): value is { programs: unknown[] } => {
  if (!value || typeof value !== 'object') return false
  const v = value as { programs?: unknown }
  return Array.isArray(v.programs)
}

// Convert a stored image path to the new userData-relative form.
// - Already relative (no drive letter, not absolute) → normalize separators to /.
// - Absolute inside userData → strip prefix and normalize.
// - Absolute outside userData → drop (return null) so renderer doesn't show a broken ref.
const normalizeImagePath = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value) return null
  if (!path.isAbsolute(value)) return value.replace(/\\/g, '/')
  const userData = path.resolve(getUserDataPath())
  const resolved = path.resolve(value)
  const rel = path.relative(userData, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  return rel.replace(/\\/g, '/')
}

// Coerce legacy free-form `category` values to a valid ProviderId.
// Programs saved before the provider-based categorization have strings like
// "Games", null, etc. — those all get mapped to 'local'.
// Image paths are also normalized from absolute to userData-relative here.
const migrateProgram = (raw: unknown): Program | null => {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Partial<Program> & { category?: unknown }
  if (typeof p.id !== 'string' || typeof p.title !== 'string' || typeof p.executablePath !== 'string') {
    return null
  }
  return {
    id: p.id,
    title: p.title,
    executablePath: p.executablePath,
    iconPath: normalizeImagePath(p.iconPath),
    thumbnailPath: normalizeImagePath(p.thumbnailPath),
    previewImages: Array.isArray(p.previewImages)
      ? p.previewImages
          .map(normalizeImagePath)
          .filter((v): v is string => v !== null)
      : [],
    marketUrl: typeof p.marketUrl === 'string' && p.marketUrl.trim() ? p.marketUrl.trim() : null,
    category: isProviderId(p.category) ? p.category : 'local',
    tags: normalizeTags(p.tags),
    keywords: normalizeTags(p.keywords),
    memo: normalizeMemo(p.memo),
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date().toISOString()
  }
}

const isValidSettings = (value: unknown): value is Settings => {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<Settings>
  const validTheme = v.theme === 'dark' || v.theme === 'light'
  const validView = v.viewMode === 'grid' || v.viewMode === 'list'
  // language was added later — tolerate its absence and backfill on first save
  const validLang = v.language === undefined ||
    v.language === 'ko' || v.language === 'en' ||
    v.language === 'ja' || v.language === 'zh-CN'
  return validTheme && validView && validLang
}

// Library operations
//
// The library is held in an in-memory cache that is the single source of truth
// for this process (it is the only writer). Reads return the cache; mutations
// update the cache and enqueue a debounced disk write so a burst of changes
// (e.g. adding many Steam games, then patching each thumbnail path) collapses
// into one atomic write instead of one-per-change. flushLibrary() forces a
// synchronous write and MUST be called on app quit so nothing is lost — this
// matters especially for the portable build, whose data lives next to the exe
// and which is often closed abruptly.

let libraryCache: LibraryData | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingWrite = false
const SAVE_DEBOUNCE_MS = 600

// Read + migrate library.json from disk. Only used to seed the cache once.
const readLibraryFromDisk = (): LibraryData => {
  const libraryPath = getLibraryPath()

  try {
    if (fs.existsSync(libraryPath)) {
      const data = fs.readFileSync(libraryPath, 'utf-8')
      const parsed: unknown = JSON.parse(data)
      if (!isValidLibrary(parsed)) {
        logger.warn('library.json has invalid shape, falling back to defaults')
        return { ...DEFAULT_LIBRARY_DATA }
      }
      const programs = parsed.programs
        .map(migrateProgram)
        .filter((p): p is Program => p !== null)
      const version = typeof (parsed as { version?: unknown }).version === 'string'
        ? (parsed as { version: string }).version
        : '1.0'
      logger.info(`Loaded library with ${programs.length} programs`)
      return { version, programs }
    }
  } catch (error) {
    logger.error('Failed to load library:', error)
  }

  logger.info('Returning default library data')
  return { ...DEFAULT_LIBRARY_DATA }
}

// Cache accessor — seeds from disk on first use. Mutators operate on the
// returned object directly and must call scheduleSave() afterwards.
const getLibrary = (): LibraryData => {
  if (libraryCache === null) {
    libraryCache = readLibraryFromDisk()
  }
  return libraryCache
}

const writeLibraryToDisk = (data: LibraryData): void => {
  const libraryPath = getLibraryPath()
  ensureDirectories()
  writeFileAtomic(libraryPath, JSON.stringify(data, null, 2))
  logger.info(`Saved library with ${data.programs.length} programs`)
}

// Enqueue a debounced write. Coalesces rapid successive mutations.
const scheduleSave = (): void => {
  pendingWrite = true
  if (saveTimer !== null) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    flushLibrary()
  }, SAVE_DEBOUNCE_MS)
}

// Force any pending write to disk synchronously. Safe to call when nothing is
// pending. Invoked on app quit to guarantee durability.
export const flushLibrary = (): void => {
  if (saveTimer !== null) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (!pendingWrite || libraryCache === null) return
  try {
    writeLibraryToDisk(libraryCache)
    pendingWrite = false
  } catch (error) {
    logger.error('Failed to flush library:', error)
  }
}

export const loadLibrary = (): LibraryData => {
  return getLibrary()
}

// Replace the whole library (renderer-driven save). Updates the cache and
// writes through immediately since this is an explicit, infrequent operation.
export const saveLibrary = (data: LibraryData): void => {
  libraryCache = data
  try {
    writeLibraryToDisk(data)
    pendingWrite = false
  } catch (error) {
    logger.error('Failed to save library:', error)
    throw error
  }
}

// Program operations
export const addProgram = (data: CreateProgramData): Program => {
  const library = getLibrary()
  const now = new Date().toISOString()

  // Local-file adds always map to the 'local' provider.
  // Future integrations (steam, etc.) will call a separate entry point.
  const newProgram: Program = {
    id: uuidv4(),
    title: data.title.trim(),
    executablePath: normalizeExecutablePathForStorage(data.executablePath.trim()),
    iconPath: null,
    thumbnailPath: null,
    previewImages: [],
    marketUrl: data.marketUrl?.trim() || null,
    category: 'local',
    tags: normalizeTags(data.tags),
    keywords: normalizeTags(data.keywords),
    memo: normalizeMemo(data.memo),
    createdAt: now,
    updatedAt: now
  }

  library.programs.push(newProgram)
  scheduleSave()
  logger.info(`Added program: ${newProgram.title} (${newProgram.id})`)

  return newProgram
}

// Build a Steam program entry without touching the cache. Shared by the
// single-add and batch-add paths.
const buildSteamProgram = (data: CreateSteamProgramData): Program => {
  const now = new Date().toISOString()
  return {
    id: uuidv4(),
    title: data.name,
    executablePath: `steam://run/${data.appId}`,
    iconPath: null,
    thumbnailPath: null,
    previewImages: [],
    // Default to the Steam store page so the market button works out of the box.
    marketUrl: `https://store.steampowered.com/app/${data.appId}`,
    category: 'steam',
    tags: [],
    keywords: [],
    memo: '',
    createdAt: now,
    updatedAt: now
  }
}

// Steam entry: launch target is a steam:// URL, not an .exe path.
// No icon extraction — thumbnail is downloaded separately from Steam CDN.
export const addSteamProgram = (data: CreateSteamProgramData): Program => {
  const library = getLibrary()
  const newProgram = buildSteamProgram(data)

  library.programs.push(newProgram)
  scheduleSave()
  logger.info(`Added steam program: ${newProgram.title} (appId=${data.appId}, id=${newProgram.id})`)

  return newProgram
}

// Add many Steam programs in one shot. The library is read once and a single
// debounced write covers all entries (instead of read+write per entry).
export const addSteamProgramsBatch = (entries: CreateSteamProgramData[]): Program[] => {
  const library = getLibrary()
  const added: Program[] = []
  for (const entry of entries) {
    const newProgram = buildSteamProgram(entry)
    library.programs.push(newProgram)
    added.push(newProgram)
  }
  if (added.length > 0) scheduleSave()
  logger.info(`Batch-added ${added.length} steam programs`)
  return added
}

export const updateProgram = (data: UpdateProgramData): Program => {
  const library = getLibrary()
  const index = library.programs.findIndex(p => p.id === data.id)

  if (index === -1) {
    throw new Error(`Program not found: ${data.id}`)
  }

  const program = library.programs[index]
  const updatedProgram: Program = {
    ...program,
    title: data.title !== undefined ? data.title.trim() : program.title,
    executablePath: data.executablePath !== undefined
      ? normalizeExecutablePathForStorage(data.executablePath.trim())
      : program.executablePath,
    tags: data.tags !== undefined ? normalizeTags(data.tags) : program.tags,
    keywords: data.keywords !== undefined ? normalizeTags(data.keywords) : program.keywords,
    memo: data.memo !== undefined ? normalizeMemo(data.memo) : program.memo,
    marketUrl: data.marketUrl !== undefined
      ? (data.marketUrl.trim() || null)
      : program.marketUrl,
    updatedAt: new Date().toISOString()
  }

  library.programs[index] = updatedProgram
  scheduleSave()
  logger.info(`Updated program: ${updatedProgram.title} (${updatedProgram.id})`)

  return updatedProgram
}

export const deleteProgram = (id: string): void => {
  const library = getLibrary()
  const index = library.programs.findIndex(p => p.id === id)
  
  if (index === -1) {
    throw new Error(`Program not found: ${id}`)
  }
  
  const program = library.programs[index]

  // Resolve a userData-relative stored path to absolute, but only if it stays
  // inside the managed directory. Prevents a tampered library.json from
  // pointing at arbitrary filesystem locations.
  const resolveManaged = (relPath: string | null, managedDir: string): string | null => {
    if (!relPath) return null
    const abs = path.resolve(path.join(getUserDataPath(), relPath))
    return isPathInside(abs, managedDir) ? abs : null
  }

  const iconAbs = resolveManaged(program.iconPath, getIconsPath())
  if (iconAbs && fs.existsSync(iconAbs)) {
    try {
      fs.unlinkSync(iconAbs)
      logger.info(`Deleted icon: ${iconAbs}`)
    } catch (error) {
      logger.warn(`Failed to delete icon: ${iconAbs}`, error)
    }
  } else if (program.iconPath && !iconAbs) {
    logger.warn(`Skipped icon deletion (outside managed dir): ${program.iconPath}`)
  }

  const thumbAbs = resolveManaged(program.thumbnailPath, getThumbnailsPath())
  if (thumbAbs && fs.existsSync(thumbAbs)) {
    try {
      fs.unlinkSync(thumbAbs)
      logger.info(`Deleted thumbnail: ${thumbAbs}`)
    } catch (error) {
      logger.warn(`Failed to delete thumbnail: ${thumbAbs}`, error)
    }
  } else if (program.thumbnailPath && !thumbAbs) {
    logger.warn(`Skipped thumbnail deletion (outside managed dir): ${program.thumbnailPath}`)
  }

  // Preview images: delete every file the program references that still
  // resolves inside the managed previews directory.
  for (const previewRel of program.previewImages) {
    const previewAbs = resolveManaged(previewRel, getPreviewsPath())
    if (previewAbs && fs.existsSync(previewAbs)) {
      try {
        fs.unlinkSync(previewAbs)
        logger.info(`Deleted preview: ${previewAbs}`)
      } catch (error) {
        logger.warn(`Failed to delete preview: ${previewAbs}`, error)
      }
    } else if (previewRel && !previewAbs) {
      logger.warn(`Skipped preview deletion (outside managed dir): ${previewRel}`)
    }
  }

  library.programs.splice(index, 1)
  scheduleSave()
  logger.info(`Deleted program: ${program.title} (${id})`)
}

// Update program's icon path
export const updateProgramIconPath = (programId: string, iconPath: string | null): void => {
  const library = getLibrary()
  const program = library.programs.find(p => p.id === programId)

  if (program) {
    program.iconPath = iconPath
    program.updatedAt = new Date().toISOString()
    scheduleSave()
    logger.info(`Updated icon path for program: ${programId}`)
  }
}

// Update program's thumbnail path
export const updateProgramThumbnailPath = (programId: string, thumbnailPath: string | null): void => {
  const library = getLibrary()
  const program = library.programs.find(p => p.id === programId)

  if (program) {
    program.thumbnailPath = thumbnailPath
    program.updatedAt = new Date().toISOString()
    scheduleSave()
    logger.info(`Updated thumbnail path for program: ${programId}`)
  }
}

// Replace a program's full preview-image list (append/remove/reorder all go
// through here). Caller is responsible for the actual image files on disk.
export const updateProgramPreviewImages = (programId: string, previewImages: string[]): void => {
  const library = getLibrary()
  const program = library.programs.find(p => p.id === programId)

  if (program) {
    program.previewImages = previewImages
    program.updatedAt = new Date().toISOString()
    scheduleSave()
    logger.info(`Updated preview images for program: ${programId} (${previewImages.length})`)
  }
}

// Read a program's current preview-image list (used by previewService to
// append/remove without clobbering concurrent changes).
export const getProgramPreviewImages = (programId: string): string[] => {
  const library = getLibrary()
  const program = library.programs.find(p => p.id === programId)
  return program ? [...program.previewImages] : []
}

// Settings operations
export const loadSettings = (): Settings => {
  const settingsPath = getSettingsPath()

  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8')
      const parsed: unknown = JSON.parse(data)
      if (!isValidSettings(parsed)) {
        logger.warn('settings.json has invalid shape, falling back to defaults')
        return { ...DEFAULT_SETTINGS }
      }
      logger.info('Loaded settings')
      // Backfill language when loading a pre-i18n settings file.
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch (error) {
    logger.error('Failed to load settings:', error)
  }

  return { ...DEFAULT_SETTINGS }
}

export const saveSettings = (settings: Settings): void => {
  const settingsPath = getSettingsPath()

  try {
    ensureDirectories()
    writeFileAtomic(settingsPath, JSON.stringify(settings, null, 2))
    logger.info('Saved settings')
  } catch (error) {
    logger.error('Failed to save settings:', error)
    throw error
  }
}

// Export paths for other services
export { getIconsPath, getThumbnailsPath, getPreviewsPath, ensureDirectories }
