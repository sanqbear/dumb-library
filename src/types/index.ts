// Provider — how the program was added to the library.
// Acts as the "category" automatically assigned at creation time.
export type ProviderId = 'local' | 'steam'

export const PROVIDERS: Record<ProviderId, { labelKey: string }> = {
  local: { labelKey: 'providers.local' },
  steam: { labelKey: 'providers.steam' }
}

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[]

// The provider a program gets when nothing else applies: a plain local file.
// Because it's the norm, the UI leaves it unmarked and only badges the
// providers that actually distinguish an entry.
export const DEFAULT_PROVIDER: ProviderId = 'local'

export const isProviderId = (value: unknown): value is ProviderId => {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PROVIDERS, value)
}

// Where library images are served from. The Electron main process registers the
// `wl-image` scheme; the browser testbed cannot, so it swaps in an http base via
// setLibImageBase(). Production never calls the setter.
let libImageBase = 'wl-image://lib/'

/** Testbed seam — point library image URLs at a base the browser can fetch. */
export const setLibImageBase = (base: string): void => {
  libImageBase = base
}

/**
 * Build a library image URL from a userData-relative path stored in a Program.
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
  const base = `${libImageBase}${encoded}`
  return version !== undefined ? `${base}?v=${encodeURIComponent(String(version))}` : base
}

// Supported UI locales. Kept here (not in i18n) so the Electron main process can
// import it from this shared module without pulling in the renderer's i18n stack.
export type LocaleCode = 'ko' | 'en' | 'ja' | 'zh-CN'

// A display name in each supported language. `ko` is the canonical value and the
// fallback used whenever a locale-specific name is absent.
export interface LocalizedName {
  ko: string
  en?: string
  ja?: string
  'zh-CN'?: string
}

// Developer / doujin circle master entry. Programs reference one by `id` rather
// than storing the name inline, so a single edit updates every program at once.
export interface Developer {
  id: string
  names: LocalizedName
  createdAt: string
  updatedAt: string
}

export interface CreateDeveloperData {
  names: LocalizedName
}

export interface UpdateDeveloperData {
  id: string
  names: LocalizedName
}

// Resolve a localized name for `locale`, falling back to Korean when the
// requested language is empty/unset.
export const localizedName = (names: LocalizedName, locale: LocaleCode): string => {
  const value = names[locale]
  return value && value.trim() ? value : names.ko
}

// Tag master entry. Like Developer, programs reference one by `id` rather than
// storing the name inline, so a tag is localized once and shows correctly in
// every language. `keyword` is an extra, hidden search term (never displayed).
export interface Tag {
  id: string
  names: LocalizedName
  keyword: string
  createdAt: string
  updatedAt: string
}

export interface CreateTagData {
  names: LocalizedName
  keyword?: string
}

export interface UpdateTagData {
  id: string
  names: LocalizedName
  keyword?: string
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
  // Reference to a Developer master entry (doujin circle / studio). Null when
  // unset. The localized name is resolved from the Developer registry, not
  // stored here. Included in search via its names.
  developerId: string | null
  // Publisher reference — points into the SAME Developer master list as
  // `developerId` (one shared pool of circles/companies, two roles). The
  // create/edit forms fill the missing one from the other when only one is set.
  publisherId: string | null
  // References to Tag master entries by id. The localized names are resolved
  // from the Tag registry, not stored here. Included in search via those names.
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
  developerId?: string | null
  publisherId?: string | null
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
  developerId?: string | null
  publisherId?: string | null
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
  // Developer / circle master list. Optional on disk for backward compatibility;
  // always present after load (migration backfills it from legacy data).
  developers: Developer[]
  // Tag master list. Optional on disk; backfilled on load by migrating legacy
  // inline tag strings into localized Tag entities.
  tags: Tag[]
}

// Grid card density — the minimum card width the grid auto-fills with.
export type GridCardSize = 'small' | 'medium' | 'large'

// User settings
export interface Settings {
  theme: 'dark' | 'light'
  viewMode: 'grid' | 'list'
  language: 'ko' | 'en' | 'ja' | 'zh-CN'
  gridCardSize: GridCardSize
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

  // Developer (circle) master-list operations
  addDeveloper: (data: CreateDeveloperData) => Promise<Developer>
  updateDeveloper: (data: UpdateDeveloperData) => Promise<Developer>
  deleteDeveloper: (id: string) => Promise<void>

  // Tag master-list operations
  addTag: (data: CreateTagData) => Promise<Tag>
  updateTag: (data: UpdateTagData) => Promise<Tag>
  deleteTag: (id: string) => Promise<void>
  // Background single-program patch pushed from main (e.g. async thumbnail).
  // Returns an unsubscribe function.
  onProgramPatched: (
    callback: (payload: { id: string; changes: Partial<Program> }) => void
  ) => () => void
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
