import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { LibraryData, Program, CreateProgramData, UpdateProgramData, Settings, CreateSteamProgramData } from '../../src/types'
import { isProviderId } from '../../src/types'
import logger from './logger'

// Paths
const getUserDataPath = () => app.getPath('userData')
const getLibraryPath = () => path.join(getUserDataPath(), 'library.json')
const getSettingsPath = () => path.join(getUserDataPath(), 'settings.json')
const getIconsPath = () => path.join(getUserDataPath(), 'icons')
const getThumbnailsPath = () => path.join(getUserDataPath(), 'thumbnails')

// Default data
const DEFAULT_LIBRARY_DATA: LibraryData = {
  version: '1.0',
  programs: []
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  viewMode: 'grid'
}

// Ensure directories exist
const ensureDirectories = (): void => {
  const dirs = [getIconsPath(), getThumbnailsPath()]
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

// Coerce legacy free-form `category` values to a valid ProviderId.
// Programs saved before the provider-based categorization have strings like
// "Games", null, etc. — those all get mapped to 'local'.
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
    iconPath: typeof p.iconPath === 'string' ? p.iconPath : null,
    thumbnailPath: typeof p.thumbnailPath === 'string' ? p.thumbnailPath : null,
    category: isProviderId(p.category) ? p.category : 'local',
    tags: Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === 'string') : [],
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date().toISOString()
  }
}

const isValidSettings = (value: unknown): value is Settings => {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<Settings>
  return (v.theme === 'dark' || v.theme === 'light') &&
    (v.viewMode === 'grid' || v.viewMode === 'list')
}

// Library operations
export const loadLibrary = (): LibraryData => {
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

export const saveLibrary = (data: LibraryData): void => {
  const libraryPath = getLibraryPath()

  try {
    ensureDirectories()
    writeFileAtomic(libraryPath, JSON.stringify(data, null, 2))
    logger.info(`Saved library with ${data.programs.length} programs`)
  } catch (error) {
    logger.error('Failed to save library:', error)
    throw error
  }
}

// Program operations
export const addProgram = (data: CreateProgramData): Program => {
  const library = loadLibrary()
  const now = new Date().toISOString()

  // Local-file adds always map to the 'local' provider.
  // Future integrations (steam, etc.) will call a separate entry point.
  const newProgram: Program = {
    id: uuidv4(),
    title: data.title,
    executablePath: data.executablePath,
    iconPath: null,
    thumbnailPath: null,
    category: 'local',
    tags: data.tags || [],
    createdAt: now,
    updatedAt: now
  }

  library.programs.push(newProgram)
  saveLibrary(library)
  logger.info(`Added program: ${newProgram.title} (${newProgram.id})`)

  return newProgram
}

// Steam entry: launch target is a steam:// URL, not an .exe path.
// No icon extraction — thumbnail is downloaded separately from Steam CDN.
export const addSteamProgram = (data: CreateSteamProgramData): Program => {
  const library = loadLibrary()
  const now = new Date().toISOString()

  const newProgram: Program = {
    id: uuidv4(),
    title: data.name,
    executablePath: `steam://run/${data.appId}`,
    iconPath: null,
    thumbnailPath: null,
    category: 'steam',
    tags: [],
    createdAt: now,
    updatedAt: now
  }

  library.programs.push(newProgram)
  saveLibrary(library)
  logger.info(`Added steam program: ${newProgram.title} (appId=${data.appId}, id=${newProgram.id})`)

  return newProgram
}

export const updateProgram = (data: UpdateProgramData): Program => {
  const library = loadLibrary()
  const index = library.programs.findIndex(p => p.id === data.id)

  if (index === -1) {
    throw new Error(`Program not found: ${data.id}`)
  }

  const program = library.programs[index]
  const updatedProgram: Program = {
    ...program,
    title: data.title ?? program.title,
    executablePath: data.executablePath ?? program.executablePath,
    tags: data.tags ?? program.tags,
    updatedAt: new Date().toISOString()
  }

  library.programs[index] = updatedProgram
  saveLibrary(library)
  logger.info(`Updated program: ${updatedProgram.title} (${updatedProgram.id})`)

  return updatedProgram
}

export const deleteProgram = (id: string): void => {
  const library = loadLibrary()
  const index = library.programs.findIndex(p => p.id === id)
  
  if (index === -1) {
    throw new Error(`Program not found: ${id}`)
  }
  
  const program = library.programs[index]

  // Only delete files that live inside our managed directories — prevents
  // a tampered library.json from causing arbitrary file deletion.
  if (program.iconPath && isPathInside(program.iconPath, getIconsPath()) && fs.existsSync(program.iconPath)) {
    try {
      fs.unlinkSync(program.iconPath)
      logger.info(`Deleted icon: ${program.iconPath}`)
    } catch (error) {
      logger.warn(`Failed to delete icon: ${program.iconPath}`, error)
    }
  } else if (program.iconPath) {
    logger.warn(`Skipped icon deletion (outside managed dir): ${program.iconPath}`)
  }

  if (program.thumbnailPath && isPathInside(program.thumbnailPath, getThumbnailsPath()) && fs.existsSync(program.thumbnailPath)) {
    try {
      fs.unlinkSync(program.thumbnailPath)
      logger.info(`Deleted thumbnail: ${program.thumbnailPath}`)
    } catch (error) {
      logger.warn(`Failed to delete thumbnail: ${program.thumbnailPath}`, error)
    }
  } else if (program.thumbnailPath) {
    logger.warn(`Skipped thumbnail deletion (outside managed dir): ${program.thumbnailPath}`)
  }
  
  library.programs.splice(index, 1)
  saveLibrary(library)
  logger.info(`Deleted program: ${program.title} (${id})`)
}

// Update program's icon path
export const updateProgramIconPath = (programId: string, iconPath: string | null): void => {
  const library = loadLibrary()
  const program = library.programs.find(p => p.id === programId)
  
  if (program) {
    program.iconPath = iconPath
    program.updatedAt = new Date().toISOString()
    saveLibrary(library)
    logger.info(`Updated icon path for program: ${programId}`)
  }
}

// Update program's thumbnail path
export const updateProgramThumbnailPath = (programId: string, thumbnailPath: string | null): void => {
  const library = loadLibrary()
  const program = library.programs.find(p => p.id === programId)
  
  if (program) {
    program.thumbnailPath = thumbnailPath
    program.updatedAt = new Date().toISOString()
    saveLibrary(library)
    logger.info(`Updated thumbnail path for program: ${programId}`)
  }
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
      return parsed
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
export { getIconsPath, getThumbnailsPath, ensureDirectories }
