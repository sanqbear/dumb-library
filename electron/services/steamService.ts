import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { getThumbnailsPath, ensureDirectories } from './dataService'
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
  ensureDirectories()
  const destPath = path.join(getThumbnailsPath(), `${programId}.jpg`)

  for (const url of THUMBNAIL_URL_CANDIDATES(appId)) {
    const buffer = await fetchWithTimeout(url, 15000)
    if (buffer && buffer.length > 0) {
      try {
        fs.writeFileSync(destPath, buffer)
        logger.info(`Downloaded Steam thumbnail for appId ${appId} from ${url}`)
        return destPath
      } catch (error) {
        logger.warn(`Failed to write thumbnail file: ${destPath}`, error)
        return null
      }
    }
  }

  logger.warn(`No thumbnail found for Steam appId ${appId}`)
  return null
}

export default {
  scanInstalledGames,
  downloadSteamThumbnail
}
