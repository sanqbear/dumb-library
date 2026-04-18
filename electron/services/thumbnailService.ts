import { processThumbnail, deleteImage, getThumbnailsDir } from './imageService'
import { updateProgramThumbnailPath } from './dataService'
import fs from 'fs'
import path from 'path'
import logger from './logger'

/**
 * Save a thumbnail for a program — processes through sharp to produce a
 * normalized 600x900 webp and stores under userData/thumbnails.
 * Returns the userData-relative path (e.g., "thumbnails/<id>.webp").
 */
export const saveThumbnail = async (programId: string, imagePath: string): Promise<string> => {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`)
  }

  const relPath = await processThumbnail(imagePath, programId)
  updateProgramThumbnailPath(programId, relPath)
  return relPath
}

/**
 * Save a thumbnail from an in-memory buffer (e.g., downloaded from a URL).
 */
export const saveThumbnailFromBuffer = async (programId: string, buffer: Buffer): Promise<string> => {
  const relPath = await processThumbnail(buffer, programId)
  updateProgramThumbnailPath(programId, relPath)
  return relPath
}

/**
 * Delete thumbnail files for a program (any extension) and clear the DB pointer.
 */
export const deleteThumbnail = (programId: string): void => {
  const dir = getThumbnailsDir()
  if (fs.existsSync(dir)) {
    const prefix = `${programId}.`
    try {
      for (const file of fs.readdirSync(dir)) {
        if (file.startsWith(prefix)) {
          deleteImage(`thumbnails/${file}`)
        }
      }
    } catch (error) {
      logger.warn(`Failed to scan thumbnails dir:`, error)
    }
  }
  updateProgramThumbnailPath(programId, null)
  logger.info(`Deleted thumbnail for program: ${programId}`)
}

export default {
  saveThumbnail,
  saveThumbnailFromBuffer,
  deleteThumbnail
}
