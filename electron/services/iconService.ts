import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { updateProgramIconPath } from './dataService'
import { processIcon, getIconsDir } from './imageService'
import logger from './logger'
import { app } from 'electron'

const execFileAsync = promisify(execFile)

/**
 * Extract icon from Windows executable using PowerShell (.NET System.Drawing),
 * then pipe through sharp to produce a normalized 256x256 webp.
 * Returns userData-relative path (e.g., "icons/<id>.webp") or null on failure.
 */
export const extractIcon = async (executablePath: string, programId: string): Promise<string | null> => {
  if (!fs.existsSync(executablePath)) {
    logger.warn(`Executable not found: ${executablePath}`)
    return null
  }

  // PowerShell extracts to a temp .png, then sharp downscales/converts to webp.
  const tempPngPath = path.join(app.getPath('temp'), `extract-icon-${programId}.png`)
  const tempScriptPath = path.join(app.getPath('temp'), `extract-icon-${programId}.ps1`)

  // Paths are passed via env vars (not string interpolation) to eliminate
  // PowerShell injection risk and to handle paths containing quotes/special chars.
  const psScript = `
Add-Type -AssemblyName System.Drawing
try {
    $exePath = $env:WL_EXE_PATH
    $outPath = $env:WL_OUT_PATH
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exePath)
    if ($icon) {
        $bitmap = $icon.ToBitmap()
        $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bitmap.Dispose()
        $icon.Dispose()
        Write-Output "success"
    } else {
        Write-Output "failed"
    }
} catch {
    Write-Output "error: $_"
}
`

  const cleanupTemps = () => {
    for (const p of [tempScriptPath, tempPngPath]) {
      try { if (fs.existsSync(p)) fs.unlinkSync(p) } catch { /* ignore */ }
    }
  }

  try {
    fs.writeFileSync(tempScriptPath, psScript, { encoding: 'utf8' })

    const { stdout, stderr } = await execFileAsync('powershell', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', tempScriptPath
    ], {
      timeout: 15000,
      env: {
        ...process.env,
        WL_EXE_PATH: executablePath,
        WL_OUT_PATH: tempPngPath
      }
    })

    if (stderr) {
      logger.warn(`PowerShell stderr: ${stderr}`)
    }

    const result = stdout.trim()
    if (result !== 'success' || !fs.existsSync(tempPngPath)) {
      logger.warn(`Failed to extract icon for: ${executablePath}, result: ${result}`)
      cleanupTemps()
      return null
    }

    const relPath = await processIcon(tempPngPath, programId)
    updateProgramIconPath(programId, relPath)
    logger.info(`Extracted icon for program ${programId}: ${relPath}`)
    cleanupTemps()
    return relPath
  } catch (error) {
    logger.error(`Error extracting icon from ${executablePath}:`, error)
    cleanupTemps()
    return null
  }
}

/**
 * Save a user-provided image as a program icon (256x256 webp).
 * Returns userData-relative path (e.g., "icons/<id>.webp").
 */
export const saveIcon = async (programId: string, imagePath: string): Promise<string> => {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`)
  }
  const relPath = await processIcon(imagePath, programId)
  updateProgramIconPath(programId, relPath)
  return relPath
}

/**
 * Delete icon file(s) for a program and clear the DB pointer.
 */
export const deleteIcon = (programId: string): void => {
  const iconsDir = getIconsDir()
  if (fs.existsSync(iconsDir)) {
    const prefix = `${programId}.`
    try {
      for (const file of fs.readdirSync(iconsDir)) {
        if (file.startsWith(prefix)) {
          try {
            fs.unlinkSync(path.join(iconsDir, file))
          } catch (error) {
            logger.warn(`Failed to delete icon file ${file}:`, error)
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to scan icons dir:`, error)
    }
  }
  updateProgramIconPath(programId, null)
  logger.info(`Deleted icon for program: ${programId}`)
}

export default {
  extractIcon,
  saveIcon,
  deleteIcon
}
