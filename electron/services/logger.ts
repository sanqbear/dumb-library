import log from 'electron-log'
import { app } from 'electron'
import path from 'path'

// Configure electron-log
log.transports.file.level = 'info'
log.transports.console.level = 'debug'

// Set log file path
log.transports.file.resolvePathFn = () => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'logs', 'app.log')
}

// Log format
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'
log.transports.console.format = '[{level}] {text}'

// Export logger instance
export const logger = {
  info: (message: string, ...args: unknown[]) => {
    log.info(message, ...args)
  },
  warn: (message: string, ...args: unknown[]) => {
    log.warn(message, ...args)
  },
  error: (message: string, ...args: unknown[]) => {
    log.error(message, ...args)
  },
  debug: (message: string, ...args: unknown[]) => {
    log.debug(message, ...args)
  }
}

export default logger
