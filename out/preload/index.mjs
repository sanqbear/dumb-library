import { contextBridge, ipcRenderer } from "electron";
const IPC_CHANNELS = {
  // Library
  LOAD_LIBRARY: "library:load",
  SAVE_LIBRARY: "library:save",
  // Program
  ADD_PROGRAM: "program:add",
  UPDATE_PROGRAM: "program:update",
  DELETE_PROGRAM: "program:delete",
  LAUNCH_PROGRAM: "program:launch",
  // Dialog
  SELECT_EXECUTABLE: "dialog:selectExecutable",
  SELECT_IMAGE: "dialog:selectImage",
  // Thumbnail
  SAVE_THUMBNAIL: "thumbnail:save",
  DELETE_THUMBNAIL: "thumbnail:delete",
  // Icon
  EXTRACT_ICON: "icon:extract",
  // Settings
  LOAD_SETTINGS: "settings:load",
  SAVE_SETTINGS: "settings:save",
  // Utility
  GET_ASSET_PATH: "util:getAssetPath",
  // Window controls
  WINDOW_MINIMIZE: "window:minimize",
  WINDOW_MAXIMIZE: "window:maximize",
  WINDOW_CLOSE: "window:close",
  WINDOW_IS_MAXIMIZED: "window:isMaximized",
  WINDOW_MAXIMIZE_CHANGED: "window:maximize-changed"
};
const electronAPI = {
  // Library operations
  loadLibrary: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_LIBRARY),
  saveLibrary: (data) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_LIBRARY, data),
  // Program operations
  addProgram: (data) => ipcRenderer.invoke(IPC_CHANNELS.ADD_PROGRAM, data),
  updateProgram: (data) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_PROGRAM, data),
  deleteProgram: (id) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_PROGRAM, id),
  launchProgram: (executablePath) => ipcRenderer.invoke(IPC_CHANNELS.LAUNCH_PROGRAM, executablePath),
  // Dialog operations
  selectExecutable: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_EXECUTABLE),
  selectImage: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_IMAGE),
  // Thumbnail operations
  saveThumbnail: (programId, imagePath) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_THUMBNAIL, { programId, imagePath }),
  deleteThumbnail: (programId) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_THUMBNAIL, programId),
  // Icon operations
  extractIcon: (executablePath, programId) => ipcRenderer.invoke(IPC_CHANNELS.EXTRACT_ICON, { executablePath, programId }),
  // Settings operations
  loadSettings: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_SETTINGS),
  saveSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),
  // Utility
  getAssetPath: (relativePath) => ipcRenderer.invoke(IPC_CHANNELS.GET_ASSET_PATH, relativePath),
  // Window controls
  windowMinimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  windowMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
  windowClose: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  windowIsMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
  onWindowMaximizeChanged: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on(IPC_CHANNELS.WINDOW_MAXIMIZE_CHANGED, handler);
    return () => {
      ipcRenderer.off(IPC_CHANNELS.WINDOW_MAXIMIZE_CHANGED, handler);
    };
  }
};
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
  } catch (error) {
    console.error("Failed to expose electron API:", error);
  }
} else {
  window.electron = electronAPI;
}
export {
  IPC_CHANNELS
};
