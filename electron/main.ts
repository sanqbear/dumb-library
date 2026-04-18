import { app, BrowserWindow, shell, ipcMain, protocol, net } from 'electron'
import { join, resolve, relative, isAbsolute } from 'path'
import logger from './services/logger'
import * as dataService from './services/dataService'
import * as fileService from './services/fileService'
import * as thumbnailService from './services/thumbnailService'
import * as iconService from './services/iconService'
import * as steamService from './services/steamService'
import * as imageService from './services/imageService'
import type { CreateProgramData, UpdateProgramData, Settings, LibraryData, CreateSteamProgramData, Program } from '../src/types'

// Register the wl-image scheme as privileged BEFORE app.ready so it can be
// used in <img> tags, supports streaming, and bypasses CSP for local assets.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'wl-image',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

const isDev = process.env.NODE_ENV === 'development'

if (process.env.PORTABLE_EXECUTABLE_DIR) {
  app.setPath('userData', join(process.env.PORTABLE_EXECUTABLE_DIR, 'data'))
}

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
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    logger.info('Main window ready to show')
  })

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximize-changed', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximize-changed', false)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const parsed = new URL(details.url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(details.url)
      } else {
        logger.warn(`Blocked window.open with disallowed scheme: ${parsed.protocol}`)
      }
    } catch {
      logger.warn(`Blocked window.open with unparseable URL: ${details.url}`)
    }
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

  ipcMain.handle('icon:save', async (_event, { programId, imagePath }: { programId: string; imagePath: string }) => {
    return await iconService.saveIcon(programId, imagePath)
  })

  ipcMain.handle('icon:delete', (_event, programId: string) => {
    iconService.deleteIcon(programId)
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

  // Window controls (custom frame)
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  ipcMain.handle('window:close', () => {
    mainWindow?.close()
  })

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() ?? false
  })

  // Image utilities
  ipcMain.handle('image:readAsDataUrl', async (_event, absPath: string) => {
    return await imageService.readImageAsDataUrl(absPath)
  })

  ipcMain.handle('image:fetchFromUrl', async (_event, url: string) => {
    return await imageService.fetchImageFromUrl(url)
  })

  ipcMain.handle('image:writeTempBuffer', async (_event, data: Uint8Array) => {
    return await imageService.writeTempBuffer(Buffer.from(data))
  })

  // Steam integration
  ipcMain.handle('steam:scanInstalled', async () => {
    return await steamService.scanInstalledGames()
  })

  ipcMain.handle('steam:downloadThumbnail', async (_event, { programId, appId }: { programId: string; appId: number }) => {
    const relPath = await steamService.downloadSteamThumbnail(appId, programId)
    if (relPath) {
      dataService.updateProgramThumbnailPath(programId, relPath)
    }
    return relPath
  })

  ipcMain.handle('steam:applyCachedIcon', async (_event, { programId, appId }: { programId: string; appId: number }) => {
    const source = await steamService.findSteamIcon(appId)
    if (!source) return null
    try {
      const relPath = await imageService.processIcon(source, programId)
      dataService.updateProgramIconPath(programId, relPath)
      return relPath
    } catch (error) {
      logger.warn(`Failed to process Steam cached icon for appId=${appId}:`, error)
      return null
    }
  })

  ipcMain.handle('steam:addPrograms', async (_event, entries: CreateSteamProgramData[]) => {
    const added: Program[] = []
    for (const entry of entries) {
      try {
        const program = dataService.addSteamProgram(entry)
        const thumbPath = await steamService.downloadSteamThumbnail(entry.appId, program.id)
        if (thumbPath) {
          dataService.updateProgramThumbnailPath(program.id, thumbPath)
          program.thumbnailPath = thumbPath
        }
        added.push(program)
      } catch (error) {
        logger.error(`Failed to add Steam program appId=${entry.appId}:`, error)
      }
    }
    return added
  })

  logger.info('IPC handlers registered')
}

// Serve userData-relative images via wl-image://lib/<relative-path>.
// Enforces path confinement — the resolved file must stay inside userData.
const registerImageProtocol = (): void => {
  protocol.handle('wl-image', async (request) => {
    try {
      const url = new URL(request.url)
      if (url.host !== 'lib') {
        return new Response('Not Found', { status: 404 })
      }
      const relPath = decodeURIComponent(url.pathname.replace(/^\//, ''))
      if (!relPath || relPath.includes('..')) {
        return new Response('Forbidden', { status: 403 })
      }
      const userData = resolve(app.getPath('userData'))
      const absPath = resolve(join(userData, relPath))
      const rel = relative(userData, absPath)
      if (rel.startsWith('..') || isAbsolute(rel)) {
        return new Response('Forbidden', { status: 403 })
      }
      return net.fetch(`file://${absPath}`)
    } catch (error) {
      logger.error('wl-image handler error:', error)
      return new Response('Server Error', { status: 500 })
    }
  })
  logger.info('Registered wl-image:// protocol handler')
}

// App lifecycle
app.whenReady().then(() => {
  logger.info('App ready')
  imageService.cleanupTempImages()
  registerImageProtocol()
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
