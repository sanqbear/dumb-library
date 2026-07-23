/**
 * Testbed entry — installs the mock `window.electron` bridge, then hands off to
 * the real app entry. Import order matters: the bridge must exist before
 * `../main` mounts the app and its stores start calling it.
 */
import { installMockElectron, resetTestbedData } from './mockElectron'

installMockElectron()

// Let the shell page wipe seeded state without reaching into the iframe's
// localStorage itself.
window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as { source?: string; type?: string } | null
  if (data?.source === 'waifu-testbed-shell' && data.type === 'reset') {
    resetTestbedData()
    window.location.reload()
  }
})

void import('../main')
