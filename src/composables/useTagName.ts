import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '../stores/libraryStore'
import { localizedName, type LocaleCode, type Tag } from '../types'

/**
 * Resolve a tag id to its name in the active UI language, falling back to
 * Korean. Returns '' for a null/unknown id.
 *
 * Returns functions rather than computeds so callers can resolve any id; they
 * read `locale` and the store reactively, so usages inside templates or
 * computeds stay reactive to both language changes and tag edits.
 */
export const useTagName = () => {
  const { locale } = useI18n()
  const libraryStore = useLibraryStore()

  const resolveTagName = (tagId: string | null | undefined): string => {
    if (!tagId) return ''
    const tag = libraryStore.tagMap.get(tagId)
    return tag ? localizedName(tag.names, locale.value as LocaleCode) : ''
  }

  return { resolveTagName }
}

/**
 * All searchable text for a tag — every localized name plus the hidden keyword.
 * Used for local filtering (e.g. the tag manager / tag picker) so a tag is found
 * by any of its names or its keyword regardless of the active language.
 */
export const tagSearchBlob = (tag: Tag): string =>
  `${Object.values(tag.names).filter(Boolean).join('\n')}\n${tag.keyword}`.toLowerCase()
