import { app, BrowserWindow, shell, ipcMain, protocol } from 'electron'
import { join } from 'path'
import logger from './services/logger'
import * as dataService from './services/dataService'
import * as fileService from './services/fileService'
import * as thumbnailService from './services/thumbnailService'
import * as iconService from './services/iconService'
import type { CreateProgramData, UpdateProgramData, Settings, LibraryData } from '../src/types'

const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const preloadPath = join(__dirname, '../preload/index.mjs')
  logger.info(`Preload path: ${preloadPath}`)

  const iconPath = isDev
    ? join(app.getAppPath(), 'src/assets/icon.png')
    : join(process.resourcesPath, 'icon.png')

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false  // Allow loading local files
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    logger.info('Main window ready to show')
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer based on electron-vite cli.
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Register IPC handlers
function registerIpcHandlers(): void {
  // Library operations
  ipcMain.handle('library:load', () => {
    return dataService.loadLibrary()
  })

  ipcMain.handle('library:save', (_event, data: LibraryData) => {
    dataService.saveLibrary(data)
  })

  // Program operations
  ipcMain.handle('program:add', (_event, data: CreateProgramData) => {
    return dataService.addProgram(data)
  })

  ipcMain.handle('program:update', (_event, data: UpdateProgramData) => {
    return dataService.updateProgram(data)
  })

  ipcMain.handle('program:delete', (_event, id: string) => {
    dataService.deleteProgram(id)
  })

  ipcMain.handle('program:launch', async (_event, executablePath: string) => {
    await fileService.launchProgram(executablePath)
  })

  // Dialog operations
  ipcMain.handle('dialog:selectExecutable', async () => {
    return await fileService.selectExecutable(mainWindow)
  })

  ipcMain.handle('dialog:selectImage', async () => {
    return await fileService.selectImage(mainWindow)
  })

  // Thumbnail operations
  ipcMain.handle('thumbnail:save', (_event, { programId, imagePath }: { programId: string; imagePath: string }) => {
    return thumbnailService.saveThumbnail(programId, imagePath)
  })

  ipcMain.handle('thumbnail:delete', (_event, programId: string) => {
    thumbnailService.deleteThumbnail(programId)
  })

  // Icon operations
  ipcMain.handle('icon:extract', async (_event, { executablePath, programId }: { executablePath: string; programId: string }) => {
    return await iconService.extractIcon(executablePath, programId)
  })

  // Settings operations
  ipcMain.handle('settings:load', () => {
    return dataService.loadSettings()
  })

  ipcMain.handle('settings:save', (_event, settings: Settings) => {
    dataService.saveSettings(settings)
  })

  // Utility
  ipcMain.handle('util:getAssetPath', (_event, relativePath: string) => {
    if (isDev) {
      return join(app.getAppPath(), relativePath)
    }
    return join(process.resourcesPath, relativePath)
  })

  logger.info('IPC handlers registered')
}

// App lifecycle
app.whenReady().then(() => {
  logger.info('App ready')
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  logger.info('All windows closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  logger.info('App quitting')
})
