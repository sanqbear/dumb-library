<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NButton, NInput, NIcon, NEmpty, useMessage, useDialog } from 'naive-ui'
import { AddOutline as AddIcon, TrashOutline as TrashIcon } from '@vicons/ionicons5'
import { useLibraryStore } from '../../stores/libraryStore'
import { useThemeClass } from '../../composables/useThemeClass'
import { SUPPORTED_LOCALES, LOCALE_META } from '../../i18n'
import type { LocalizedName, LocaleCode } from '../../types'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', value: boolean): void }>()

const { t } = useI18n()
const libraryStore = useLibraryStore()
const message = useMessage()
const confirmDialog = useDialog()
const themeClass = useThemeClass()

// null selectedId = creating a new entry; otherwise editing that developer.
const selectedId = ref<string | null>(null)
const form = reactive<Record<LocaleCode, string>>({ ko: '', en: '', ja: '', 'zh-CN': '' })
const isSaving = ref(false)

const developers = computed(() => libraryStore.developers)

const clearForm = () => {
  for (const code of SUPPORTED_LOCALES) form[code] = ''
}

const startNew = () => {
  selectedId.value = null
  clearForm()
}

const selectDeveloper = (id: string) => {
  const dev = libraryStore.developerMap.get(id)
  if (!dev) return
  selectedId.value = id
  for (const code of SUPPORTED_LOCALES) form[code] = dev.names[code] ?? ''
}

// Reset to "new" mode each time the dialog opens.
watch(() => props.show, (open) => { if (open) startNew() })

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
    if (selectedId.value) {
      const updated = await libraryStore.updateDeveloper({ id: selectedId.value, names })
      if (updated) message.success(t('developer.updated'))
      else message.error(t('developer.saveFailed'))
    } else {
      const created = await libraryStore.addDeveloper({ names })
      if (created) {
        message.success(t('developer.added'))
        selectDeveloper(created.id)
      } else {
        message.error(t('developer.saveFailed'))
      }
    }
  } finally {
    isSaving.value = false
  }
}

const handleDelete = (id: string) => {
  const dev = libraryStore.developerMap.get(id)
  if (!dev) return
  confirmDialog.warning({
    title: t('developer.deleteConfirmTitle'),
    content: t('developer.deleteConfirmMessage', { name: dev.names.ko }),
    positiveText: t('common.delete'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const ok = await libraryStore.deleteDeveloper(id)
      if (ok) {
        message.success(t('developer.deleted'))
        if (selectedId.value === id) startNew()
      }
    }
  })
}

// Languages other than Korean, in display order — Korean gets a dedicated
// (required) field rendered first.
const otherLocales = computed(() => SUPPORTED_LOCALES.filter(c => c !== 'ko'))
</script>

<template>
  <NModal
    :show="show"
    @update:show="emit('update:show', $event)"
    preset="card"
    :title="t('developer.manageTitle')"
    :bordered="false"
    size="medium"
    :style="{ width: '720px', maxWidth: '92vw' }"
  >
    <div class="dev-manager" :class="themeClass">
      <!-- Left: registered developers -->
      <div class="dev-list-pane">
        <div class="pane-header">
          <span class="pane-label">{{ t('developer.listLabel') }}</span>
          <NButton size="small" tertiary @click="startNew">
            <template #icon><NIcon :component="AddIcon" /></template>
            {{ t('developer.addNew') }}
          </NButton>
        </div>
        <div class="dev-list">
          <NEmpty v-if="developers.length === 0" :description="t('developer.empty')" class="dev-empty" />
          <button
            v-for="dev in developers"
            :key="dev.id"
            type="button"
            class="dev-item"
            :class="{ 'is-active': dev.id === selectedId }"
            @click="selectDeveloper(dev.id)"
          >
            <span class="dev-item-name truncate">{{ dev.names.ko }}</span>
            <NButton
              size="tiny"
              quaternary
              circle
              type="error"
              class="dev-item-del"
              @click.stop="handleDelete(dev.id)"
            >
              <template #icon><NIcon :component="TrashIcon" /></template>
            </NButton>
          </button>
        </div>
      </div>

      <!-- Right: localized name editor -->
      <div class="dev-editor-pane">
        <div class="field">
          <label class="field-label">
            {{ LOCALE_META.ko.nativeName }}
            <span class="req">*</span>
          </label>
          <NInput v-model:value="form.ko" :placeholder="t('developer.namePlaceholder')" clearable />
        </div>
        <div v-for="code in otherLocales" :key="code" class="field">
          <label class="field-label">{{ LOCALE_META[code].nativeName }}</label>
          <NInput v-model:value="form[code]" :placeholder="t('developer.namePlaceholder')" clearable />
        </div>
        <p class="field-hint">{{ t('developer.koRequired') }}</p>
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
.dev-manager {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 20px;
  min-height: 320px;
}

@media (max-width: 620px) {
  .dev-manager {
    grid-template-columns: 1fr;
  }
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

/* Section label token: no uppercase, no tracking — see global.css. */
.pane-label {
  font-size: var(--label-size);
  font-weight: var(--label-weight);
  color: var(--plum-soft);
}

.dev-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}

.dev-empty {
  margin-top: 32px;
}

.dev-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--r-md);
  background-color: var(--surface-2);
  color: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.dev-item:hover {
  background-color: var(--plum-wash);
}

.dev-item.is-active {
  border-color: var(--plum);
}

.dev-item-name {
  min-width: 0;
}

.dev-item-del {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.dev-item:hover .dev-item-del,
.dev-item.is-active .dev-item-del {
  opacity: 1;
}

.dev-editor-pane {
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
  color: var(--text-2);
}

.req {
  color: var(--plum-soft);
}

.field-hint {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-2);
}

.editor-actions {
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
}
</style>
