import { app } from 'electron'
import path from 'path'

// Anchor used to resolve/serialize executablePath values.
// In a portable build (electron-builder portable target), PORTABLE_EXECUTABLE_DIR
// points at the directory containing the portable .exe; we anchor there so a
// USB-installed library stays self-contained. In an installed build that env
// var is absent and we fall back to userData (where library.json lives).
export const getExecutableAnchor = (): string => {
  return process.env.PORTABLE_EXECUTABLE_DIR ?? app.getPath('userData')
}

export const isProtocolUrl = (value: string): boolean => {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
}

// Resolve a stored executablePath to an absolute path for filesystem use.
// Protocol URLs and absolute paths pass through unchanged; relative values
// are resolved against the current anchor.
export const resolveExecutablePath = (stored: string): string => {
  if (!stored) return stored
  if (isProtocolUrl(stored)) return stored
  if (path.isAbsolute(stored)) return stored
  return path.resolve(getExecutableAnchor(), stored)
}

// Normalize an executablePath for storage in library.json.
// In portable mode, an absolute path inside the anchor is rewritten to a
// posix-style relative path so the library survives being moved with its
// portable host. In installed mode the anchor (userData) is rarely a useful
// base, so absolute paths are kept as-is.
export const normalizeExecutablePathForStorage = (value: string): string => {
  if (!value) return value
  if (isProtocolUrl(value)) return value
  if (!path.isAbsolute(value)) return value.replace(/\\/g, '/')
  if (!process.env.PORTABLE_EXECUTABLE_DIR) return value
  const anchor = path.resolve(process.env.PORTABLE_EXECUTABLE_DIR)
  const rel = path.relative(anchor, path.resolve(value))
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return value
  return rel.replace(/\\/g, '/')
}
