import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type {
  LibraryData,
  Program,
  CreateProgramData,
  UpdateProgramData,
  Settings,
  CreateSteamProgramData,
  Developer,
  LocalizedName,
  CreateDeveloperData,
  UpdateDeveloperData,
  Tag,
  CreateTagData,
  UpdateTagData,
  LocaleCode
} from '../../src/types'
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
  programs: [],
  developers: [],
  tags: []
}

const LOCALE_CODES: LocaleCode[] = ['ko', 'en', 'ja', 'zh-CN']

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  viewMode: 'grid',
  language: 'ko',
  gridCardSize: 'medium'
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

// Normalize a Developer's localized names. Every language is trimmed; empty
// optional languages are dropped. `ko` is mandatory — when missing/blank we fall
// back to the first non-empty localized value so the entry always has a name.
const normalizeNames = (raw: unknown): LocalizedName | null => {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Record<string, unknown>
  const out: Partial<Record<LocaleCode, string>> = {}
  for (const code of LOCALE_CODES) {
    const value = src[code]
    if (typeof value === 'string' && value.trim()) out[code] = value.trim()
  }
  const ko = out.ko ?? out.en ?? out.ja ?? out['zh-CN']
  if (!ko) return null
  return { ...out, ko }
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
    developerId: typeof p.developerId === 'string' && p.developerId ? p.developerId : null,
    publisherId: typeof p.publisherId === 'string' && p.publisherId ? p.publisherId : null,
    tags: normalizeTags(p.tags),
    keywords: normalizeTags(p.keywords),
    memo: normalizeMemo(p.memo),
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date().toISOString()
  }
}

// Validate/normalize a stored Developer entry. Drops entries with no usable name.
const migrateDeveloper = (raw: unknown): Developer | null => {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Partial<Developer>
  if (typeof d.id !== 'string' || !d.id) return null
  const names = normalizeNames(d.names)
  if (!names) return null
  return {
    id: d.id,
    names,
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : new Date().toISOString(),
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : new Date().toISOString()
  }
}

// Validate/normalize a stored Tag entry. Drops entries with no usable name.
const migrateTag = (raw: unknown): Tag | null => {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Partial<Tag>
  if (typeof t.id !== 'string' || !t.id) return null
  const names = normalizeNames(t.names)
  if (!names) return null
  return {
    id: t.id,
    names,
    keyword: normalizeMemo(t.keyword),
    createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
    updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : new Date().toISOString()
  }
}

// Recognized legacy tag prefixes (`code:name`) → locale, for one-time migration of
// pre-master-list tag strings. `jp`/`zh` are accepted aliases. Kept inline here so
// the main process doesn't depend on the renderer's tagLocale util.
const LEGACY_TAG_PREFIX_TO_LOCALE: Record<string, LocaleCode> = {
  ko: 'ko', en: 'en', ja: 'ja', jp: 'ja', zh: 'zh-CN', 'zh-cn': 'zh-CN'
}

// Turn a legacy raw tag string into a localized-name seed. `en:Fantasy` → the
// English name is set, with `ko` filled as the required fallback. A plain string
// (or unknown prefix) becomes the Korean name.
const legacyTagNames = (rawTag: string): LocalizedName => {
  const sep = rawTag.indexOf(':')
  if (sep > 0) {
    const code = rawTag.slice(0, sep).trim().toLowerCase()
    const locale = LEGACY_TAG_PREFIX_TO_LOCALE[code]
    const name = rawTag.slice(sep + 1).trim()
    if (locale && name) {
      return locale === 'ko' ? { ko: name } : { ko: name, [locale]: name }
    }
  }
  return { ko: rawTag.trim() }
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
  // gridCardSize was added later still — same tolerance.
  const validCardSize = v.gridCardSize === undefined ||
    v.gridCardSize === 'small' || v.gridCardSize === 'medium' || v.gridCardSize === 'large'
  return validTheme && validView && validLang && validCardSize
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
// Set when readLibraryFromDisk rewrote anything during migration (e.g. legacy
// inline `developer` strings → Developer entities). getLibrary schedules a save
// so the normalized form is persisted even if the user makes no other change.
let migrationDirty = false
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
      // Developer master list — validate stored entries first.
      const rawDevelopers = Array.isArray((parsed as { developers?: unknown }).developers)
        ? (parsed as { developers: unknown[] }).developers
        : []
      const developers = rawDevelopers
        .map(migrateDeveloper)
        .filter((d): d is Developer => d !== null)

      // Migrate legacy inline `developer` strings (pre-master-list format) into
      // Developer entities, deduped by Korean name. Mutates the raw program so
      // migrateProgram picks up the assigned developerId.
      const devByKoName = new Map<string, Developer>()
      for (const dev of developers) devByKoName.set(dev.names.ko.toLowerCase(), dev)
      const now = new Date().toISOString()
      for (const raw of parsed.programs) {
        if (!raw || typeof raw !== 'object') continue
        const rp = raw as { developer?: unknown; developerId?: unknown }
        const legacy = typeof rp.developer === 'string' ? rp.developer.trim() : ''
        const hasId = typeof rp.developerId === 'string' && rp.developerId
        if (!legacy || hasId) continue
        const key = legacy.toLowerCase()
        let dev = devByKoName.get(key)
        if (!dev) {
          dev = { id: uuidv4(), names: { ko: legacy }, createdAt: now, updatedAt: now }
          devByKoName.set(key, dev)
          developers.push(dev)
        }
        rp.developerId = dev.id
        migrationDirty = true
      }

      // Tag master list — validate stored entries first.
      const rawTags = Array.isArray((parsed as { tags?: unknown }).tags)
        ? (parsed as { tags: unknown[] }).tags
        : []
      const tags = rawTags
        .map(migrateTag)
        .filter((t): t is Tag => t !== null)

      // Migrate legacy inline tag strings into Tag entities. Each program's
      // `tags` was an array of raw strings (possibly with a `code:name` prefix);
      // convert each to a tag id, deduping identical strings across programs.
      // Entries already equal to a known tag id (data saved post-migration) pass
      // through untouched.
      const tagIdSet = new Set(tags.map(t => t.id))
      const tagByLegacyKey = new Map<string, Tag>()
      for (const raw of parsed.programs) {
        if (!raw || typeof raw !== 'object') continue
        const rp = raw as { tags?: unknown }
        if (!Array.isArray(rp.tags)) continue
        const ids: string[] = []
        for (const entry of rp.tags) {
          if (typeof entry !== 'string') continue
          const value = entry.trim()
          if (!value) continue
          if (tagIdSet.has(value)) { ids.push(value); continue } // already an id
          const key = value.toLowerCase()
          let tag = tagByLegacyKey.get(key)
          if (!tag) {
            tag = { id: uuidv4(), names: legacyTagNames(value), keyword: '', createdAt: now, updatedAt: now }
            tagByLegacyKey.set(key, tag)
            tags.push(tag)
            tagIdSet.add(tag.id)
            migrationDirty = true
          }
          ids.push(tag.id)
        }
        rp.tags = ids
      }

      const programs = parsed.programs
        .map(migrateProgram)
        .filter((p): p is Program => p !== null)

      // Drop dangling references so a program never points at a deleted developer/tag.
      const devIds = new Set(developers.map(d => d.id))
      for (const program of programs) {
        if (program.developerId && !devIds.has(program.developerId)) {
          program.developerId = null
        }
        if (program.publisherId && !devIds.has(program.publisherId)) {
          program.publisherId = null
        }
        program.tags = program.tags.filter(id => tagIdSet.has(id))
      }

      const version = typeof (parsed as { version?: unknown }).version === 'string'
        ? (parsed as { version: string }).version
        : '1.0'
      logger.info(`Loaded library with ${programs.length} programs, ${developers.length} developers, ${tags.length} tags`)
      return { version, programs, developers, tags }
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
    // Persist the normalized form when load-time migration changed anything.
    if (migrationDirty) {
      migrationDirty = false
      scheduleSave()
    }
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
    developerId: typeof data.developerId === 'string' && data.developerId ? data.developerId : null,
    publisherId: typeof data.publisherId === 'string' && data.publisherId ? data.publisherId : null,
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
    developerId: null,
    publisherId: null,
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
    developerId: data.developerId !== undefined
      ? (typeof data.developerId === 'string' && data.developerId ? data.developerId : null)
      : program.developerId,
    publisherId: data.publisherId !== undefined
      ? (typeof data.publisherId === 'string' && data.publisherId ? data.publisherId : null)
      : program.publisherId,
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

// Developer (circle) master-list operations
export const addDeveloper = (data: CreateDeveloperData): Developer => {
  const names = normalizeNames(data.names)
  if (!names) {
    throw new Error('Developer requires at least one name')
  }
  const library = getLibrary()
  const now = new Date().toISOString()
  const developer: Developer = {
    id: uuidv4(),
    names,
    createdAt: now,
    updatedAt: now
  }
  library.developers.push(developer)
  scheduleSave()
  logger.info(`Added developer: ${developer.names.ko} (${developer.id})`)
  return developer
}

export const updateDeveloper = (data: UpdateDeveloperData): Developer => {
  const names = normalizeNames(data.names)
  if (!names) {
    throw new Error('Developer requires at least one name')
  }
  const library = getLibrary()
  const index = library.developers.findIndex(d => d.id === data.id)
  if (index === -1) {
    throw new Error(`Developer not found: ${data.id}`)
  }
  const updated: Developer = {
    ...library.developers[index],
    names,
    updatedAt: new Date().toISOString()
  }
  library.developers[index] = updated
  scheduleSave()
  logger.info(`Updated developer: ${updated.names.ko} (${updated.id})`)
  return updated
}

export const deleteDeveloper = (id: string): void => {
  const library = getLibrary()
  const index = library.developers.findIndex(d => d.id === id)
  if (index === -1) {
    throw new Error(`Developer not found: ${id}`)
  }
  library.developers.splice(index, 1)
  // Clear both role references on every program that pointed at the removed entry.
  for (const program of library.programs) {
    if (program.developerId === id || program.publisherId === id) {
      if (program.developerId === id) program.developerId = null
      if (program.publisherId === id) program.publisherId = null
      program.updatedAt = new Date().toISOString()
    }
  }
  scheduleSave()
  logger.info(`Deleted developer: ${id}`)
}

// Tag master-list operations
export const addTag = (data: CreateTagData): Tag => {
  const names = normalizeNames(data.names)
  if (!names) {
    throw new Error('Tag requires at least one name')
  }
  const library = getLibrary()
  const now = new Date().toISOString()
  const tag: Tag = {
    id: uuidv4(),
    names,
    keyword: normalizeMemo(data.keyword),
    createdAt: now,
    updatedAt: now
  }
  library.tags.push(tag)
  scheduleSave()
  logger.info(`Added tag: ${tag.names.ko} (${tag.id})`)
  return tag
}

export const updateTag = (data: UpdateTagData): Tag => {
  const names = normalizeNames(data.names)
  if (!names) {
    throw new Error('Tag requires at least one name')
  }
  const library = getLibrary()
  const index = library.tags.findIndex(t => t.id === data.id)
  if (index === -1) {
    throw new Error(`Tag not found: ${data.id}`)
  }
  const updated: Tag = {
    ...library.tags[index],
    names,
    keyword: normalizeMemo(data.keyword),
    updatedAt: new Date().toISOString()
  }
  library.tags[index] = updated
  scheduleSave()
  logger.info(`Updated tag: ${updated.names.ko} (${updated.id})`)
  return updated
}

export const deleteTag = (id: string): void => {
  const library = getLibrary()
  const index = library.tags.findIndex(t => t.id === id)
  if (index === -1) {
    throw new Error(`Tag not found: ${id}`)
  }
  library.tags.splice(index, 1)
  // Remove the tag id from every program that referenced it.
  for (const program of library.programs) {
    if (program.tags.includes(id)) {
      program.tags = program.tags.filter(t => t !== id)
      program.updatedAt = new Date().toISOString()
    }
  }
  scheduleSave()
  logger.info(`Deleted tag: ${id}`)
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
