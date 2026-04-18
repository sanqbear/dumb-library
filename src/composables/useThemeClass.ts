import { computed } from 'vue'
import { useSettingsStore } from '../stores/settingsStore'

/**
 * Reactive class binding for `light-theme`.
 *
 * Naive-ui modals teleport their content to `body` by default, so the
 * `.light-theme` class on `.app-container` never reaches modal descendants.
 * Apply this binding on a wrapper element inside a modal, then write CSS
 * as `.light-theme .foo { ... }` (no `:global()` — Vue already leaves the
 * first selector unscoped and only hashes the last one).
 */
export const useThemeClass = () => {
  const settingsStore = useSettingsStore()
  return computed(() => ({
    'light-theme': settingsStore.theme === 'light'
  }))
}
