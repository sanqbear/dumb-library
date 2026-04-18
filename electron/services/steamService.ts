import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { processThumbnail } from './imageService'
import logger from './logger'
import type { SteamGame } from '../../src/types'

const execFileAsync = promisify(execFile)

// ---- VDF / ACF parsing ------------------------------------------------------

// Valve's KeyValues format uses "key" "value" pairs with nested blocks.
// We only need specific keys, so regex extraction is sufficient (and avoids
// pulling in a dependency for a 50-line format).

const unescapeVdfString = (value: string): string => {
  return value.replace(/\\\\/g, '\\').replace(/\\"/g, '"')
}

const extractAllPaths = (content: string): string[] => {
  const re = /"path"\s+"([^"]*)"/gi
  const results: string[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    results.push(unescapeVdfString(match[1]))
  }
  return results
}

const parseAppManifest = (content: string): { appId: number; name: string } | null => {
  const appIdMatch = content.match(/"appid"\s+"(\d+)"/i)
  const nameMatch = content.match(/"name"\s+"([^"]*)"/i)
  if (!appIdMatch || !nameMatch) return null
  const appId = parseInt(appIdMatch[1], 10)
  if (!Number.isFinite(appId) || appId <= 0) return null
  return { appId, name: unescapeVdfString(nameMatch[1]) }
}

// ---- Steam install discovery -----------------------------------------------

const STEAM_FALLBACK_PATHS = [
  'C:\\Program Files (x86)\\Steam',
  'C:\\Program Files\\Steam'
]

const findSteamPath = async (): Promise<string | null> => {
  try {
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile',
      '-Command',
      '(Get-ItemProperty -Path "HKCU:\\Software\\Valve\\Steam" -Name "SteamPath" -ErrorAction Stop).SteamPath'
    ], { timeout: 5000 })
    const raw = stdout.trim()
    if (raw) {
      // Registry value uses forward slashes; normalize to OS separators.
      const normalized = path.normalize(raw)
      if (fs.existsSync(normalized)) return normalized
    }
  } catch (error) {
    logger.debug('Steam registry lookup failed, trying fallbacks:', error)
  }

  for (const candidate of STEAM_FALLBACK_PATHS) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

// ---- Installed game scanning -----------------------------------------------

export const scanInstalledGames = async (): Promise<SteamGame[]> => {
  const steamPath = await findSteamPath()
  if (!steamPath) {
    logger.info('Steam installation not found')
    return []
  }

  const libraryFoldersVdf = path.join(steamPath, 'steamapps', 'libraryfolders.vdf')
  const libraryPaths: string[] = []

  if (fs.existsSync(libraryFoldersVdf)) {
    try {
      const content = fs.readFileSync(libraryFoldersVdf, 'utf-8')
      libraryPaths.push(...extractAllPaths(content))
    } catch (error) {
      logger.warn('Failed to read libraryfolders.vdf:', error)
    }
  }

  // Always include the main Steam install dir as a library.
  if (!libraryPaths.some(p => path.resolve(p) === path.resolve(steamPath))) {
    libraryPaths.unshift(steamPath)
  }

  const games: SteamGame[] = []
  const seenAppIds = new Set<number>()

  for (const libPath of libraryPaths) {
    const steamappsDir = path.join(libPath, 'steamapps')
    if (!fs.existsSync(steamappsDir)) continue

    let files: string[]
    try {
      files = fs.readdirSync(steamappsDir)
    } catch (error) {
      logger.warn(`Failed to read ${steamappsDir}:`, error)
      continue
    }

    for (const file of files) {
      if (!file.startsWith('appmanifest_') || !file.endsWith('.acf')) continue

      const manifestPath = path.join(steamappsDir, file)
      try {
        const acfContent = fs.readFileSync(manifestPath, 'utf-8')
        const parsed = parseAppManifest(acfContent)
        if (!parsed) continue
        // Skip Steamworks Common Redistributables and similar non-game entries
        if (parsed.appId < 10) continue
        if (seenAppIds.has(parsed.appId)) continue
        seenAppIds.add(parsed.appId)
        games.push({
          appId: parsed.appId,
          name: parsed.name,
          installDir: libPath
        })
      } catch (error) {
        logger.warn(`Failed to parse ${file}:`, error)
      }
    }
  }

  games.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  logger.info(`Scanned ${games.length} Steam games from ${libraryPaths.length} libraries`)
  return games
}

// ---- Thumbnail download ----------------------------------------------------

const THUMBNAIL_URL_CANDIDATES = (appId: number): string[] => [
  `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900_2x.jpg`,
  `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`,
  `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`,
  `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`,
  `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`
]

const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<Buffer | null> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export const downloadSteamThumbnail = async (appId: number, programId: string): Promise<string | null> => {
  for (const url of THUMBNAIL_URL_CANDIDATES(appId)) {
    const buffer = await fetchWithTimeout(url, 15000)
    if (buffer && buffer.length > 0) {
      try {
        const relPath = await processThumbnail(buffer, programId)
        logger.info(`Downloaded Steam thumbnail for appId ${appId} from ${url} -> ${relPath}`)
        return relPath
      } catch (error) {
        logger.warn(`Failed to process Steam thumbnail from ${url}:`, error)
        // try next candidate
      }
    }
  }

  logger.warn(`No thumbnail found for Steam appId ${appId}`)
  return null
}

// ---- Local icon lookup ------------------------------------------------------

const ICON_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

/**
 * Look inside Steam's local library cache for an app icon. Supports both layouts:
 * - Newer: {steam}/appcache/librarycache/{appid}/<hashed>.jpg
 * - Legacy: {steam}/appcache/librarycache/{appid}_icon.jpg
 *
 * ICO files are ignored per product decision (sharp decoding is spotty).
 * Returns the best-match absolute path, or null if nothing suitable is found.
 */
export const findSteamIcon = async (appId: number): Promise<string | null> => {
  const steamPath = await findSteamPath()
  if (!steamPath) return null

  const candidates: string[] = []

  const appSubdir = path.join(steamPath, 'appcache', 'librarycache', String(appId))
  if (fs.existsSync(appSubdir)) {
    try {
      for (const file of fs.readdirSync(appSubdir)) {
        if (ICON_IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase())) {
          candidates.push(path.join(appSubdir, file))
        }
      }
    } catch (error) {
      logger.warn(`Failed to scan ${appSubdir}:`, error)
    }
  }

  const libraryCacheDir = path.join(steamPath, 'appcache', 'librarycache')
  if (fs.existsSync(libraryCacheDir)) {
    try {
      const prefix = `${appId}_`
      for (const file of fs.readdirSync(libraryCacheDir)) {
        if (!file.startsWith(prefix)) continue
        if (ICON_IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase())) {
          candidates.push(path.join(libraryCacheDir, file))
        }
      }
    } catch (error) {
      logger.warn(`Failed to scan ${libraryCacheDir}:`, error)
    }
  }

  if (candidates.length === 0) {
    logger.info(`No Steam cache icon found for appId ${appId}`)
    return null
  }

  // Prefer filenames hinting at an icon; fall back to logo; then anything.
  const score = (p: string): number => {
    const name = path.basename(p).toLowerCase()
    if (name.includes('icon')) return 0
    if (name.includes('logo')) return 1
    return 10
  }
  candidates.sort((a, b) => score(a) - score(b))
  logger.info(`Selected Steam icon candidate: ${candidates[0]}`)
  return candidates[0]
}

export default {
  scanInstalledGames,
  downloadSteamThumbnail,
  findSteamIcon
}
