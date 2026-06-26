// Provider — how the program was added to the library.
// Acts as the "category" automatically assigned at creation time.
export type ProviderId = 'local' | 'steam'

export const PROVIDERS: Record<ProviderId, { labelKey: string }> = {
  local: { labelKey: 'providers.local' },
  steam: { labelKey: 'providers.steam' }
}

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[]

export const isProviderId = (value: unknown): value is ProviderId => {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PROVIDERS, value)
}

/**
 * Build a wl-image://lib URL from a userData-relative path stored in a Program.
 * Returns an empty string when the input is null/empty so `<img src="">` stays silent.
 * Pass `version` (e.g., program.updatedAt) to bust the HTTP cache when the file
 * is replaced without its path changing.
 */
export const libImageUrl = (
  relPath: string | null | undefined,
  version?: string | number
): string => {
  if (!relPath) return ''
  const clean = relPath.replace(/\\/g, '/').replace(/^\/+/, '')
  const encoded = clean.split('/').map(encodeURIComponent).join('/')
  const base = `wl-image://lib/${encoded}`
  return version !== undefined ? `${base}?v=${encodeURIComponent(String(version))}` : base
}

// Program item in the library
export interface Program {
  id: string
  title: string
  executablePath: string
  iconPath: string | null
  thumbnailPath: string | null
  // Up to 3 landscape (16:9) preview images. userData-relative paths;
  // array order is the display order.
  previewImages: string[]
  // Optional market/store page (http/https) opened in the system browser.
  marketUrl: string | null
  category: ProviderId
  tags: string[]
  // Free-form search-index keywords. Unlike `tags` they are not used for
  // categorization/filtering chips — they only widen what the search box matches.
  keywords: string[]
  // Free-form reference note. Intentionally excluded from search/filtering —
  // it's display-only context shown on the detail screen.
  memo: string
  createdAt: string
  updatedAt: string
}

// Maximum number of landscape preview images a program may hold.
export const MAX_PREVIEW_IMAGES = 3

// Data for creating a new program — `category` is assigned by the source
// (e.g. local-add sets 'local'), not user-editable.
export interface CreateProgramData {
  title: string
  executablePath: string
  tags?: string[]
  keywords?: string[]
  memo?: string
  marketUrl?: string
}

// Data for updating a program — `category` is intentionally omitted.
export interface UpdateProgramData {
  id: string
  title?: string
  executablePath?: string
  tags?: string[]
  keywords?: string[]
  memo?: string
  marketUrl?: string
}

// Steam integration
export interface SteamGame {
  appId: number
  name: string
  installDir: string
}

export interface CreateSteamProgramData {
  appId: number
  name: string
}

// Library data structure stored in JSON
export interface LibraryData {
  version: string
  programs: Program[]
}

// User settings
export interface Settings {
  theme: 'dark' | 'light'
  viewMode: 'grid' | 'list'
  language: 'ko' | 'en' | 'ja' | 'zh-CN'
}

// View mode type
export type ViewMode = 'grid' | 'list'

// Theme type
export type Theme = 'dark' | 'light'

// IPC API exposed to renderer
export interface ElectronAPI {
  // Library operations
  loadLibrary: () => Promise<LibraryData>
  saveLibrary: (data: LibraryData) => Promise<void>
  
  // Program operations
  addProgram: (data: CreateProgramData) => Promise<Program>
  updateProgram: (data: UpdateProgramData) => Promise<Program>
  deleteProgram: (id: string) => Promise<void>
  launchProgram: (executablePath: string) => Promise<void>
  revealProgram: (executablePath: string) => Promise<void>
  openExternal: (url: string) => Promise<boolean>

  // Dialog operations
  selectExecutable: () => Promise<string | null>
  selectImage: () => Promise<string | null>
  
  // Thumbnail operations
  saveThumbnail: (programId: string, imagePath: string) => Promise<string>
  deleteThumbnail: (programId: string) => Promise<void>

  // Preview image operations (landscape, max 3 per program)
  savePreviewImage: (programId: string, imagePath: string) => Promise<string>
  deletePreviewImage: (programId: string, relPath: string) => Promise<void>
  reorderPreviewImages: (programId: string, relPaths: string[]) => Promise<void>
  
  // Icon operations
  extractIcon: (executablePath: string, programId: string) => Promise<string | null>
  saveIcon: (programId: string, imagePath: string) => Promise<string>
  deleteIcon: (programId: string) => Promise<void>
  
  // Settings operations
  loadSettings: () => Promise<Settings>
  saveSettings: (settings: Settings) => Promise<void>
  
  // Utility
  getAssetPath: (relativePath: string) => Promise<string>
  readImageAsDataUrl: (absPath: string) => Promise<string | null>
  fetchImageFromUrl: (url: string) => Promise<string | null>
  writeTempImageBuffer: (data: Uint8Array) => Promise<string>
  getPathForFile: (file: File) => string

  // Window controls
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  onWindowMaximizeChanged: (callback: (isMaximized: boolean) => void) => () => void

  // Steam integration
  scanSteamGames: () => Promise<SteamGame[]>
  addSteamPrograms: (entries: CreateSteamProgramData[]) => Promise<Program[]>
  downloadSteamThumbnail: (programId: string, appId: number) => Promise<string | null>
  applySteamCachedIcon: (programId: string, appId: number) => Promise<string | null>
}

// Extend Window interface
declare global {
  interface Window {
    electron: ElectronAPI
  }
}

export {}
