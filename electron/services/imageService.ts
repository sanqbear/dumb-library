import sharp from 'sharp'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import logger from './logger'

const TEMP_FETCH_PREFIX = 'wl-fetch-'
const MAX_FETCH_BYTES = 20 * 1024 * 1024 // 20MB — plenty for any cover/icon source

// All sizes in output pixels. webp @ 85% gives ~40-50% of PNG source at same visual quality.
const THUMBNAIL_WIDTH = 600
const THUMBNAIL_HEIGHT = 900
const ICON_SIZE = 256
const WEBP_QUALITY = 85

const getUserDataPath = () => app.getPath('userData')
export const getThumbnailsDir = () => path.join(getUserDataPath(), 'thumbnails')
export const getIconsDir = () => path.join(getUserDataPath(), 'icons')

const ensureDir = (dir: string): void => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// Delete any files matching "<id>.*" in the given directory. Used to purge
// legacy .png/.jpg/etc. when replacing with a new .webp.
const cleanupLegacyFiles = (dir: string, id: string): void => {
  if (!fs.existsSync(dir)) return
  const prefix = `${id}.`
  try {
    for (const file of fs.readdirSync(dir)) {
      if (file.startsWith(prefix)) {
        try {
          fs.unlinkSync(path.join(dir, file))
        } catch (error) {
          logger.warn(`Failed to cleanup ${file}:`, error)
        }
      }
    }
  } catch (error) {
    logger.warn(`Failed to scan ${dir} for cleanup:`, error)
  }
}

/**
 * Process a source image into a 600x900 webp thumbnail.
 * Source may be an absolute file path or a Buffer.
 * Returns the path relative to userData (e.g., "thumbnails/<id>.webp").
 */
export const processThumbnail = async (
  source: string | Buffer,
  programId: string
): Promise<string> => {
  const dir = getThumbnailsDir()
  ensureDir(dir)
  cleanupLegacyFiles(dir, programId)

  const destFile = `${programId}.webp`
  const destAbs = path.join(dir, destFile)

  await sharp(source)
    .rotate() // honor EXIF orientation
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: 'cover', position: 'centre' })
    .webp({ quality: WEBP_QUALITY })
    .toFile(destAbs)

  logger.info(`Processed thumbnail: ${destAbs}`)
  return `thumbnails/${destFile}`
}

/**
 * Process a source image into a 256x256 webp icon (square crop).
 */
export const processIcon = async (
  source: string | Buffer,
  programId: string
): Promise<string> => {
  const dir = getIconsDir()
  ensureDir(dir)
  cleanupLegacyFiles(dir, programId)

  const destFile = `${programId}.webp`
  const destAbs = path.join(dir, destFile)

  await sharp(source)
    .rotate()
    .resize(ICON_SIZE, ICON_SIZE, { fit: 'cover', position: 'centre' })
    .webp({ quality: WEBP_QUALITY })
    .toFile(destAbs)

  logger.info(`Processed icon: ${destAbs}`)
  return `icons/${destFile}`
}

/**
 * Read an image from an absolute path and return a data: URL.
 * Used by the renderer for previewing user-selected source files before commit.
 */
export const readImageAsDataUrl = async (absPath: string): Promise<string | null> => {
  try {
    if (!fs.existsSync(absPath)) return null
    const buffer = fs.readFileSync(absPath)
    const ext = path.extname(absPath).toLowerCase()
    const mime =
      ext === '.png' ? 'image/png' :
      ext === '.gif' ? 'image/gif' :
      ext === '.bmp' ? 'image/bmp' :
      ext === '.webp' ? 'image/webp' :
      'image/jpeg'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch (error) {
    logger.warn(`Failed to read image as data URL: ${absPath}`, error)
    return null
  }
}

/**
 * Delete an image by its userData-relative path.
 */
/**
 * Download an image from an http(s) URL to a temp file and return the absolute path.
 * Intended for the "URL 직접 입력" flow — renderer then treats the temp path like
 * any other selected source (preview + processThumbnail on commit).
 */
export const fetchImageFromUrl = async (url: string): Promise<string | null> => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    logger.warn(`Rejected malformed image URL: ${url}`)
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    logger.warn(`Rejected non-http(s) image URL: ${url}`)
    return null
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      logger.warn(`Image fetch failed (${res.status}): ${url}`)
      return null
    }
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
    if (contentType && !contentType.startsWith('image/')) {
      logger.warn(`URL content-type is not image (${contentType}): ${url}`)
      return null
    }
    const arrayBuffer = await res.arrayBuffer()
    if (arrayBuffer.byteLength > MAX_FETCH_BYTES) {
      logger.warn(`Fetched image exceeds size limit (${arrayBuffer.byteLength}): ${url}`)
      return null
    }
    const buffer = Buffer.from(arrayBuffer)

    const tempDir = app.getPath('temp')
    const tempFile = path.join(tempDir, `${TEMP_FETCH_PREFIX}${randomUUID()}.bin`)
    fs.writeFileSync(tempFile, buffer)
    return tempFile
  } catch (error) {
    logger.warn(`Failed to fetch image from URL: ${url}`, error)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Write an in-memory buffer to a temp file and return its absolute path.
 * Used by the renderer to hand cropped image bytes back to main as a
 * source path that the normal save pipeline can consume.
 */
export const writeTempBuffer = async (buffer: Buffer): Promise<string> => {
  const tempDir = app.getPath('temp')
  const tempFile = path.join(tempDir, `${TEMP_FETCH_PREFIX}${randomUUID()}.bin`)
  fs.writeFileSync(tempFile, buffer)
  return tempFile
}

/**
 * Delete stale temp image files left from previous URL-fetch/drop flows.
 * Called on app start.
 */
export const cleanupTempImages = (): void => {
  try {
    const tempDir = app.getPath('temp')
    if (!fs.existsSync(tempDir)) return
    for (const file of fs.readdirSync(tempDir)) {
      if (file.startsWith(TEMP_FETCH_PREFIX)) {
        try { fs.unlinkSync(path.join(tempDir, file)) } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}

export const deleteImage = (relPath: string): void => {
  try {
    const abs = path.join(getUserDataPath(), relPath)
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs)
      logger.info(`Deleted image: ${abs}`)
    }
  } catch (error) {
    logger.warn(`Failed to delete image: ${relPath}`, error)
  }
}

export default {
  processThumbnail,
  processIcon,
  readImageAsDataUrl,
  fetchImageFromUrl,
  writeTempBuffer,
  cleanupTempImages,
  deleteImage,
  getThumbnailsDir,
  getIconsDir
}
