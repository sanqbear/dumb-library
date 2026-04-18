import { app, shell, dialog, BrowserWindow, ipcMain } from "electron";
import path, { join } from "path";
import log from "electron-log";
import fs from "fs";
import { v4 } from "uuid";
import { execFile } from "child_process";
import { promisify } from "util";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
log.transports.file.level = "info";
log.transports.console.level = "debug";
log.transports.file.resolvePathFn = () => {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "logs", "app.log");
};
log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}";
log.transports.console.format = "[{level}] {text}";
const logger = {
  info: (message, ...args) => {
    log.info(message, ...args);
  },
  warn: (message, ...args) => {
    log.warn(message, ...args);
  },
  error: (message, ...args) => {
    log.error(message, ...args);
  },
  debug: (message, ...args) => {
    log.debug(message, ...args);
  }
};
const getUserDataPath = () => app.getPath("userData");
const getLibraryPath = () => path.join(getUserDataPath(), "library.json");
const getSettingsPath = () => path.join(getUserDataPath(), "settings.json");
const getIconsPath = () => path.join(getUserDataPath(), "icons");
const getThumbnailsPath = () => path.join(getUserDataPath(), "thumbnails");
const DEFAULT_LIBRARY_DATA = {
  version: "1.0",
  programs: [],
  categories: []
};
const DEFAULT_SETTINGS = {
  theme: "dark",
  viewMode: "grid"
};
const ensureDirectories = () => {
  const dirs = [getIconsPath(), getThumbnailsPath()];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
};
const writeFileAtomic = (filePath, content) => {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, content, "utf-8");
  fs.renameSync(tempPath, filePath);
};
const isPathInside = (child, parent) => {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
};
const isValidLibrary = (value) => {
  if (!value || typeof value !== "object") return false;
  const v = value;
  return Array.isArray(v.programs) && Array.isArray(v.categories);
};
const isValidSettings = (value) => {
  if (!value || typeof value !== "object") return false;
  const v = value;
  return (v.theme === "dark" || v.theme === "light") && (v.viewMode === "grid" || v.viewMode === "list");
};
const loadLibrary = () => {
  const libraryPath = getLibraryPath();
  try {
    if (fs.existsSync(libraryPath)) {
      const data = fs.readFileSync(libraryPath, "utf-8");
      const parsed = JSON.parse(data);
      if (!isValidLibrary(parsed)) {
        logger.warn("library.json has invalid shape, falling back to defaults");
        return { ...DEFAULT_LIBRARY_DATA };
      }
      logger.info(`Loaded library with ${parsed.programs.length} programs`);
      return parsed;
    }
  } catch (error) {
    logger.error("Failed to load library:", error);
  }
  logger.info("Returning default library data");
  return { ...DEFAULT_LIBRARY_DATA };
};
const saveLibrary = (data) => {
  const libraryPath = getLibraryPath();
  try {
    ensureDirectories();
    writeFileAtomic(libraryPath, JSON.stringify(data, null, 2));
    logger.info(`Saved library with ${data.programs.length} programs`);
  } catch (error) {
    logger.error("Failed to save library:", error);
    throw error;
  }
};
const addProgram = (data) => {
  const library = loadLibrary();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const newProgram = {
    id: v4(),
    title: data.title,
    executablePath: data.executablePath,
    iconPath: null,
    thumbnailPath: null,
    category: data.category || null,
    tags: data.tags || [],
    createdAt: now,
    updatedAt: now
  };
  library.programs.push(newProgram);
  if (data.category && !library.categories.includes(data.category)) {
    library.categories.push(data.category);
  }
  saveLibrary(library);
  logger.info(`Added program: ${newProgram.title} (${newProgram.id})`);
  return newProgram;
};
const updateProgram = (data) => {
  const library = loadLibrary();
  const index = library.programs.findIndex((p) => p.id === data.id);
  if (index === -1) {
    throw new Error(`Program not found: ${data.id}`);
  }
  const program = library.programs[index];
  const updatedProgram = {
    ...program,
    title: data.title ?? program.title,
    executablePath: data.executablePath ?? program.executablePath,
    category: data.category !== void 0 ? data.category : program.category,
    tags: data.tags ?? program.tags,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  library.programs[index] = updatedProgram;
  if (data.category && !library.categories.includes(data.category)) {
    library.categories.push(data.category);
  }
  saveLibrary(library);
  logger.info(`Updated program: ${updatedProgram.title} (${updatedProgram.id})`);
  return updatedProgram;
};
const deleteProgram = (id) => {
  const library = loadLibrary();
  const index = library.programs.findIndex((p) => p.id === id);
  if (index === -1) {
    throw new Error(`Program not found: ${id}`);
  }
  const program = library.programs[index];
  if (program.iconPath && isPathInside(program.iconPath, getIconsPath()) && fs.existsSync(program.iconPath)) {
    try {
      fs.unlinkSync(program.iconPath);
      logger.info(`Deleted icon: ${program.iconPath}`);
    } catch (error) {
      logger.warn(`Failed to delete icon: ${program.iconPath}`, error);
    }
  } else if (program.iconPath) {
    logger.warn(`Skipped icon deletion (outside managed dir): ${program.iconPath}`);
  }
  if (program.thumbnailPath && isPathInside(program.thumbnailPath, getThumbnailsPath()) && fs.existsSync(program.thumbnailPath)) {
    try {
      fs.unlinkSync(program.thumbnailPath);
      logger.info(`Deleted thumbnail: ${program.thumbnailPath}`);
    } catch (error) {
      logger.warn(`Failed to delete thumbnail: ${program.thumbnailPath}`, error);
    }
  } else if (program.thumbnailPath) {
    logger.warn(`Skipped thumbnail deletion (outside managed dir): ${program.thumbnailPath}`);
  }
  library.programs.splice(index, 1);
  saveLibrary(library);
  logger.info(`Deleted program: ${program.title} (${id})`);
};
const updateProgramIconPath = (programId, iconPath) => {
  const library = loadLibrary();
  const program = library.programs.find((p) => p.id === programId);
  if (program) {
    program.iconPath = iconPath;
    program.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveLibrary(library);
    logger.info(`Updated icon path for program: ${programId}`);
  }
};
const updateProgramThumbnailPath = (programId, thumbnailPath) => {
  const library = loadLibrary();
  const program = library.programs.find((p) => p.id === programId);
  if (program) {
    program.thumbnailPath = thumbnailPath;
    program.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveLibrary(library);
    logger.info(`Updated thumbnail path for program: ${programId}`);
  }
};
const loadSettings = () => {
  const settingsPath = getSettingsPath();
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf-8");
      const parsed = JSON.parse(data);
      if (!isValidSettings(parsed)) {
        logger.warn("settings.json has invalid shape, falling back to defaults");
        return { ...DEFAULT_SETTINGS };
      }
      logger.info("Loaded settings");
      return parsed;
    }
  } catch (error) {
    logger.error("Failed to load settings:", error);
  }
  return { ...DEFAULT_SETTINGS };
};
const saveSettings = (settings) => {
  const settingsPath = getSettingsPath();
  try {
    ensureDirectories();
    writeFileAtomic(settingsPath, JSON.stringify(settings, null, 2));
    logger.info("Saved settings");
  } catch (error) {
    logger.error("Failed to save settings:", error);
    throw error;
  }
};
const resolveTargetWindow = (window) => {
  return window ?? BrowserWindow.getFocusedWindow() ?? void 0;
};
const selectExecutable = async (window) => {
  const options = {
    title: "실행 파일 선택",
    filters: [
      { name: "실행 파일", extensions: ["exe"] },
      { name: "모든 파일", extensions: ["*"] }
    ],
    properties: ["openFile"]
  };
  const target = resolveTargetWindow(window);
  const result = target ? await dialog.showOpenDialog(target, options) : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) {
    logger.debug("Executable selection canceled");
    return null;
  }
  const selectedPath = result.filePaths[0];
  logger.info(`Selected executable: ${selectedPath}`);
  return selectedPath;
};
const selectImage = async (window) => {
  const options = {
    title: "이미지 선택",
    filters: [
      { name: "이미지 파일", extensions: ["png", "jpg", "jpeg", "gif", "bmp", "webp"] },
      { name: "모든 파일", extensions: ["*"] }
    ],
    properties: ["openFile"]
  };
  const target = resolveTargetWindow(window);
  const result = target ? await dialog.showOpenDialog(target, options) : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) {
    logger.debug("Image selection canceled");
    return null;
  }
  const selectedPath = result.filePaths[0];
  logger.info(`Selected image: ${selectedPath}`);
  return selectedPath;
};
const launchProgram = async (executablePath) => {
  try {
    logger.info(`Launching program: ${executablePath}`);
    await shell.openPath(executablePath);
  } catch (error) {
    logger.error(`Failed to launch program: ${executablePath}`, error);
    throw error;
  }
};
const saveThumbnail = (programId, imagePath) => {
  ensureDirectories();
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }
  const ext = path.extname(imagePath).toLowerCase();
  const thumbnailsDir = getThumbnailsPath();
  const destPath = path.join(thumbnailsDir, `${programId}${ext}`);
  deleteExistingThumbnail(programId);
  try {
    fs.copyFileSync(imagePath, destPath);
    updateProgramThumbnailPath(programId, destPath);
    logger.info(`Saved thumbnail for program ${programId}: ${destPath}`);
    return destPath;
  } catch (error) {
    logger.error(`Failed to save thumbnail for program ${programId}:`, error);
    throw error;
  }
};
const deleteExistingThumbnail = (programId) => {
  const thumbnailsDir = getThumbnailsPath();
  if (!fs.existsSync(thumbnailsDir)) {
    return;
  }
  const files = fs.readdirSync(thumbnailsDir);
  const extensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"];
  for (const ext of extensions) {
    const fileName = `${programId}${ext}`;
    if (files.includes(fileName)) {
      const filePath = path.join(thumbnailsDir, fileName);
      try {
        fs.unlinkSync(filePath);
        logger.info(`Deleted existing thumbnail: ${filePath}`);
      } catch (error) {
        logger.warn(`Failed to delete existing thumbnail: ${filePath}`, error);
      }
    }
  }
};
const deleteThumbnail = (programId) => {
  deleteExistingThumbnail(programId);
  updateProgramThumbnailPath(programId, null);
  logger.info(`Deleted thumbnail for program: ${programId}`);
};
const execFileAsync = promisify(execFile);
const extractIcon = async (executablePath, programId) => {
  ensureDirectories();
  if (!fs.existsSync(executablePath)) {
    logger.warn(`Executable not found: ${executablePath}`);
    return null;
  }
  const iconsDir = getIconsPath();
  const destPath = path.join(iconsDir, `${programId}.png`);
  const tempScriptPath = path.join(app.getPath("temp"), `extract-icon-${programId}.ps1`);
  const psScript = `
Add-Type -AssemblyName System.Drawing
try {
    $exePath = $env:WL_EXE_PATH
    $outPath = $env:WL_OUT_PATH
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exePath)
    if ($icon) {
        $bitmap = $icon.ToBitmap()
        $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bitmap.Dispose()
        $icon.Dispose()
        Write-Output "success"
    } else {
        Write-Output "failed"
    }
} catch {
    Write-Output "error: $_"
}
`;
  try {
    fs.writeFileSync(tempScriptPath, psScript, { encoding: "utf8" });
    const { stdout, stderr } = await execFileAsync("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      tempScriptPath
    ], {
      timeout: 15e3,
      env: {
        ...process.env,
        WL_EXE_PATH: executablePath,
        WL_OUT_PATH: destPath
      }
    });
    try {
      fs.unlinkSync(tempScriptPath);
    } catch {
    }
    if (stderr) {
      logger.warn(`PowerShell stderr: ${stderr}`);
    }
    const result = stdout.trim();
    if (result === "success" && fs.existsSync(destPath)) {
      updateProgramIconPath(programId, destPath);
      logger.info(`Extracted icon for program ${programId}: ${destPath}`);
      return destPath;
    } else {
      logger.warn(`Failed to extract icon for: ${executablePath}, result: ${result}`);
      return null;
    }
  } catch (error) {
    logger.error(`Error extracting icon from ${executablePath}:`, error);
    try {
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    } catch {
    }
    return null;
  }
};
const isDev = process.env.NODE_ENV === "development";
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  app.setPath("userData", join(process.env.PORTABLE_EXECUTABLE_DIR, "data"));
}
let mainWindow = null;
function createWindow() {
  const preloadPath = join(__dirname, "../preload/index.mjs");
  logger.info(`Preload path: ${preloadPath}`);
  const iconPath = isDev ? join(app.getAppPath(), "src/assets/icon.png") : join(process.resourcesPath, "icon.png");
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
      // Allow loading local files
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    logger.info("Main window ready to show");
  });
  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window:maximize-changed", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window:maximize-changed", false);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const parsed = new URL(details.url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        shell.openExternal(details.url);
      } else {
        logger.warn(`Blocked window.open with disallowed scheme: ${parsed.protocol}`);
      }
    } catch {
      logger.warn(`Blocked window.open with unparseable URL: ${details.url}`);
    }
    return { action: "deny" };
  });
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}
function registerIpcHandlers() {
  ipcMain.handle("library:load", () => {
    return loadLibrary();
  });
  ipcMain.handle("library:save", (_event, data) => {
    saveLibrary(data);
  });
  ipcMain.handle("program:add", (_event, data) => {
    return addProgram(data);
  });
  ipcMain.handle("program:update", (_event, data) => {
    return updateProgram(data);
  });
  ipcMain.handle("program:delete", (_event, id) => {
    deleteProgram(id);
  });
  ipcMain.handle("program:launch", async (_event, executablePath) => {
    await launchProgram(executablePath);
  });
  ipcMain.handle("dialog:selectExecutable", async () => {
    return await selectExecutable(mainWindow);
  });
  ipcMain.handle("dialog:selectImage", async () => {
    return await selectImage(mainWindow);
  });
  ipcMain.handle("thumbnail:save", (_event, { programId, imagePath }) => {
    return saveThumbnail(programId, imagePath);
  });
  ipcMain.handle("thumbnail:delete", (_event, programId) => {
    deleteThumbnail(programId);
  });
  ipcMain.handle("icon:extract", async (_event, { executablePath, programId }) => {
    return await extractIcon(executablePath, programId);
  });
  ipcMain.handle("settings:load", () => {
    return loadSettings();
  });
  ipcMain.handle("settings:save", (_event, settings) => {
    saveSettings(settings);
  });
  ipcMain.handle("util:getAssetPath", (_event, relativePath) => {
    if (isDev) {
      return join(app.getAppPath(), relativePath);
    }
    return join(process.resourcesPath, relativePath);
  });
  ipcMain.handle("window:minimize", () => {
    mainWindow?.minimize();
  });
  ipcMain.handle("window:maximize", () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.handle("window:close", () => {
    mainWindow?.close();
  });
  ipcMain.handle("window:isMaximized", () => {
    return mainWindow?.isMaximized() ?? false;
  });
  logger.info("IPC handlers registered");
}
app.whenReady().then(() => {
  logger.info("App ready");
  registerIpcHandlers();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  logger.info("All windows closed");
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", () => {
  logger.info("App quitting");
});
