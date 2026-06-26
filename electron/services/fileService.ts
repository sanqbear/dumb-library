import { dialog, shell, BrowserWindow } from 'electron'
import { isProtocolUrl, resolveExecutablePath } from './executablePath'
import logger from './logger'

const resolveTargetWindow = (window: BrowserWindow | null): BrowserWindow | undefined => {
  return window ?? BrowserWindow.getFocusedWindow() ?? undefined
}

/**
 * Open file dialog to select an executable file
 */
export const selectExecutable = async (window: BrowserWindow | null): Promise<string | null> => {
  const options = {
    title: '실행 파일 선택',
    filters: [
      { name: '실행 파일', extensions: ['exe'] },
      { name: '모든 파일', extensions: ['*'] }
    ],
    properties: ['openFile'] as Array<'openFile'>
  }
  const target = resolveTargetWindow(window)
  const result = target
    ? await dialog.showOpenDialog(target, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled || result.filePaths.length === 0) {
    logger.debug('Executable selection canceled')
    return null
  }

  const selectedPath = result.filePaths[0]
  logger.info(`Selected executable: ${selectedPath}`)
  return selectedPath
}

/**
 * Open file dialog to select an image file
 */
export const selectImage = async (window: BrowserWindow | null): Promise<string | null> => {
  const options = {
    title: '이미지 선택',
    filters: [
      { name: '이미지 파일', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] },
      { name: '모든 파일', extensions: ['*'] }
    ],
    properties: ['openFile'] as Array<'openFile'>
  }
  const target = resolveTargetWindow(window)
  const result = target
    ? await dialog.showOpenDialog(target, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled || result.filePaths.length === 0) {
    logger.debug('Image selection canceled')
    return null
  }

  const selectedPath = result.filePaths[0]
  logger.info(`Selected image: ${selectedPath}`)
  return selectedPath
}

/**
 * Launch a program. Accepts either a local .exe path or a protocol URL
 * like steam://run/<appId>.
 */
export const launchProgram = async (executablePath: string): Promise<void> => {
  try {
    if (isProtocolUrl(executablePath)) {
      // Protocol URL (steam://, etc.) — hand off to the OS handler.
      logger.info(`Launching program: ${executablePath}`)
      await shell.openExternal(executablePath)
    } else {
      const resolved = resolveExecutablePath(executablePath)
      logger.info(`Launching program: ${executablePath} (resolved: ${resolved})`)
      await shell.openPath(resolved)
    }
  } catch (error) {
    logger.error(`Failed to launch program: ${executablePath}`, error)
    throw error
  }
}

/**
 * Reveal a program's executable in the OS file manager (Explorer on Windows),
 * selecting the file. Protocol-based programs (e.g. steam://run/<appId>) have
 * no filesystem location, so the call is a no-op for them.
 */
export const revealInExplorer = async (executablePath: string): Promise<void> => {
  if (isProtocolUrl(executablePath)) {
    logger.warn(`Cannot reveal protocol URL in explorer: ${executablePath}`)
    return
  }
  const resolved = resolveExecutablePath(executablePath)
  logger.info(`Revealing in explorer: ${executablePath} (resolved: ${resolved})`)
  shell.showItemInFolder(resolved)
}

export default {
  selectExecutable,
  selectImage,
  launchProgram,
  revealInExplorer
}
