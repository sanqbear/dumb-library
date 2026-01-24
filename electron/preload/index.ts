import { contextBridge, ipcRenderer } from 'electron'

// Type definitions (duplicated here to avoid import issues in preload)
interface CreateProgramData {
  title: string
  executablePath: string
  category?: string | null
  tags?: string[]
}

interface UpdateProgramData {
  id: string
  title?: string
  executablePath?: string
  category?: string | null
  tags?: string[]
}

interface Settings {
  theme: 'dark' | 'light'
  viewMode: 'grid' | 'list'
}

// IPC Channels
const IPC_CHANNELS = {
  // Library
  LOAD_LIBRARY: 'library:load',
  SAVE_LIBRARY: 'library:save',
  
  // Program
  ADD_PROGRAM: 'program:add',
  UPDATE_PROGRAM: 'program:update',
  DELETE_PROGRAM: 'program:delete',
  LAUNCH_PROGRAM: 'program:launch',
  
  // Dialog
  SELECT_EXECUTABLE: 'dialog:selectExecutable',
  SELECT_IMAGE: 'dialog:selectImage',
  
  // Thumbnail
  SAVE_THUMBNAIL: 'thumbnail:save',
  DELETE_THUMBNAIL: 'thumbnail:delete',
  
  // Icon
  EXTRACT_ICON: 'icon:extract',
  
  // Settings
  LOAD_SETTINGS: 'settings:load',
  SAVE_SETTINGS: 'settings:save',
  
  // Utility
  GET_ASSET_PATH: 'util:getAssetPath'
} as const

// API exposed to renderer
const electronAPI = {
  // Library operations
  loadLibrary: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_LIBRARY),
  saveLibrary: (data: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_LIBRARY, data),
  
  // Program operations
  addProgram: (data: CreateProgramData) => ipcRenderer.invoke(IPC_CHANNELS.ADD_PROGRAM, data),
  updateProgram: (data: UpdateProgramData) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_PROGRAM, data),
  deleteProgram: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_PROGRAM, id),
  launchProgram: (executablePath: string) => ipcRenderer.invoke(IPC_CHANNELS.LAUNCH_PROGRAM, executablePath),
  
  // Dialog operations
  selectExecutable: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_EXECUTABLE),
  selectImage: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_IMAGE),
  
  // Thumbnail operations
  saveThumbnail: (programId: string, imagePath: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_THUMBNAIL, { programId, imagePath }),
  deleteThumbnail: (programId: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_THUMBNAIL, programId),
  
  // Icon operations
  extractIcon: (executablePath: string, programId: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.EXTRACT_ICON, { executablePath, programId }),
  
  // Settings operations
  loadSettings: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_SETTINGS),
  saveSettings: (settings: Settings) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),
  
  // Utility
  getAssetPath: (relativePath: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_ASSET_PATH, relativePath)
}

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
  } catch (error) {
    console.error('Failed to expose electron API:', error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
}

// Export channels for use in main process
export { IPC_CHANNELS }
