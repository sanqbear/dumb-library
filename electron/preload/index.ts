import { contextBridge, ipcRenderer, webUtils } from 'electron'

// Type definitions (duplicated here to avoid import issues in preload)
interface CreateProgramData {
  title: string
  executablePath: string
  developerId?: string | null
  publisherId?: string | null
  tags?: string[]
}

interface UpdateProgramData {
  id: string
  title?: string
  executablePath?: string
  developerId?: string | null
  publisherId?: string | null
  tags?: string[]
}

interface LocalizedName {
  ko: string
  en?: string
  ja?: string
  'zh-CN'?: string
}

interface CreateDeveloperData {
  names: LocalizedName
}

interface UpdateDeveloperData {
  id: string
  names: LocalizedName
}

interface CreateTagData {
  names: LocalizedName
  keyword?: string
}

interface UpdateTagData {
  id: string
  names: LocalizedName
  keyword?: string
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

  // Developer (circle) master list
  ADD_DEVELOPER: 'developer:add',
  UPDATE_DEVELOPER: 'developer:update',
  DELETE_DEVELOPER: 'developer:delete',
  // Tag master list
  ADD_TAG: 'tag:add',
  UPDATE_TAG: 'tag:update',
  DELETE_TAG: 'tag:delete',
  LAUNCH_PROGRAM: 'program:launch',
  REVEAL_PROGRAM: 'program:reveal',
  OPEN_EXTERNAL: 'shell:openExternal',
  // Main → renderer push: a single program's fields changed out-of-band
  // (e.g. a Steam thumbnail finished downloading in the background).
  PROGRAM_PATCHED: 'program:patched',

  // Dialog
  SELECT_EXECUTABLE: 'dialog:selectExecutable',
  SELECT_IMAGE: 'dialog:selectImage',
  
  // Thumbnail
  SAVE_THUMBNAIL: 'thumbnail:save',
  DELETE_THUMBNAIL: 'thumbnail:delete',

  // Preview images
  SAVE_PREVIEW: 'preview:save',
  DELETE_PREVIEW: 'preview:delete',
  REORDER_PREVIEW: 'preview:reorder',

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
  STEAM_DOWNLOAD_THUMBNAIL: 'steam:downloadThumbnail',
  STEAM_APPLY_CACHED_ICON: 'steam:applyCachedIcon'
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

  // Developer (circle) operations
  addDeveloper: (data: CreateDeveloperData) => ipcRenderer.invoke(IPC_CHANNELS.ADD_DEVELOPER, data),
  updateDeveloper: (data: UpdateDeveloperData) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DEVELOPER, data),
  deleteDeveloper: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_DEVELOPER, id),

  // Tag operations
  addTag: (data: CreateTagData) => ipcRenderer.invoke(IPC_CHANNELS.ADD_TAG, data),
  updateTag: (data: UpdateTagData) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_TAG, data),
  deleteTag: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_TAG, id),

  // Subscribe to background patches for a single program. Returns an unsubscribe.
  onProgramPatched: (
    callback: (payload: { id: string; changes: Record<string, unknown> }) => void
  ): (() => void) => {
    const handler = (_event: unknown, payload: { id: string; changes: Record<string, unknown> }) =>
      callback(payload)
    ipcRenderer.on(IPC_CHANNELS.PROGRAM_PATCHED, handler)
    return () => {
      ipcRenderer.off(IPC_CHANNELS.PROGRAM_PATCHED, handler)
    }
  },
  launchProgram: (executablePath: string) => ipcRenderer.invoke(IPC_CHANNELS.LAUNCH_PROGRAM, executablePath),
  revealProgram: (executablePath: string) => ipcRenderer.invoke(IPC_CHANNELS.REVEAL_PROGRAM, executablePath),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL, url),

  // Dialog operations
  selectExecutable: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_EXECUTABLE),
  selectImage: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_IMAGE),
  
  // Thumbnail operations
  saveThumbnail: (programId: string, imagePath: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_THUMBNAIL, { programId, imagePath }),
  deleteThumbnail: (programId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_THUMBNAIL, programId),

  // Preview image operations
  savePreviewImage: (programId: string, imagePath: string): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_PREVIEW, { programId, imagePath }),
  deletePreviewImage: (programId: string, relPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_PREVIEW, { programId, relPath }),
  reorderPreviewImages: (programId: string, relPaths: string[]): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.REORDER_PREVIEW, { programId, relPaths }),

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
    ipcRenderer.invoke(IPC_CHANNELS.STEAM_DOWNLOAD_THUMBNAIL, { programId, appId }),
  applySteamCachedIcon: (programId: string, appId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.STEAM_APPLY_CACHED_ICON, { programId, appId })
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
