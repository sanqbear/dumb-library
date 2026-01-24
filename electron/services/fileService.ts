import { dialog, shell, BrowserWindow } from 'electron'
import logger from './logger'

/**
 * Open file dialog to select an executable file
 */
export const selectExecutable = async (window: BrowserWindow | null): Promise<string | null> => {
  const result = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
    title: '실행 파일 선택',
    filters: [
      { name: '실행 파일', extensions: ['exe'] },
      { name: '모든 파일', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  
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
  const result = await dialog.showOpenDialog(window || BrowserWindow.getFocusedWindow()!, {
    title: '이미지 선택',
    filters: [
      { name: '이미지 파일', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] },
      { name: '모든 파일', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  
  if (result.canceled || result.filePaths.length === 0) {
    logger.debug('Image selection canceled')
    return null
  }
  
  const selectedPath = result.filePaths[0]
  logger.info(`Selected image: ${selectedPath}`)
  return selectedPath
}

/**
 * Launch a program
 */
export const launchProgram = async (executablePath: string): Promise<void> => {
  try {
    logger.info(`Launching program: ${executablePath}`)
    await shell.openPath(executablePath)
  } catch (error) {
    logger.error(`Failed to launch program: ${executablePath}`, error)
    throw error
  }
}

export default {
  selectExecutable,
  selectImage,
  launchProgram
}
