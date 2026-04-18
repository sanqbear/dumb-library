// Provider — how the program was added to the library.
// Acts as the "category" automatically assigned at creation time.
export type ProviderId = 'local'

export const PROVIDERS: Record<ProviderId, { label: string }> = {
  local: { label: '로컬 다운로드' }
}

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[]

export const isProviderId = (value: unknown): value is ProviderId => {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PROVIDERS, value)
}

// Program item in the library
export interface Program {
  id: string
  title: string
  executablePath: string
  iconPath: string | null
  thumbnailPath: string | null
  category: ProviderId
  tags: string[]
  createdAt: string
  updatedAt: string
}

// Data for creating a new program — `category` is assigned by the source
// (e.g. local-add sets 'local'), not user-editable.
export interface CreateProgramData {
  title: string
  executablePath: string
  tags?: string[]
}

// Data for updating a program — `category` is intentionally omitted.
export interface UpdateProgramData {
  id: string
  title?: string
  executablePath?: string
  tags?: string[]
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
  
  // Dialog operations
  selectExecutable: () => Promise<string | null>
  selectImage: () => Promise<string | null>
  
  // Thumbnail operations
  saveThumbnail: (programId: string, imagePath: string) => Promise<string>
  deleteThumbnail: (programId: string) => Promise<void>
  
  // Icon operations
  extractIcon: (executablePath: string, programId: string) => Promise<string | null>
  
  // Settings operations
  loadSettings: () => Promise<Settings>
  saveSettings: (settings: Settings) => Promise<void>
  
  // Utility
  getAssetPath: (relativePath: string) => Promise<string>

  // Window controls
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  onWindowMaximizeChanged: (callback: (isMaximized: boolean) => void) => () => void
}

// Extend Window interface
declare global {
  interface Window {
    electron: ElectronAPI
  }
}

export {}
