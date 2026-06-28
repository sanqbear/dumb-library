import sharp from 'sharp'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import logger from './logger'

const TEMP_FETCH_PREFIX = 'wl-fetch-'
const MAX_FETCH_BYTES = 20 * 1024 * 1024 // 20MB — plenty for any cover/icon source

// Read a fetch Response body into a Buffer, but never accumulate more than
// `maxBytes`. Rejects early using the Content-Length header when present, then
// guards again while streaming (a server may lie or omit the header). Returns
// null when the cap is exceeded or the body can't be read, so a malformed or
// hostile response can't blow up main-process memory. Shared by the URL-image
// flow and the Steam thumbnail downloader.
export const readResponseCapped = async (
  res: Response,
  maxBytes: number
): Promise<Buffer | null> => {
  const lenHeader = res.headers.get('content-length')
  if (lenHeader) {
    const declared = Number(lenHeader)
    if (Number.isFinite(declared) && declared > maxBytes) {
      logger.warn(`Response Content-Length ${declared} exceeds cap ${maxBytes}`)
      return null
    }
  }

  if (!res.body) {
    const arrayBuffer = await res.arrayBuffer()
    if (arrayBuffer.byteLength > maxBytes) return null
    return Buffer.from(arrayBuffer)
  }

  const reader = res.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > maxBytes) {
        logger.warn(`Streamed response exceeded cap ${maxBytes}, aborting`)
        try { await reader.cancel() } catch { /* ignore */ }
        return null
      }
      chunks.push(Buffer.from(value))
    }
  }
  return Buffer.concat(chunks)
}

// All sizes in output pixels. webp @ 85% gives ~40-50% of PNG source at same visual quality.
const THUMBNAIL_WIDTH = 600
const THUMBNAIL_HEIGHT = 900
const ICON_SIZE = 256
const PREVIEW_WIDTH = 1280
const PREVIEW_HEIGHT = 720
const WEBP_QUALITY = 85

const getUserDataPath = () => app.getPath('userData')
export const getThumbnailsDir = () => path.join(getUserDataPath(), 'thumbnails')
export const getIconsDir = () => path.join(getUserDataPath(), 'icons')
export const getPreviewsDir = () => path.join(getUserDataPath(), 'previews')

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
 * Process a source image into a 1280x720 (16:9) webp preview image.
 * Unlike thumbnails/icons there can be several per program, so the filename
 * carries a random suffix and the caller tracks the returned path in an array.
 * Returns the path relative to userData (e.g., "previews/<id>-<uuid>.webp").
 */
export const processPreview = async (
  source: string | Buffer,
  programId: string
): Promise<string> => {
  const dir = getPreviewsDir()
  ensureDir(dir)

  const destFile = `${programId}-${randomUUID()}.webp`
  const destAbs = path.join(dir, destFile)

  await sharp(source)
    .rotate()
    .resize(PREVIEW_WIDTH, PREVIEW_HEIGHT, { fit: 'cover', position: 'centre' })
    .webp({ quality: WEBP_QUALITY })
    .toFile(destAbs)

  logger.info(`Processed preview: ${destAbs}`)
  return `previews/${destFile}`
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
    const buffer = await readResponseCapped(res, MAX_FETCH_BYTES)
    if (!buffer) {
      logger.warn(`Fetched image exceeds size limit or could not be read: ${url}`)
      return null
    }

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
  processPreview,
  readImageAsDataUrl,
  fetchImageFromUrl,
  writeTempBuffer,
  cleanupTempImages,
  deleteImage,
  getThumbnailsDir,
  getIconsDir,
  getPreviewsDir
}
