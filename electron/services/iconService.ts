import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { getIconsPath, ensureDirectories, updateProgramIconPath } from './dataService'
import logger from './logger'
import { app } from 'electron'

const execFileAsync = promisify(execFile)

/**
 * Extract icon from Windows executable using PowerShell
 * Uses .NET System.Drawing to extract and save as PNG
 */
export const extractIcon = async (executablePath: string, programId: string): Promise<string | null> => {
  ensureDirectories()
  
  if (!fs.existsSync(executablePath)) {
    logger.warn(`Executable not found: ${executablePath}`)
    return null
  }
  
  const iconsDir = getIconsPath()
  const destPath = path.join(iconsDir, `${programId}.png`)

  // Create a temporary PowerShell script file
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

  try {
    // Write script to temp file
    fs.writeFileSync(tempScriptPath, psScript, { encoding: 'utf8' })

    // Execute PowerShell script
    const { stdout, stderr } = await execFileAsync('powershell', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', tempScriptPath
    ], {
      timeout: 15000,
      env: {
        ...process.env,
        WL_EXE_PATH: executablePath,
        WL_OUT_PATH: destPath
      }
    })
    
    // Clean up temp script
    try {
      fs.unlinkSync(tempScriptPath)
    } catch {
      // Ignore cleanup errors
    }
    
    if (stderr) {
      logger.warn(`PowerShell stderr: ${stderr}`)
    }
    
    const result = stdout.trim()
    if (result === 'success' && fs.existsSync(destPath)) {
      updateProgramIconPath(programId, destPath)
      logger.info(`Extracted icon for program ${programId}: ${destPath}`)
      return destPath
    } else {
      logger.warn(`Failed to extract icon for: ${executablePath}, result: ${result}`)
      return null
    }
  } catch (error) {
    logger.error(`Error extracting icon from ${executablePath}:`, error)
    // Clean up temp script on error
    try {
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath)
      }
    } catch {
      // Ignore cleanup errors
    }
    return null
  }
}

/**
 * Delete icon for a program
 */
export const deleteIcon = (programId: string): void => {
  const iconsDir = getIconsPath()
  const iconPath = path.join(iconsDir, `${programId}.png`)
  
  if (fs.existsSync(iconPath)) {
    try {
      fs.unlinkSync(iconPath)
      updateProgramIconPath(programId, null)
      logger.info(`Deleted icon for program: ${programId}`)
    } catch (error) {
      logger.warn(`Failed to delete icon: ${iconPath}`, error)
    }
  }
}

export default {
  extractIcon,
  deleteIcon
}
