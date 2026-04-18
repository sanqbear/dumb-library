import { contextBridge, ipcRenderer, webUtils } from 'electron'

// Type definitions (duplicated here to avoid import issues in preload)
interface CreateProgramData {
  title: string
  executablePath: string
  tags?: string[]
}

interface UpdateProgramData {
  id: string
  title?: string
  executablePath?: string
  tags?: string[]
}

interface Settings {
  theme: 'dark' | 'light'
  viewMode: 'grid' | 'list'
}

interface CreateSteamProgramData {
  appId: number
  name: string
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
  SAVE_ICON: 'icon:save',
  DELETE_ICON: 'icon:delete',
  
  // Settings
  LOAD_SETTINGS: 'settings:load',
  SAVE_SETTINGS: 'settings:save',
  
  // Utility
  GET_ASSET_PATH: 'util:getAssetPath',
  IMAGE_READ_AS_DATA_URL: 'image:readAsDataUrl',
  IMAGE_FETCH_FROM_URL: 'image:fetchFromUrl',
  IMAGE_WRITE_TEMP_BUFFER: 'image:writeTempBuffer',

  // Window controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
  WINDOW_MAXIMIZE_CHANGED: 'window:maximize-changed',

  // Steam
  STEAM_SCAN_INSTALLED: 'steam:scanInstalled',
  STEAM_ADD_PROGRAMS: 'steam:addPrograms',
  STEAM_DOWNLOAD_THUMBNAIL: 'steam:downloadThumbnail'
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
  saveIcon: (programId: string, imagePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_ICON, { programId, imagePath }),
  deleteIcon: (programId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_ICON, programId),
  
  // Settings operations
  loadSettings: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_SETTINGS),
  saveSettings: (settings: Settings) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),
  
  // Utility
  getAssetPath: (relativePath: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_ASSET_PATH, relativePath),
  readImageAsDataUrl: (absPath: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.IMAGE_READ_AS_DATA_URL, absPath),
  fetchImageFromUrl: (url: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.IMAGE_FETCH_FROM_URL, url),
  writeTempImageBuffer: (data: Uint8Array): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.IMAGE_WRITE_TEMP_BUFFER, data),
  // webUtils.getPathForFile must be called in the renderer/preload context where
  // the File object is alive. Exposed here so drag&drop handlers can resolve paths.
  getPathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return ''
    }
  },

  // Window controls
  windowMinimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  windowMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
  windowClose: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  windowIsMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
  onWindowMaximizeChanged: (callback: (isMaximized: boolean) => void): (() => void) => {
    const handler = (_event: unknown, value: boolean) => callback(value)
    ipcRenderer.on(IPC_CHANNELS.WINDOW_MAXIMIZE_CHANGED, handler)
    return () => {
      ipcRenderer.off(IPC_CHANNELS.WINDOW_MAXIMIZE_CHANGED, handler)
    }
  },

  // Steam
  scanSteamGames: () => ipcRenderer.invoke(IPC_CHANNELS.STEAM_SCAN_INSTALLED),
  addSteamPrograms: (entries: CreateSteamProgramData[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.STEAM_ADD_PROGRAMS, entries),
  downloadSteamThumbnail: (programId: string, appId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.STEAM_DOWNLOAD_THUMBNAIL, { programId, appId })
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
