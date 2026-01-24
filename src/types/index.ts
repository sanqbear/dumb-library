// Program item in the library
export interface Program {
  id: string
  title: string
  executablePath: string
  iconPath: string | null
  thumbnailPath: string | null
  category: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

// Data for creating a new program
export interface CreateProgramData {
  title: string
  executablePath: string
  category?: string | null
  tags?: string[]
}

// Data for updating a program
export interface UpdateProgramData {
  id: string
  title?: string
  executablePath?: string
  category?: string | null
  tags?: string[]
}

// Library data structure stored in JSON
export interface LibraryData {
  version: string
  programs: Program[]
  categories: string[]
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
}

// Extend Window interface
declare global {
  interface Window {
    electron: ElectronAPI
  }
}

export {}
