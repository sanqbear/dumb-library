<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  NModal,
  NSteps,
  NStep,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NButton,
  NSpace,
  NImage,
  NIcon,
  useMessage
} from 'naive-ui'
import {
  FolderOpen as FolderIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  LinkOutline as LinkIcon,
  AddOutline as AddIcon
} from '@vicons/ionicons5'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '../../stores/libraryStore'
import { useImageInput } from '../../composables/useImageInput'
import { useThemeClass } from '../../composables/useThemeClass'
import { MAX_PREVIEW_IMAGES } from '../../types'
import ImageCropDialog from './ImageCropDialog.vue'
import TagInput from '../TagInput.vue'
import DeveloperSelect from '../DeveloperSelect.vue'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', value: boolean): void }>()

const { t } = useI18n()
const libraryStore = useLibraryStore()
const message = useMessage()
const themeClass = useThemeClass()

const thumbInput = useImageInput()
const previewInput = useImageInput()

// Wizard step: 0=exe, 1=title, 2=images, 3=tags
const step = ref(0)
const LAST_STEP = 3

// Form data
const title = ref('')
const executablePath = ref('')
const developerId = ref<string | null>(null)
const tags = ref<string[]>([])
const keywords = ref<string[]>([])
const memo = ref('')
const marketUrl = ref('')

// Thumbnail (single) — holds a temp cropped path until submit.
const thumbnailPath = ref<string | null>(null)
const thumbnailPreview = ref<string>('')
const thumbUrl = ref('')

// Previews — collected as {path,preview}; persisted after the program is created.
const pendingPreviews = ref<{ path: string; preview: string }[]>([])
const previewUrl = ref('')
const canAddPreview = computed(() => pendingPreviews.value.length < MAX_PREVIEW_IMAGES)

// Crop flow
const showCropDialog = ref(false)
const cropSourceUrl = ref('')
const cropAspect = ref(2 / 3)
const cropTarget = ref<'thumbnail' | 'preview'>('thumbnail')

const isSubmitting = ref(false)

watch(thumbnailPath, async (value) => {
  thumbnailPreview.value = value ? (await window.electron.readImageAsDataUrl(value)) ?? '' : ''
})

const resetForm = () => {
  step.value = 0
  title.value = ''
  executablePath.value = ''
  developerId.value = null
  tags.value = []
  keywords.value = []
  memo.value = ''
  marketUrl.value = ''
  thumbnailPath.value = null
  thumbnailPreview.value = ''
  thumbUrl.value = ''
  pendingPreviews.value = []
  previewUrl.value = ''
}

watch(() => props.show, (newVal) => { if (!newVal) resetForm() })

// Step navigation + per-step validation gates
const canProceed = computed(() => {
  if (step.value === 0) return executablePath.value.trim() !== ''
  if (step.value === 1) return title.value.trim() !== ''
  return true
})
const goNext = () => { if (canProceed.value && step.value < LAST_STEP) step.value += 1 }
const goPrev = () => { if (step.value > 0) step.value -= 1 }

// Crop helpers
const openCropFor = async (absSourcePath: string, target: 'thumbnail' | 'preview') => {
  const dataUrl = await window.electron.readImageAsDataUrl(absSourcePath)
  if (!dataUrl) { message.error(t('addDialog.imageReadFailed')); return }
  cropSourceUrl.value = dataUrl
  cropAspect.value = target === 'preview' ? 16 / 9 : 2 / 3
  cropTarget.value = target
  showCropDialog.value = true
}

const handleCropConfirm = async (tempPath: string) => {
  if (cropTarget.value === 'thumbnail') {
    thumbnailPath.value = tempPath
  } else {
    if (pendingPreviews.value.length >= MAX_PREVIEW_IMAGES) return
    const preview = (await window.electron.readImageAsDataUrl(tempPath)) ?? ''
    pendingPreviews.value = [...pendingPreviews.value, { path: tempPath, preview }]
  }
}

// Exe + title
const handleSelectExecutable = async () => {
  const path = await window.electron.selectExecutable()
  if (path) {
    executablePath.value = path
    if (!title.value.trim()) {
      title.value = path.split('\\').pop()?.replace('.exe', '') || ''
    }
  }
}

// Thumbnail
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

// Previews
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
const handleRemovePreview = (index: number) => {
  pendingPreviews.value = pendingPreviews.value.filter((_, i) => i !== index)
}

const isValid = computed(() => title.value.trim() !== '' && executablePath.value.trim() !== '')

const handleSubmit = async () => {
  if (!isValid.value) return
  isSubmitting.value = true
  try {
    const newProgram = await libraryStore.addProgram({
      title: title.value.trim(),
      executablePath: executablePath.value,
      developerId: developerId.value,
      tags: [...tags.value],
      keywords: [...keywords.value],
      memo: memo.value.trim(),
      marketUrl: marketUrl.value.trim()
    })

    if (newProgram) {
      if (thumbnailPath.value) {
        await libraryStore.saveThumbnail(newProgram.id, thumbnailPath.value)
      }
      for (const p of pendingPreviews.value) {
        await libraryStore.savePreviewImage(newProgram.id, p.path)
      }
      message.success(t('addDialog.addedSuccess'))
      emit('update:show', false)
    } else {
      message.error(t('addDialog.addFailed'))
    }
  } catch (error) {
    message.error(t('addDialog.addFailed'))
    console.error(error)
  } finally {
    isSubmitting.value = false
  }
}

const handleCancel = () => { emit('update:show', false) }
</script>

<template>
  <NModal :show="show" @update:show="emit('update:show', $event)" preset="card" :title="t('addDialog.title')"
    :bordered="false" size="medium" :style="{ width: '760px', maxWidth: '92vw' }" :mask-closable="false">
    <div :class="themeClass">
      <NSteps :current="step + 1" size="small" class="wizard-steps">
        <NStep :title="t('addDialog.stepExe')" />
        <NStep :title="t('addDialog.stepTitle')" />
        <NStep :title="t('addDialog.stepImages')" />
        <NStep :title="t('addDialog.stepTags')" />
      </NSteps>

      <NForm label-placement="top" class="wizard-body">
        <!-- Step 0: Executable path -->
        <template v-if="step === 0">
          <NFormItem :label="t('addDialog.executablePath')" required>
            <NInput v-model:value="executablePath" :placeholder="t('addDialog.executablePathPlaceholder')" readonly>
              <template #suffix>
                <NButton quaternary size="small" @click="handleSelectExecutable">
                  <template #icon><NIcon :component="FolderIcon" /></template>
                </NButton>
              </template>
            </NInput>
          </NFormItem>
          <NButton @click="handleSelectExecutable" block dashed>
            <template #icon><NIcon :component="FolderIcon" /></template>
            {{ t('addDialog.executablePathPlaceholder') }}
          </NButton>
        </template>

        <!-- Step 1: Title + developer/circle -->
        <template v-else-if="step === 1">
          <NFormItem :label="t('addDialog.titleLabel')" required>
            <NInput v-model:value="title" :placeholder="t('addDialog.titlePlaceholder')" clearable
              @keydown.enter.prevent="goNext" />
          </NFormItem>
          <NFormItem :label="t('addDialog.developerLabel')">
            <DeveloperSelect v-model:value="developerId" />
          </NFormItem>
        </template>

        <!-- Step 2: Images (thumbnail + previews) -->
        <template v-else-if="step === 2">
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
                  <NIcon :component="ImageIcon" :size="32" />
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
                <NButton v-if="thumbnailPath" @click="handleRemoveThumbnail" quaternary block>
                  <template #icon><NIcon :component="CloseIcon" /></template>
                  {{ t('common.remove') }}
                </NButton>
              </div>
            </div>
          </div>

          <!-- Previews -->
          <div class="media-section" :class="{ 'is-drag-over': previewInput.isDragOver.value }"
            @dragenter="previewInput.onDragEnter" @dragover="previewInput.onDragOver"
            @dragleave="previewInput.onDragLeave" @drop="handlePreviewDrop">
            <div class="media-label">
              {{ t('editDialog.previewLabel') }} · {{ pendingPreviews.length }}/{{ MAX_PREVIEW_IMAGES }}
            </div>
            <div class="preview-grid">
              <div v-for="(item, i) in pendingPreviews" :key="i" class="preview-tile">
                <NImage :src="item.preview" object-fit="cover" width="100%" height="100%" preview-disabled />
                <NButton class="preview-remove" size="tiny" circle type="error" @click="handleRemovePreview(i)">
                  <template #icon><NIcon :component="CloseIcon" /></template>
                </NButton>
              </div>
              <button v-if="canAddPreview" type="button" class="preview-add" @click="handleSelectPreview">
                <NIcon :component="AddIcon" :size="24" />
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
        </template>

        <!-- Step 3: Tags + market URL -->
        <template v-else>
          <NFormItem :label="t('editDialog.marketUrlLabel')">
            <NInput v-model:value="marketUrl" :placeholder="t('editDialog.marketUrlPlaceholder')" clearable>
              <template #prefix><NIcon :component="LinkIcon" /></template>
            </NInput>
          </NFormItem>
          <NFormItem :label="t('addDialog.tagsLabel')">
            <TagInput
              v-model:value="tags"
              :suggestions="libraryStore.allTags"
              :placeholder="t('addDialog.tagInputPlaceholder')"
            />
          </NFormItem>
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
          <NFormItem :label="t('addDialog.memoLabel')">
            <div class="field-stack">
              <NInput v-model:value="memo" type="textarea" :placeholder="t('addDialog.memoPlaceholder')"
                :autosize="{ minRows: 3, maxRows: 6 }" />
              <span class="field-hint">{{ t('addDialog.memoHint') }}</span>
            </div>
          </NFormItem>
        </template>
      </NForm>
    </div>

    <template #footer>
      <div class="wizard-footer">
        <NButton v-if="step > 0" @click="goPrev" :disabled="isSubmitting">{{ t('addDialog.prev') }}</NButton>
        <span class="footer-spacer" />
        <NSpace>
          <NButton @click="handleCancel" :disabled="isSubmitting">{{ t('common.cancel') }}</NButton>
          <NButton v-if="step < LAST_STEP" type="primary" :disabled="!canProceed" @click="goNext">
            {{ t('addDialog.next') }}
          </NButton>
          <NButton v-else type="primary" :disabled="!isValid" :loading="isSubmitting" @click="handleSubmit">
            {{ t('common.add') }}
          </NButton>
        </NSpace>
      </div>
    </template>

    <ImageCropDialog v-model:show="showCropDialog" :source="cropSourceUrl" :aspect-ratio="cropAspect"
      :title="cropTarget === 'preview' ? t('editDialog.previewCropTitle') : t('editDialog.thumbnailCropTitle')"
      @confirm="handleCropConfirm" />
  </NModal>
</template>

<style scoped>
.wizard-steps {
  margin-bottom: 20px;
}

.wizard-body {
  min-height: 240px;
}

.media-section {
  margin-bottom: 16px;
  padding: 12px 16px;
  background-color: var(--surface-2);
  border-radius: var(--r-md);
  transition: box-shadow 0.15s ease;
}

.media-section.is-drag-over {
  box-shadow: 0 0 0 2px var(--plum);
}

/* Section label token: no uppercase, no tracking — see global.css. */
.media-label {
  font-size: var(--label-size);
  font-weight: var(--label-weight);
  color: var(--plum-soft);
  margin-bottom: 10px;
}

.media-row {
  display: flex;
  gap: 16px;
  align-items: stretch;
}

.thumbnail-preview {
  width: 160px;
  height: 240px;
  border-radius: var(--r-md);
  overflow: hidden;
  flex-shrink: 0;
}

.thumbnail-preview.is-empty {
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
  gap: 8px;
  color: var(--text-3);
  font-size: 0.78rem;
  pointer-events: none;
}

.media-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
  flex: 1;
  min-width: 0;
}

.preview-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.preview-tile {
  position: relative;
  width: 210px;
  aspect-ratio: 16 / 9;
  border-radius: var(--r-md);
  overflow: hidden;
  background-color: var(--surface);
}

.preview-remove {
  position: absolute;
  top: 4px;
  right: 4px;
}

.preview-add {
  width: 210px;
  aspect-ratio: 16 / 9;
  border: 2px dashed var(--border);
  border-radius: var(--r-md);
  background-color: var(--surface);
  color: var(--text-2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.preview-add:hover {
  border-color: var(--plum);
  color: var(--plum-soft);
}

.preview-url {
  margin-top: 10px;
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

.wizard-footer {
  display: flex;
  align-items: center;
  width: 100%;
}

.footer-spacer {
  flex: 1;
}
</style>
