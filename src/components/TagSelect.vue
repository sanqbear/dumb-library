<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect } from 'naive-ui'
import type { SelectOption } from 'naive-ui'
import { useLibraryStore } from '../stores/libraryStore'
import { useTagName, tagSearchBlob } from '../composables/useTagName'
import type { LocaleCode, LocalizedName } from '../types'

// Tag picker bound to tag IDs. Options are the localized master tags; the user
// can filter across all languages + keyword and inline-create new tags.
const props = defineProps<{
  value: string[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:value': [value: string[]]
}>()

const { t, locale } = useI18n()
const libraryStore = useLibraryStore()
const { resolveTagName } = useTagName()

// Sentinel for the synthetic "create the typed text as a new tag" option.
const CREATE_KEY = '__create_tag__'

// `:ignore-composition="false"` keeps NSelect's pattern synced during Hangul
// composition so `@search` fires live and the input isn't wiped. See docs:
// input & IME handling guidelines.
const searchText = ref('')
const onSearch = (query: string) => { searchText.value = query }

const nameMatchesExact = (names: LocalizedName, q: string): boolean =>
  Object.values(names).some(n => !!n && n.trim().toLowerCase() === q)

// Existing tags not already picked, filtered by the live query across every
// language + keyword. Selected chips resolve via fallbackOption, so they don't
// need to appear here.
const options = computed<SelectOption[]>(() => {
  const raw = searchText.value.trim()
  const q = raw.toLowerCase()
  const selected = new Set(props.value)

  const matched = libraryStore.allTags
    .filter(tag => !selected.has(tag.id))
    .filter(tag => !q || tagSearchBlob(tag).includes(q))
    .map<SelectOption>(tag => ({ label: resolveTagName(tag.id), value: tag.id }))

  const existsExact = libraryStore.allTags.some(tag => nameMatchesExact(tag.names, q))
  if (raw && !existsExact) {
    matched.unshift({ label: t('addDialog.tagAddLabel', { name: raw }), value: CREATE_KEY })
  }
  return matched
})

// Render selected chips (values are ids) by resolving each to its localized name.
const fallbackOption = (value: string | number): SelectOption => ({
  label: resolveTagName(String(value)) || String(value),
  value
})

// Create one or more tags from the typed text (split on ;/,), each named in the
// current UI language (ko is always set as the required fallback). Reuses an
// existing tag when one already carries the same name in any language.
async function createTags(text: string): Promise<string[]> {
  const parts = text.split(/[,;，；]/).map(s => s.trim()).filter(Boolean)
  const lang = locale.value as LocaleCode
  const ids: string[] = []
  for (const name of parts) {
    const existing = libraryStore.allTags.find(tag =>
      nameMatchesExact(tag.names, name.toLowerCase())
    )
    if (existing) { ids.push(existing.id); continue }
    const names: LocalizedName = { ko: name }
    if (lang !== 'ko') names[lang] = name
    const created = await libraryStore.addTag({ names })
    if (created) ids.push(created.id)
  }
  return ids
}

async function handleUpdate(values: string[]) {
  if (values.includes(CREATE_KEY)) {
    const rest = values.filter(v => v !== CREATE_KEY)
    const created = await createTags(searchText.value)
    const next = [...rest, ...created].filter((id, i, arr) => arr.indexOf(id) === i)
    emit('update:value', next)
  } else {
    emit('update:value', values)
  }
  searchText.value = ''
}
</script>

<template>
  <div class="tag-select">
    <NSelect
      multiple
      filterable
      :value="props.value"
      :options="options"
      :placeholder="props.placeholder"
      :filter="() => true"
      :fallback-option="fallbackOption"
      :ignore-composition="false"
      :show-arrow="false"
      @update:value="handleUpdate"
      @search="onSearch"
    />
  </div>
</template>

<style scoped>
/* Fill the field width so an empty tag input stays readable instead of
   collapsing to the (near-zero) width of its placeholder/content. */
.tag-select {
  width: 100%;
}

.tag-select :deep(.n-select) {
  width: 100%;
  min-width: 180px;
}
</style>
