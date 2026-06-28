import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '../stores/libraryStore'
import { localizedName, type LocaleCode } from '../types'

/**
 * Resolve a developer (circle) id to its name in the active UI language,
 * falling back to Korean. Returns '' for a null/unknown id.
 *
 * Returns a function rather than a computed so callers can resolve any id;
 * it reads `locale` and the store reactively, so usages inside templates or
 * computeds stay reactive to both language changes and developer edits.
 */
export const useDeveloperName = () => {
  const { locale } = useI18n()
  const libraryStore = useLibraryStore()

  const resolveDeveloperName = (developerId: string | null | undefined): string => {
    if (!developerId) return ''
    const dev = libraryStore.developerMap.get(developerId)
    return dev ? localizedName(dev.names, locale.value as LocaleCode) : ''
  }

  return { resolveDeveloperName }
}
