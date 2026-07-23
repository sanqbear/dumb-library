<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NButton, NInput, NIcon, NEmpty, useMessage, useDialog } from 'naive-ui'
import { AddOutline as AddIcon, TrashOutline as TrashIcon, SearchOutline as SearchIcon } from '@vicons/ionicons5'
import { useLibraryStore } from '../../stores/libraryStore'
import { useTagName, tagSearchBlob } from '../../composables/useTagName'
import { useThemeClass } from '../../composables/useThemeClass'
import { SUPPORTED_LOCALES, LOCALE_META, missingLocaleNames } from '../../i18n'
import type { LocalizedName, LocaleCode } from '../../types'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', value: boolean): void }>()

const { t } = useI18n()
const libraryStore = useLibraryStore()
const { resolveTagName } = useTagName()
const message = useMessage()
const confirmDialog = useDialog()
const themeClass = useThemeClass()

// null selectedId = creating a new entry; otherwise editing that tag.
const selectedId = ref<string | null>(null)
const form = reactive<Record<LocaleCode, string>>({ ko: '', en: '', ja: '', 'zh-CN': '' })
const keyword = ref('')
const isSaving = ref(false)

// Search over the tag list. Matches across every language + keyword. `query` is
// bound to the field AND updated from the native `input` event so Hangul
// composition filters live without the re-render wiping the in-flight glyph
// (see IME input guideline / AppHeader tag search).
const query = ref('')
const handleSearchInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  if (target) query.value = target.value
}

const tags = computed(() => {
  const q = query.value.trim().toLowerCase()
  const all = libraryStore.allTags
  if (!q) return all
  return all.filter(tag => tagSearchBlob(tag).includes(q))
})

const clearForm = () => {
  for (const code of SUPPORTED_LOCALES) form[code] = ''
  keyword.value = ''
}

const startNew = () => {
  selectedId.value = null
  clearForm()
}

const selectTag = (id: string) => {
  const tag = libraryStore.tagMap.get(id)
  if (!tag) return
  selectedId.value = id
  for (const code of SUPPORTED_LOCALES) form[code] = tag.names[code] ?? ''
  keyword.value = tag.keyword ?? ''
}

// Reset to "new" mode (and clear the search) each time the dialog opens.
watch(() => props.show, (open) => {
  if (open) {
    query.value = ''
    startNew()
  }
})

const canSave = computed(() => form.ko.trim() !== '')

const buildNames = (): LocalizedName => {
  const names: LocalizedName = { ko: form.ko.trim() }
  for (const code of SUPPORTED_LOCALES) {
    if (code === 'ko') continue
    const value = form[code].trim()
    if (value) names[code] = value
  }
  return names
}

const handleSave = async () => {
  if (!canSave.value || isSaving.value) return
  isSaving.value = true
  try {
    const names = buildNames()
    const kw = keyword.value.trim()
    if (selectedId.value) {
      const updated = await libraryStore.updateTag({ id: selectedId.value, names, keyword: kw })
      if (updated) message.success(t('tag.updated'))
      else message.error(t('tag.saveFailed'))
    } else {
      const created = await libraryStore.addTag({ names, keyword: kw })
      if (created) {
        message.success(t('tag.added'))
        selectTag(created.id)
      } else {
        message.error(t('tag.saveFailed'))
      }
    }
  } finally {
    isSaving.value = false
  }
}

const handleDelete = (id: string) => {
  const tag = libraryStore.tagMap.get(id)
  if (!tag) return
  confirmDialog.warning({
    title: t('tag.deleteConfirmTitle'),
    content: t('tag.deleteConfirmMessage', { name: tag.names.ko }),
    positiveText: t('common.delete'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const ok = await libraryStore.deleteTag(id)
      if (ok) {
        message.success(t('tag.deleted'))
        if (selectedId.value === id) startNew()
      }
    }
  })
}

// Languages other than Korean, in display order — Korean gets a dedicated
// (required) field rendered first.
const otherLocales = computed(() => SUPPORTED_LOCALES.filter(c => c !== 'ko'))

// Tooltip listing the still-untranslated languages for a tag, or '' when every
// supported language has a name (the hidden keyword is not part of this check).
const incompleteTooltip = (names: LocalizedName): string => {
  const missing = missingLocaleNames(names)
  if (missing.length === 0) return ''
  return t('common.incompleteTranslations', {
    langs: missing.map(code => LOCALE_META[code].nativeName).join(', ')
  })
}
</script>

<template>
  <NModal
    :show="show"
    @update:show="emit('update:show', $event)"
    preset="card"
    :title="t('tag.manageTitle')"
    :bordered="false"
    size="medium"
    :style="{ width: '720px', maxWidth: '92vw' }"
  >
    <div class="tag-manager" :class="themeClass">
      <!-- Left: registered tags -->
      <div class="tag-list-pane">
        <div class="pane-header">
          <span class="pane-label">{{ t('tag.listLabel') }}</span>
          <NButton size="small" tertiary @click="startNew">
            <template #icon><NIcon :component="AddIcon" /></template>
            {{ t('tag.addNew') }}
          </NButton>
        </div>
        <!-- IME-aware live read via native @input on the wrapper. -->
        <div class="tag-search" @input="handleSearchInput">
          <NInput
            :value="query"
            :placeholder="t('header.tagSearchPlaceholder')"
            size="small"
            clearable
            @update:value="query = $event"
          >
            <template #prefix><NIcon :component="SearchIcon" /></template>
          </NInput>
        </div>
        <div class="tag-list">
          <NEmpty
            v-if="tags.length === 0"
            :description="query.trim() ? t('header.noMatchingTags') : t('tag.empty')"
            class="tag-empty"
          />
          <button
            v-for="tag in tags"
            :key="tag.id"
            type="button"
            class="tag-item"
            :class="{ 'is-active': tag.id === selectedId }"
            @click="selectTag(tag.id)"
          >
            <span class="tag-item-name truncate">{{ resolveTagName(tag.id) }}</span>
            <span class="tag-item-actions">
              <span
                v-if="incompleteTooltip(tag.names)"
                class="incomplete-dot"
                :title="incompleteTooltip(tag.names)"
              />
              <NButton
                size="tiny"
                quaternary
                circle
                type="error"
                class="tag-item-del"
                @click.stop="handleDelete(tag.id)"
              >
                <template #icon><NIcon :component="TrashIcon" /></template>
              </NButton>
            </span>
          </button>
        </div>
      </div>

      <!-- Right: localized name + keyword editor -->
      <div class="tag-editor-pane">
        <div class="field">
          <label class="field-label">
            {{ LOCALE_META.ko.nativeName }}
            <span class="req">*</span>
          </label>
          <NInput v-model:value="form.ko" :placeholder="t('tag.namePlaceholder')" clearable />
        </div>
        <div v-for="code in otherLocales" :key="code" class="field">
          <label class="field-label">{{ LOCALE_META[code].nativeName }}</label>
          <NInput v-model:value="form[code]" :placeholder="t('tag.namePlaceholder')" clearable />
        </div>
        <div class="field">
          <label class="field-label">{{ t('tag.keywordLabel') }}</label>
          <NInput v-model:value="keyword" :placeholder="t('tag.keywordPlaceholder')" clearable />
          <span class="field-hint">{{ t('tag.keywordHint') }}</span>
        </div>
        <p class="field-hint">{{ t('tag.koRequired') }}</p>
        <div class="editor-actions">
          <NButton type="primary" :disabled="!canSave" :loading="isSaving" @click="handleSave">
            {{ t('common.save') }}
          </NButton>
        </div>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.tag-manager {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 20px;
  min-height: 320px;
}

@media (max-width: 620px) {
  .tag-manager {
    grid-template-columns: 1fr;
  }
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.pane-label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #a1a1aa;
}

.light-theme .pane-label {
  color: #71717a;
}

.tag-search {
  margin-bottom: 8px;
}

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;
}

.tag-empty {
  margin-top: 32px;
}

.tag-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background-color: #3f3f46;
  color: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.light-theme .tag-item {
  background-color: #f4f4f5;
}

.tag-item:hover {
  background-color: #52525b;
}

.light-theme .tag-item:hover {
  background-color: #e4e4e7;
}

.tag-item.is-active {
  border-color: #ab4aba;
}

.tag-item-name {
  min-width: 0;
}

.tag-item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

/* Amber dot marking an entry whose translations aren't all filled in. Stays
   visible (unlike the hover-only delete button) so gaps are scannable. */
.incomplete-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #eab308;
  flex-shrink: 0;
}

.light-theme .incomplete-dot {
  background-color: #ca8a04;
}

.tag-item-del {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.tag-item:hover .tag-item-del,
.tag-item.is-active .tag-item-del {
  opacity: 1;
}

.tag-editor-pane {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: #a1a1aa;
}

.light-theme .field-label {
  color: #52525b;
}

.req {
  color: #d6a9dd;
}

.light-theme .req {
  color: #953ea3;
}

.field-hint {
  margin: 0;
  font-size: 0.72rem;
  color: #a1a1aa;
}

.light-theme .field-hint {
  color: #71717a;
}

.editor-actions {
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
}
</style>
