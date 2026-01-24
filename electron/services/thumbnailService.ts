import fs from 'fs'
import path from 'path'
import { getThumbnailsPath, ensureDirectories, updateProgramThumbnailPath } from './dataService'
import logger from './logger'

/**
 * Save a thumbnail image for a program
 * Copies the source image to the thumbnails directory
 */
export const saveThumbnail = (programId: string, imagePath: string): string => {
  ensureDirectories()
  
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`)
  }
  
  const ext = path.extname(imagePath).toLowerCase()
  const thumbnailsDir = getThumbnailsPath()
  const destPath = path.join(thumbnailsDir, `${programId}${ext}`)
  
  // Delete existing thumbnail if exists
  deleteExistingThumbnail(programId)
  
  try {
    fs.copyFileSync(imagePath, destPath)
    updateProgramThumbnailPath(programId, destPath)
    logger.info(`Saved thumbnail for program ${programId}: ${destPath}`)
    return destPath
  } catch (error) {
    logger.error(`Failed to save thumbnail for program ${programId}:`, error)
    throw error
  }
}

/**
 * Delete existing thumbnail files for a program (any extension)
 */
const deleteExistingThumbnail = (programId: string): void => {
  const thumbnailsDir = getThumbnailsPath()
  
  if (!fs.existsSync(thumbnailsDir)) {
    return
  }
  
  const files = fs.readdirSync(thumbnailsDir)
  const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
  
  for (const ext of extensions) {
    const fileName = `${programId}${ext}`
    if (files.includes(fileName)) {
      const filePath = path.join(thumbnailsDir, fileName)
      try {
        fs.unlinkSync(filePath)
        logger.info(`Deleted existing thumbnail: ${filePath}`)
      } catch (error) {
        logger.warn(`Failed to delete existing thumbnail: ${filePath}`, error)
      }
    }
  }
}

/**
 * Delete thumbnail for a program
 */
export const deleteThumbnail = (programId: string): void => {
  deleteExistingThumbnail(programId)
  updateProgramThumbnailPath(programId, null)
  logger.info(`Deleted thumbnail for program: ${programId}`)
}

export default {
  saveThumbnail,
  deleteThumbnail
}
