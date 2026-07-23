<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NButton,
  NSpace,
  NImage,
  NIcon,
  useMessage,
  useDialog
} from 'naive-ui'
import {
  FolderOpen as FolderIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  Trash as DeleteIcon,
  RefreshOutline as RefreshIcon,
  LinkOutline as LinkIcon,
  CloudDownloadOutline as CloudDownloadIcon,
  ArrowBackOutline as BackIcon,
  AddOutline as AddIcon,
  CropOutline as CropIcon
} from '@vicons/ionicons5'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '../stores/libraryStore'
import { libImageUrl, MAX_PREVIEW_IMAGES } from '../types'
import { useImageInput } from '../composables/useImageInput'
import ImageCropDialog from '../components/dialogs/ImageCropDialog.vue'
import SteamArtworkDialog from '../components/dialogs/SteamArtworkDialog.vue'
import TagInput from '../components/TagInput.vue'
import DeveloperSelect from '../components/DeveloperSelect.vue'

const props = defineProps<{ id: string }>()

const { t } = useI18n()
const router = useRouter()
const libraryStore = useLibraryStore()
const message = useMessage()
const confirmDialog = useDialog()

const program = computed(() => libraryStore.programs.find(p => p.id === props.id) ?? null)

// Shared drag&drop + URL fetch helpers (one per media section)
const thumbInput = useImageInput()
const iconInput = useImageInput()
const previewInput = useImageInput()

// Form data
const title = ref('')
const executablePath = ref('')
const developerId = ref<string | null>(null)
const tags = ref<string[]>([])
const keywords = ref<string[]>([])
const memo = ref('')
const marketUrl = ref('')

// Thumbnail / icon state — pending changes deferred until Save
const thumbnailPath = ref<string | null>(null)
const originalThumbnailPath = ref<string | null>(null)
const thumbnailPreview = ref<string>('')
const iconPath = ref<string | null>(null)
const originalIconPath = ref<string | null>(null)
const iconPreview = ref<string>('')

const thumbUrl = ref('')
const iconUrl = ref('')
const previewUrl = ref('')

// Crop flow — shared dialog, target ref decides which field receives the result.
const showCropDialog = ref(false)
const cropSourceUrl = ref('')
const cropAspect = ref(2 / 3)
const cropTarget = ref<'thumbnail' | 'icon' | 'preview'>('thumbnail')

const showArtworkDialog = ref(false)
const isSubmitting = ref(false)
const cacheBust = ref(0)

// Preview images are persisted immediately, so they read straight from the store.
const previewItems = computed(() =>
  program.value
    ? program.value.previewImages.map(rel => ({ rel, url: libImageUrl(rel, program.value!.updatedAt) }))
    : []
)
const canAddPreview = computed(() => previewItems.value.length < MAX_PREVIEW_IMAGES)

const canReextractIcon = computed(() =>
  program.value?.category === 'local' && !!executablePath.value && !executablePath.value.startsWith('steam://')
)

const steamAppId = computed<number | null>(() => {
  if (program.value?.category !== 'steam') return null
  const match = program.value.executablePath.match(/^steam:\/\/run\/(\d+)$/)
  return match && match[1] ? parseInt(match[1], 10) : null
})

const resolvePreview = async (
  current: string | null,
  original: string | null,
  version: string | number
): Promise<string> => {
  if (!current) return ''
  if (current === original) return libImageUrl(current, version)
  return (await window.electron.readImageAsDataUrl(current)) ?? ''
}

watch([thumbnailPath, originalThumbnailPath, cacheBust], async ([current, original, v]) => {
  thumbnailPreview.value = await resolvePreview(current as string | null, original as string | null, v as number)
})
watch([iconPath, originalIconPath, cacheBust], async ([current, original, v]) => {
  iconPreview.value = await resolvePreview(current as string | null, original as string | null, v as number)
})

// Initialize form from the store program (immediate + on id change).
watch(
  program,
  async (p) => {
    if (p) {
      title.value = p.title
      executablePath.value = p.executablePath
      developerId.value = p.developerId ?? null
      tags.value = [...p.tags]
      keywords.value = [...(p.keywords ?? [])]
      memo.value = p.memo ?? ''
      marketUrl.value = p.marketUrl ?? ''
      thumbnailPath.value = p.thumbnailPath
      originalThumbnailPath.value = p.thumbnailPath
      iconPath.value = p.iconPath
      originalIconPath.value = p.iconPath
      cacheBust.value = cacheBust.value + 1
    } else {
      await nextTick()
      if (!program.value) router.replace({ name: 'library' })
    }
  },
  { immediate: true }
)

const isValid = computed(() => title.value.trim() !== '' && executablePath.value.trim() !== '')
const thumbnailChanged = computed(() => thumbnailPath.value !== originalThumbnailPath.value)
const iconChanged = computed(() => iconPath.value !== originalIconPath.value)

const handleSelectExecutable = async () => {
  const path = await window.electron.selectExecutable()
  if (path) executablePath.value = path
}

// Open crop dialog for a given target with an absolute source path.
const openCropFor = async (absSourcePath: string, target: 'thumbnail' | 'icon' | 'preview') => {
  const dataUrl = await window.electron.readImageAsDataUrl(absSourcePath)
  if (!dataUrl) {
    message.error(t('addDialog.imageReadFailed'))
    return
  }
  cropSourceUrl.value = dataUrl
  cropAspect.value = target === 'icon' ? 1 : target === 'preview' ? 16 / 9 : 2 / 3
  cropTarget.value = target
  showCropDialog.value = true
}

// Open crop dialog sourced directly from an existing (wl-image) URL — used to
// derive a thumbnail from an already-saved preview.
const openCropFromUrl = (sourceUrl: string, target: 'thumbnail' | 'icon' | 'preview') => {
  cropSourceUrl.value = sourceUrl
  cropAspect.value = target === 'icon' ? 1 : target === 'preview' ? 16 / 9 : 2 / 3
  cropTarget.value = target
  showCropDialog.value = true
}

const handleCropConfirm = async (tempPath: string) => {
  if (cropTarget.value === 'thumbnail') {
    thumbnailPath.value = tempPath
  } else if (cropTarget.value === 'icon') {
    iconPath.value = tempPath
  } else {
    // Preview: persist immediately (program already exists).
    if (!program.value) return
    const saved = await libraryStore.savePreviewImage(program.value.id, tempPath)
    if (!saved) message.error(t('editDialog.previewSaveFailed'))
  }
}

// Thumbnail handlers
const handleSelectThumbnail = async () => {
  const path = await window.electron.selectImage()
  if (path) await openCropFor(path, 'thumbnail')
}
const handleRemoveThumbnail = () => { thumbnailPath.value = null }
const handleThumbDrop = async (e: DragEvent) => {
  const absPath = thumbInput.onDrop(e)
  if (absPath) await openCropFor(absPath, 'thumbnail')
  else message.warning(t('addDialog.onlyImages'))
}
const handleFetchThumbUrl = async () => {
  const tempPath = await thumbInput.fetchFromUrl(thumbUrl.value)
  if (tempPath) { thumbUrl.value = ''; await openCropFor(tempPath, 'thumbnail') }
  else message.error(t('addDialog.urlFetchFailed'))
}

// Icon handlers
const handleSelectIcon = async () => {
  const path = await window.electron.selectImage()
  if (path) await openCropFor(path, 'icon')
}
const handleRemoveIcon = () => { iconPath.value = null }
const handleIconDrop = async (e: DragEvent) => {
  const absPath = iconInput.onDrop(e)
  if (absPath) await openCropFor(absPath, 'icon')
  else message.warning(t('addDialog.onlyImages'))
}
const handleFetchIconUrl = async () => {
  const tempPath = await iconInput.fetchFromUrl(iconUrl.value)
  if (tempPath) { iconUrl.value = ''; await openCropFor(tempPath, 'icon') }
  else message.error(t('addDialog.urlFetchFailed'))
}

// Preview handlers
const handleSelectPreview = async () => {
  if (!canAddPreview.value) return
  const path = await window.electron.selectImage()
  if (path) await openCropFor(path, 'preview')
}
const handlePreviewDrop = async (e: DragEvent) => {
  if (!canAddPreview.value) return
  const absPath = previewInput.onDrop(e)
  if (absPath) await openCropFor(absPath, 'preview')
  else message.warning(t('addDialog.onlyImages'))
}
const handleFetchPreviewUrl = async () => {
  if (!canAddPreview.value) return
  const tempPath = await previewInput.fetchFromUrl(previewUrl.value)
  if (tempPath) { previewUrl.value = ''; await openCropFor(tempPath, 'preview') }
  else message.error(t('addDialog.urlFetchFailed'))
}
const handleRemovePreview = async (rel: string) => {
  if (program.value) await libraryStore.deletePreviewImage(program.value.id, rel)
}
const handleSetPreviewAsThumbnail = (url: string) => {
  openCropFromUrl(url, 'thumbnail')
}
const handleMovePreview = async (index: number, dir: -1 | 1) => {
  if (!program.value) return
  const arr = [...program.value.previewImages]
  const target = index + dir
  if (target < 0 || target >= arr.length) return
  const a = arr[index]
  const b = arr[target]
  if (a === undefined || b === undefined) return
  arr[index] = b
  arr[target] = a
  await libraryStore.reorderPreviewImages(program.value.id, arr)
}

// Steam artwork picker
const handleOpenArtworkDialog = () => { if (steamAppId.value !== null) showArtworkDialog.value = true }
const handleArtworkSelected = async (tempPath: string) => { await openCropFor(tempPath, 'thumbnail') }

const handleSteamRedownload = async () => {
  if (!program.value || steamAppId.value === null) return
  isSubmitting.value = true
  try {
    const newPath = await libraryStore.downloadSteamThumbnail(program.value.id, steamAppId.value)
    if (newPath) {
      thumbnailPath.value = newPath
      originalThumbnailPath.value = newPath
      cacheBust.value = cacheBust.value + 1
      message.success(t('editDialog.steamCoverRedownloaded'))
    } else {
      message.error(t('editDialog.steamCoverFailed'))
    }
  } finally { isSubmitting.value = false }
}

const handleApplySteamCachedIcon = async () => {
  if (!program.value || steamAppId.value === null) return
  isSubmitting.value = true
  try {
    const newPath = await libraryStore.applySteamCachedIcon(program.value.id, steamAppId.value)
    if (newPath) {
      iconPath.value = newPath
      originalIconPath.value = newPath
      cacheBust.value = cacheBust.value + 1
      message.success(t('editDialog.steamCacheIconFound'))
    } else {
      message.warning(t('editDialog.steamCacheIconNotFound'))
    }
  } finally { isSubmitting.value = false }
}

const handleReextractIcon = async () => {
  if (!program.value || !canReextractIcon.value) return
  isSubmitting.value = true
  try {
    const newPath = await libraryStore.reextractIcon(program.value.id, executablePath.value)
    if (newPath) {
      iconPath.value = newPath
      originalIconPath.value = newPath
      cacheBust.value = cacheBust.value + 1
      message.success(t('editDialog.iconExtracted'))
    } else {
      message.error(t('editDialog.iconExtractFailed'))
    }
  } finally { isSubmitting.value = false }
}

const goToDetail = () => {
  router.push({ name: 'detail', params: { id: props.id } })
}

const handleSubmit = async () => {
  if (!isValid.value || !program.value) return
  isSubmitting.value = true

  const programId = program.value.id
  const pendingThumb = thumbnailChanged.value ? thumbnailPath.value : undefined
  const pendingIcon = iconChanged.value ? iconPath.value : undefined

  try {
    const updated = await libraryStore.updateProgram({
      id: programId,
      title: title.value.trim(),
      executablePath: executablePath.value,
      developerId: developerId.value,
      tags: [...tags.value],
      keywords: [...keywords.value],
      memo: memo.value.trim(),
      marketUrl: marketUrl.value.trim()
    })

    if (updated) {
      if (pendingThumb !== undefined) {
        if (pendingThumb === null) await libraryStore.deleteThumbnail(programId)
        else await libraryStore.saveThumbnail(programId, pendingThumb)
      }
      if (pendingIcon !== undefined) {
        if (pendingIcon === null) await libraryStore.deleteIcon(programId)
        else await libraryStore.saveIcon(programId, pendingIcon)
      }
      message.success(t('editDialog.updatedSuccess'))
      goToDetail()
    } else {
      message.error(t('editDialog.updateFailed'))
    }
  } catch (error) {
    message.error(t('editDialog.updateFailed'))
    console.error(error)
  } finally {
    isSubmitting.value = false
  }
}

const handleDelete = () => {
  if (!program.value) return
  const p = program.value
  confirmDialog.warning({
    title: t('editDialog.deleteConfirmTitle'),
    content: t('editDialog.deleteConfirmMessage', { title: p.title }),
    positiveText: t('common.delete'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const success = await libraryStore.deleteProgram(p.id)
      if (success) {
        message.success(t('editDialog.deleted'))
        router.replace({ name: 'library' })
      } else {
        message.error(t('editDialog.deleteFailed'))
      }
    }
  })
}
</script>

<template>
  <div v-if="program" class="edit-view">
    <header class="edit-topbar">
      <NButton quaternary circle @click="goToDetail" :aria-label="t('common.cancel')">
        <template #icon><NIcon :component="BackIcon" /></template>
      </NButton>
      <h2 class="edit-heading">{{ t('editDialog.title') }}</h2>
    </header>

    <div class="edit-body">
      <NForm label-placement="top">
        <div class="edit-grid">
          <!-- Left column: metadata fields -->
          <div class="edit-col-fields">
            <!-- Title -->
            <NFormItem :label="t('addDialog.titleLabel')" required>
              <NInput v-model:value="title" :placeholder="t('addDialog.titlePlaceholder')" clearable />
            </NFormItem>

            <!-- Developer / circle — mapped to a master entry (included in search) -->
            <NFormItem :label="t('addDialog.developerLabel')">
              <DeveloperSelect v-model:value="developerId" />
            </NFormItem>

            <!-- Executable Path -->
            <NFormItem :label="t('addDialog.executablePath')" required>
              <NInput v-model:value="executablePath" :placeholder="t('addDialog.executablePathPlaceholder')" readonly>
                <template #suffix>
                  <NButton quaternary size="small" @click="handleSelectExecutable">
                    <template #icon><NIcon :component="FolderIcon" /></template>
                  </NButton>
                </template>
              </NInput>
            </NFormItem>

            <!-- Market URL -->
            <NFormItem :label="t('editDialog.marketUrlLabel')">
              <NInput v-model:value="marketUrl" :placeholder="t('editDialog.marketUrlPlaceholder')" clearable>
                <template #prefix><NIcon :component="LinkIcon" /></template>
              </NInput>
            </NFormItem>

            <!-- Tags -->
            <NFormItem :label="t('addDialog.tagsLabel')">
              <TagInput
                v-model:value="tags"
                :suggestions="libraryStore.allTags"
                :placeholder="t('addDialog.tagInputPlaceholder')"
              />
            </NFormItem>

            <!-- Search keywords (indexing only, not categorization) -->
            <NFormItem :label="t('addDialog.keywordsLabel')">
              <div class="field-stack">
                <TagInput
                  v-model:value="keywords"
                  :suggestions="libraryStore.allKeywords"
                  :placeholder="t('addDialog.tagInputPlaceholder')"
                />
                <span class="field-hint">{{ t('addDialog.keywordsHint') }}</span>
              </div>
            </NFormItem>

            <!-- Memo (reference note, excluded from search) -->
            <NFormItem :label="t('addDialog.memoLabel')">
              <div class="field-stack">
                <NInput v-model:value="memo" type="textarea" :placeholder="t('addDialog.memoPlaceholder')"
                  :autosize="{ minRows: 3, maxRows: 8 }" />
                <span class="field-hint">{{ t('addDialog.memoHint') }}</span>
              </div>
            </NFormItem>
          </div>

          <!-- Right column: thumbnail + icon -->
          <div class="edit-col-media">
            <!-- Thumbnail -->
            <div class="media-section" :class="{ 'is-drag-over': thumbInput.isDragOver.value }"
              @dragenter="thumbInput.onDragEnter" @dragover="thumbInput.onDragOver" @dragleave="thumbInput.onDragLeave"
              @drop="handleThumbDrop">
              <div class="media-label">{{ t('editDialog.thumbnailLabel') }}</div>
              <div class="media-row">
                <div class="thumbnail-preview" :class="{ 'is-empty': !thumbnailPreview }">
                  <NImage v-if="thumbnailPreview" :src="thumbnailPreview" object-fit="cover" width="160" height="240"
                    preview-disabled />
                  <div v-else class="media-placeholder">
                    <NIcon :component="ImageIcon" :size="40" />
                    <span>{{ t('addDialog.dropHere') }}</span>
                  </div>
                </div>
                <div class="media-actions">
                  <NButton @click="handleSelectThumbnail" block>
                    <template #icon><NIcon :component="ImageIcon" /></template>
                    {{ t('addDialog.selectImage') }}
                  </NButton>
                  <NInputGroup>
                    <NInput v-model:value="thumbUrl" :placeholder="t('addDialog.imageUrl')"
                      @keydown.enter.prevent="handleFetchThumbUrl" />
                    <NButton type="primary" :disabled="!thumbUrl.trim() || thumbInput.isFetching.value"
                      :loading="thumbInput.isFetching.value" @click="handleFetchThumbUrl">
                      <template #icon><NIcon :component="LinkIcon" /></template>
                      {{ t('addDialog.fetchUrl') }}
                    </NButton>
                  </NInputGroup>
                  <!-- Occasional actions, kept on one quiet line so they do
                       not read as equals of "choose a file". -->
                  <div v-if="steamAppId !== null || thumbnailPath" class="media-extra">
                    <NButton v-if="steamAppId !== null" size="small" quaternary @click="handleOpenArtworkDialog" :disabled="isSubmitting">
                      <template #icon><NIcon :component="CloudDownloadIcon" /></template>
                      {{ t('editDialog.steamArtworkSelect') }}
                    </NButton>
                    <NButton v-if="steamAppId !== null" size="small" quaternary @click="handleSteamRedownload" :disabled="isSubmitting">
                      {{ t('editDialog.steamCoverRestore') }}
                    </NButton>
                    <NButton v-if="thumbnailPath" size="small" quaternary @click="handleRemoveThumbnail">
                      <template #icon><NIcon :component="CloseIcon" /></template>
                      {{ t('common.remove') }}
                    </NButton>
                  </div>
                </div>
              </div>
            </div>

            <!-- Icon -->
            <div class="media-section" :class="{ 'is-drag-over': iconInput.isDragOver.value }"
              @dragenter="iconInput.onDragEnter" @dragover="iconInput.onDragOver" @dragleave="iconInput.onDragLeave"
              @drop="handleIconDrop">
              <div class="media-label">{{ t('editDialog.iconLabel') }}</div>
              <div class="media-row">
                <div class="icon-preview" :class="{ 'is-empty': !iconPreview }">
                  <NImage v-if="iconPreview" :src="iconPreview" object-fit="cover" width="120" height="120"
                    preview-disabled />
                  <div v-else class="media-placeholder">
                    <NIcon :component="ImageIcon" :size="32" />
                    <span>{{ t('addDialog.dropHere') }}</span>
                  </div>
                </div>
                <div class="media-actions">
                  <NButton @click="handleSelectIcon" block>
                    <template #icon><NIcon :component="ImageIcon" /></template>
                    {{ t('addDialog.selectImage') }}
                  </NButton>
                  <NInputGroup>
                    <NInput v-model:value="iconUrl" :placeholder="t('addDialog.imageUrl')"
                      @keydown.enter.prevent="handleFetchIconUrl" />
                    <NButton type="primary" :disabled="!iconUrl.trim() || iconInput.isFetching.value"
                      :loading="iconInput.isFetching.value" @click="handleFetchIconUrl">
                      <template #icon><NIcon :component="LinkIcon" /></template>
                      {{ t('addDialog.fetchUrl') }}
                    </NButton>
                  </NInputGroup>
                  <div v-if="canReextractIcon || steamAppId !== null || iconPath" class="media-extra">
                    <NButton v-if="canReextractIcon" size="small" quaternary @click="handleReextractIcon" :disabled="isSubmitting">
                      <template #icon><NIcon :component="RefreshIcon" /></template>
                      {{ t('editDialog.reextractFromExe') }}
                    </NButton>
                    <NButton v-if="steamAppId !== null" size="small" quaternary @click="handleApplySteamCachedIcon" :disabled="isSubmitting">
                      <template #icon><NIcon :component="CloudDownloadIcon" /></template>
                      {{ t('editDialog.steamCacheIcon') }}
                    </NButton>
                    <NButton v-if="iconPath" size="small" quaternary @click="handleRemoveIcon">
                      <template #icon><NIcon :component="CloseIcon" /></template>
                      {{ t('common.remove') }}
                    </NButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Preview images (landscape, max 3). Full width, and last: screenshots
             describe the program but do not identify it. -->
        <div class="media-section" :class="{ 'is-drag-over': previewInput.isDragOver.value }"
          @dragenter="previewInput.onDragEnter" @dragover="previewInput.onDragOver" @dragleave="previewInput.onDragLeave"
          @drop="handlePreviewDrop">
          <div class="media-label">
            {{ t('editDialog.previewLabel') }} · {{ previewItems.length }}/{{ MAX_PREVIEW_IMAGES }}
          </div>
          <div class="preview-grid">
            <div v-for="(item, i) in previewItems" :key="item.rel" class="preview-tile">
              <NImage :src="item.url" object-fit="cover" width="100%" height="100%" preview-disabled />
              <div class="preview-tile-actions">
                <NButton size="tiny" circle :disabled="i === 0" @click="handleMovePreview(i, -1)" aria-label="←">‹</NButton>
                <NButton size="tiny" circle @click="handleSetPreviewAsThumbnail(item.url)" :title="t('editDialog.setAsThumbnail')">
                  <template #icon><NIcon :component="CropIcon" /></template>
                </NButton>
                <NButton size="tiny" circle type="error" @click="handleRemovePreview(item.rel)" aria-label="×">
                  <template #icon><NIcon :component="CloseIcon" /></template>
                </NButton>
                <NButton size="tiny" circle :disabled="i === previewItems.length - 1" @click="handleMovePreview(i, 1)" aria-label="→">›</NButton>
              </div>
            </div>
            <button v-if="canAddPreview" type="button" class="preview-add" @click="handleSelectPreview">
              <NIcon :component="AddIcon" :size="28" />
              <span>{{ t('addDialog.selectImage') }}</span>
            </button>
          </div>
          <NInputGroup v-if="canAddPreview" class="preview-url">
            <NInput v-model:value="previewUrl" :placeholder="t('addDialog.imageUrl')"
              @keydown.enter.prevent="handleFetchPreviewUrl" />
            <NButton type="primary" :disabled="!previewUrl.trim() || previewInput.isFetching.value"
              :loading="previewInput.isFetching.value" @click="handleFetchPreviewUrl">
              <template #icon><NIcon :component="LinkIcon" /></template>
              {{ t('addDialog.fetchUrl') }}
            </NButton>
          </NInputGroup>
        </div>
      </NForm>
    </div>

    <!-- Delete sits here, at the far end from Save, rather than beside the back
         button in the top bar where an irreversible action had no business. -->
    <footer class="edit-footer">
      <NButton type="error" quaternary @click="handleDelete" :disabled="isSubmitting">
        <template #icon><NIcon :component="DeleteIcon" /></template>
        {{ t('common.delete') }}
      </NButton>
      <NSpace justify="end">
        <NButton @click="goToDetail" :disabled="isSubmitting">{{ t('common.cancel') }}</NButton>
        <NButton type="primary" @click="handleSubmit" :disabled="!isValid" :loading="isSubmitting">
          {{ t('common.save') }}
        </NButton>
      </NSpace>
    </footer>

    <ImageCropDialog v-model:show="showCropDialog" :source="cropSourceUrl" :aspect-ratio="cropAspect"
      :title="cropTarget === 'icon' ? t('editDialog.iconCropTitle') : cropTarget === 'preview' ? t('editDialog.previewCropTitle') : t('editDialog.thumbnailCropTitle')"
      @confirm="handleCropConfirm" />

    <SteamArtworkDialog v-model:show="showArtworkDialog" :app-id="steamAppId" @selected="handleArtworkSelected" />
  </div>
</template>

<style scoped>
.edit-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  margin: -16px;
}

.edit-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}

.edit-heading {
  flex: 1;
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.edit-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 32px;
  width: 100%;
}

/* Two-column layout: metadata fields on the left, thumbnail/icon on the right.
   Collapses to a single column on narrow windows. */
/* Fields carry more weight than the two image slots, so they get the room. */
.edit-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 400px);
  gap: 32px;
  align-items: start;
  margin-bottom: 28px;
}

@media (max-width: 980px) {
  .edit-grid {
    grid-template-columns: 1fr;
  }
}

.edit-col-media {
  display: flex;
  flex-direction: column;
}

.edit-col-media .media-section:last-child {
  margin-bottom: 0;
}

.edit-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 24px;
  border-top: 1px solid var(--line);
}

/* No filled panel: these were boxes containing boxes. A label and space mark
   the section, matching every other labelled block in the app. The drop target
   only announces itself while something is actually being dragged over it. */
.media-section {
  margin-bottom: 26px;
  border-radius: var(--r-md);
}

.media-section.is-drag-over {
  outline: 2px dashed var(--plum);
  outline-offset: 8px;
}

/* Occasional actions — Steam artwork, re-extract, remove — on one wrapping
   line rather than a stack of full-width buttons. */
.media-extra {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* Section label token: no uppercase, no tracking — see global.css. */
.media-label {
  font-size: var(--label-size);
  font-weight: var(--label-weight);
  color: var(--plum-soft);
  margin-bottom: 10px;
}

/* Image over its controls, not beside them: the media column is ~380px wide,
   and a 160px preview alongside left the URL field too narrow to read. */
.media-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}

.thumbnail-preview,
.icon-preview {
  border-radius: var(--r-md);
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.thumbnail-preview { width: 160px; height: 240px; }
.icon-preview { width: 120px; height: 120px; }

.thumbnail-preview.is-empty,
.icon-preview.is-empty {
  border: 2px dashed var(--border);
  background-color: var(--surface);
}

.media-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-3);
  font-size: 0.8rem;
  pointer-events: none;
}

.media-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.preview-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.preview-tile {
  position: relative;
  flex: 1 1 280px;
  max-width: 480px;
  aspect-ratio: 16 / 9;
  border-radius: var(--r-md);
  overflow: hidden;
  background-color: var(--surface);
}

.preview-tile-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  left: 4px;
  display: flex;
  justify-content: space-between;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.preview-tile:hover .preview-tile-actions {
  opacity: 1;
}

.preview-add {
  flex: 1 1 280px;
  max-width: 480px;
  aspect-ratio: 16 / 9;
  border: 2px dashed var(--border);
  border-radius: var(--r-md);
  background-color: var(--surface);
  color: var(--text-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  font-size: 0.78rem;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.preview-add:hover {
  border-color: var(--plum);
  color: var(--plum-soft);
}

.preview-url {
  margin-top: 12px;
}

.field-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.field-hint {
  font-size: 0.72rem;
  color: var(--text-2);
}
</style>
