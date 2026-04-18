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
const PROVIDERS = {
  local: { label: "로컬 다운로드" },
  steam: { label: "스팀" }
};
const isProviderId = (value) => {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PROVIDERS, value);
};
const getUserDataPath = () => app.getPath("userData");
const getLibraryPath = () => path.join(getUserDataPath(), "library.json");
const getSettingsPath = () => path.join(getUserDataPath(), "settings.json");
const getIconsPath = () => path.join(getUserDataPath(), "icons");
const getThumbnailsPath = () => path.join(getUserDataPath(), "thumbnails");
const DEFAULT_LIBRARY_DATA = {
  version: "1.0",
  programs: []
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
  return Array.isArray(v.programs);
};
const migrateProgram = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const p = raw;
  if (typeof p.id !== "string" || typeof p.title !== "string" || typeof p.executablePath !== "string") {
    return null;
  }
  return {
    id: p.id,
    title: p.title,
    executablePath: p.executablePath,
    iconPath: typeof p.iconPath === "string" ? p.iconPath : null,
    thumbnailPath: typeof p.thumbnailPath === "string" ? p.thumbnailPath : null,
    category: isProviderId(p.category) ? p.category : "local",
    tags: Array.isArray(p.tags) ? p.tags.filter((t) => typeof t === "string") : [],
    createdAt: typeof p.createdAt === "string" ? p.createdAt : (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : (/* @__PURE__ */ new Date()).toISOString()
  };
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
      const programs = parsed.programs.map(migrateProgram).filter((p) => p !== null);
      const version = typeof parsed.version === "string" ? parsed.version : "1.0";
      logger.info(`Loaded library with ${programs.length} programs`);
      return { version, programs };
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
    category: "local",
    tags: data.tags || [],
    createdAt: now,
    updatedAt: now
  };
  library.programs.push(newProgram);
  saveLibrary(library);
  logger.info(`Added program: ${newProgram.title} (${newProgram.id})`);
  return newProgram;
};
const addSteamProgram = (data) => {
  const library = loadLibrary();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const newProgram = {
    id: v4(),
    title: data.name,
    executablePath: `steam://run/${data.appId}`,
    iconPath: null,
    thumbnailPath: null,
    category: "steam",
    tags: [],
    createdAt: now,
    updatedAt: now
  };
  library.programs.push(newProgram);
  saveLibrary(library);
  logger.info(`Added steam program: ${newProgram.title} (appId=${data.appId}, id=${newProgram.id})`);
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
    tags: data.tags ?? program.tags,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  library.programs[index] = updatedProgram;
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
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(executablePath)) {
      await shell.openExternal(executablePath);
    } else {
      await shell.openPath(executablePath);
    }
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
const execFileAsync$1 = promisify(execFile);
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
    const { stdout, stderr } = await execFileAsync$1("powershell", [
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
const execFileAsync = promisify(execFile);
const unescapeVdfString = (value) => {
  return value.replace(/\\\\/g, "\\").replace(/\\"/g, '"');
};
const extractAllPaths = (content) => {
  const re = /"path"\s+"([^"]*)"/gi;
  const results = [];
  let match;
  while ((match = re.exec(content)) !== null) {
    results.push(unescapeVdfString(match[1]));
  }
  return results;
};
const parseAppManifest = (content) => {
  const appIdMatch = content.match(/"appid"\s+"(\d+)"/i);
  const nameMatch = content.match(/"name"\s+"([^"]*)"/i);
  if (!appIdMatch || !nameMatch) return null;
  const appId = parseInt(appIdMatch[1], 10);
  if (!Number.isFinite(appId) || appId <= 0) return null;
  return { appId, name: unescapeVdfString(nameMatch[1]) };
};
const STEAM_FALLBACK_PATHS = [
  "C:\\Program Files (x86)\\Steam",
  "C:\\Program Files\\Steam"
];
const findSteamPath = async () => {
  try {
    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      '(Get-ItemProperty -Path "HKCU:\\Software\\Valve\\Steam" -Name "SteamPath" -ErrorAction Stop).SteamPath'
    ], { timeout: 5e3 });
    const raw = stdout.trim();
    if (raw) {
      const normalized = path.normalize(raw);
      if (fs.existsSync(normalized)) return normalized;
    }
  } catch (error) {
    logger.debug("Steam registry lookup failed, trying fallbacks:", error);
  }
  for (const candidate of STEAM_FALLBACK_PATHS) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};
const scanInstalledGames = async () => {
  const steamPath = await findSteamPath();
  if (!steamPath) {
    logger.info("Steam installation not found");
    return [];
  }
  const libraryFoldersVdf = path.join(steamPath, "steamapps", "libraryfolders.vdf");
  const libraryPaths = [];
  if (fs.existsSync(libraryFoldersVdf)) {
    try {
      const content = fs.readFileSync(libraryFoldersVdf, "utf-8");
      libraryPaths.push(...extractAllPaths(content));
    } catch (error) {
      logger.warn("Failed to read libraryfolders.vdf:", error);
    }
  }
  if (!libraryPaths.some((p) => path.resolve(p) === path.resolve(steamPath))) {
    libraryPaths.unshift(steamPath);
  }
  const games = [];
  const seenAppIds = /* @__PURE__ */ new Set();
  for (const libPath of libraryPaths) {
    const steamappsDir = path.join(libPath, "steamapps");
    if (!fs.existsSync(steamappsDir)) continue;
    let files;
    try {
      files = fs.readdirSync(steamappsDir);
    } catch (error) {
      logger.warn(`Failed to read ${steamappsDir}:`, error);
      continue;
    }
    for (const file of files) {
      if (!file.startsWith("appmanifest_") || !file.endsWith(".acf")) continue;
      const manifestPath = path.join(steamappsDir, file);
      try {
        const acfContent = fs.readFileSync(manifestPath, "utf-8");
        const parsed = parseAppManifest(acfContent);
        if (!parsed) continue;
        if (parsed.appId < 10) continue;
        if (seenAppIds.has(parsed.appId)) continue;
        seenAppIds.add(parsed.appId);
        games.push({
          appId: parsed.appId,
          name: parsed.name,
          installDir: libPath
        });
      } catch (error) {
        logger.warn(`Failed to parse ${file}:`, error);
      }
    }
  }
  games.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  logger.info(`Scanned ${games.length} Steam games from ${libraryPaths.length} libraries`);
  return games;
};
const THUMBNAIL_URL_CANDIDATES = (appId) => [
  `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900_2x.jpg`,
  `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`,
  `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`,
  `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`,
  `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`
];
const fetchWithTimeout = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
const downloadSteamThumbnail = async (appId, programId) => {
  ensureDirectories();
  const destPath = path.join(getThumbnailsPath(), `${programId}.jpg`);
  for (const url of THUMBNAIL_URL_CANDIDATES(appId)) {
    const buffer = await fetchWithTimeout(url, 15e3);
    if (buffer && buffer.length > 0) {
      try {
        fs.writeFileSync(destPath, buffer);
        logger.info(`Downloaded Steam thumbnail for appId ${appId} from ${url}`);
        return destPath;
      } catch (error) {
        logger.warn(`Failed to write thumbnail file: ${destPath}`, error);
        return null;
      }
    }
  }
  logger.warn(`No thumbnail found for Steam appId ${appId}`);
  return null;
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
  ipcMain.handle("steam:scanInstalled", async () => {
    return await scanInstalledGames();
  });
  ipcMain.handle("steam:addPrograms", async (_event, entries) => {
    const added = [];
    for (const entry of entries) {
      try {
        const program = addSteamProgram(entry);
        const thumbPath = await downloadSteamThumbnail(entry.appId, program.id);
        if (thumbPath) {
          updateProgramThumbnailPath(program.id, thumbPath);
          program.thumbnailPath = thumbPath;
        }
        added.push(program);
      } catch (error) {
        logger.error(`Failed to add Steam program appId=${entry.appId}:`, error);
      }
    }
    return added;
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
