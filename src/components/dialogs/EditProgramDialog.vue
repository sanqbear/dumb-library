<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NButton,
  NSpace,
  NDynamicTags,
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
  CloudDownloadOutline as CloudDownloadIcon
} from '@vicons/ionicons5'
import { useLibraryStore } from '../../stores/libraryStore'
import type { Program } from '../../types'
import { libImageUrl } from '../../types'
import { useImageInput } from '../../composables/useImageInput'
import { useThemeClass } from '../../composables/useThemeClass'
import ImageCropDialog from './ImageCropDialog.vue'
import SteamArtworkDialog from './SteamArtworkDialog.vue'

const props = defineProps<{
  show: boolean
  program: Program | null
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const libraryStore = useLibraryStore()
const message = useMessage()
const confirmDialog = useDialog()
const themeClass = useThemeClass()

// Shared drag&drop + URL fetch helpers (one per media section)
const thumbInput = useImageInput()
const iconInput = useImageInput()

// Form data
const title = ref('')
const executablePath = ref('')
const tags = ref<string[]>([])

// Thumbnail state — pending changes are deferred until Save
const thumbnailPath = ref<string | null>(null)
const originalThumbnailPath = ref<string | null>(null)
const thumbnailPreview = ref<string>('')

// Icon state — same deferred pattern
const iconPath = ref<string | null>(null)
const originalIconPath = ref<string | null>(null)
const iconPreview = ref<string>('')

// URL input state (per section)
const thumbUrl = ref('')
const iconUrl = ref('')

// Crop flow state — single dialog shared by both sections, with a target
// ref indicating which field receives the cropped result.
const showCropDialog = ref(false)
const cropSourceUrl = ref('')
const cropAspect = ref(2 / 3)
const cropTarget = ref<'thumbnail' | 'icon'>('thumbnail')

// Steam artwork picker
const showArtworkDialog = ref(false)

const isSubmitting = ref(false)

// Cache-buster for wl-image URLs — bumped after operations that rewrite a file
// at the same path (re-extract). Prevents the browser from showing stale image.
const cacheBust = ref(Date.now())

// Can we re-extract icon from the exe? Only for local programs.
const canReextractIcon = computed(() =>
  props.program?.category === 'local' && !!executablePath.value && !executablePath.value.startsWith('steam://')
)

// Steam programs can have their cover re-downloaded from Steam CDN at any time.
const steamAppId = computed<number | null>(() => {
  if (props.program?.category !== 'steam') return null
  const match = props.program.executablePath.match(/^steam:\/\/run\/(\d+)$/)
  return match ? parseInt(match[1], 10) : null
})

// Resolve preview URL: wl-image:// when pointing at the saved path, data: when user just selected a new file.
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

// Initialize form when program changes or dialog opens
watch(() => [props.show, props.program], ([newShow, newProgram]) => {
  if (newShow && newProgram) {
    const program = newProgram as Program
    title.value = program.title
    executablePath.value = program.executablePath
    tags.value = [...program.tags]
    thumbnailPath.value = program.thumbnailPath
    originalThumbnailPath.value = program.thumbnailPath
    iconPath.value = program.iconPath
    originalIconPath.value = program.iconPath
    cacheBust.value = Date.now()
  }
}, { immediate: true })

// Validation
const isValid = computed(() => {
  return title.value.trim() !== '' && executablePath.value.trim() !== ''
})

// Check if thumbnail/icon changed
const thumbnailChanged = computed(() => thumbnailPath.value !== originalThumbnailPath.value)
const iconChanged = computed(() => iconPath.value !== originalIconPath.value)

// Select executable file
const handleSelectExecutable = async () => {
  const path = await window.electron.selectExecutable()
  if (path) {
    executablePath.value = path
  }
}

// Thumbnail: select/remove (deferred to submit)
const handleSelectThumbnail = async () => {
  const path = await window.electron.selectImage()
  if (path) await openCropFor(path, 'thumbnail')
}

const handleRemoveThumbnail = () => {
  thumbnailPath.value = null
}

// Icon: select/remove (deferred to submit)
const handleSelectIcon = async () => {
  const path = await window.electron.selectImage()
  if (path) await openCropFor(path, 'icon')
}

const handleRemoveIcon = () => {
  iconPath.value = null
}

// Open crop dialog for the given target ('thumbnail' | 'icon') with a source path.
const openCropFor = async (absSourcePath: string, target: 'thumbnail' | 'icon') => {
  const dataUrl = await window.electron.readImageAsDataUrl(absSourcePath)
  if (!dataUrl) {
    message.error('이미지를 읽지 못했습니다')
    return
  }
  cropSourceUrl.value = dataUrl
  cropAspect.value = target === 'icon' ? 1 : 2 / 3
  cropTarget.value = target
  showCropDialog.value = true
}

const handleCropConfirm = (tempPath: string) => {
  if (cropTarget.value === 'thumbnail') {
    thumbnailPath.value = tempPath
  } else {
    iconPath.value = tempPath
  }
}

// Drop / URL handlers — all route through crop dialog
const handleThumbDrop = async (e: DragEvent) => {
  const absPath = thumbInput.onDrop(e)
  if (absPath) await openCropFor(absPath, 'thumbnail')
  else message.warning('이미지 파일만 지원합니다')
}

const handleFetchThumbUrl = async () => {
  const tempPath = await thumbInput.fetchFromUrl(thumbUrl.value)
  if (tempPath) {
    thumbUrl.value = ''
    await openCropFor(tempPath, 'thumbnail')
  } else {
    message.error('URL에서 이미지를 가져오지 못했습니다')
  }
}

const handleIconDrop = async (e: DragEvent) => {
  const absPath = iconInput.onDrop(e)
  if (absPath) await openCropFor(absPath, 'icon')
  else message.warning('이미지 파일만 지원합니다')
}

const handleFetchIconUrl = async () => {
  const tempPath = await iconInput.fetchFromUrl(iconUrl.value)
  if (tempPath) {
    iconUrl.value = ''
    await openCropFor(tempPath, 'icon')
  } else {
    message.error('URL에서 이미지를 가져오지 못했습니다')
  }
}

// Steam artwork picker — user selects one of the CDN candidates, we download
// it to a temp file, then run through the crop dialog.
const handleOpenArtworkDialog = () => {
  if (steamAppId.value === null) return
  showArtworkDialog.value = true
}

const handleArtworkSelected = async (tempPath: string) => {
  await openCropFor(tempPath, 'thumbnail')
}

// Steam cover re-download: runs immediately (not deferred). Rebuilds the
// thumbnail file from Steam CDN and adopts it as the new baseline so submit
// doesn't treat it as a pending change.
const handleSteamRedownload = async () => {
  if (!props.program || steamAppId.value === null) return
  isSubmitting.value = true
  try {
    const newPath = await libraryStore.downloadSteamThumbnail(props.program.id, steamAppId.value)
    if (newPath) {
      thumbnailPath.value = newPath
      originalThumbnailPath.value = newPath
      cacheBust.value = Date.now()
      message.success('Steam 커버를 다시 받았습니다')
    } else {
      message.error('Steam 커버를 받지 못했습니다 (AppID 또는 네트워크 확인)')
    }
  } finally {
    isSubmitting.value = false
  }
}

// Pull an icon from Steam's local librarycache (no CDN, no crop).
// Runs immediately — Steam-sourced icons don't need user curation.
const handleApplySteamCachedIcon = async () => {
  if (!props.program || steamAppId.value === null) return
  isSubmitting.value = true
  try {
    const newPath = await libraryStore.applySteamCachedIcon(props.program.id, steamAppId.value)
    if (newPath) {
      iconPath.value = newPath
      originalIconPath.value = newPath
      cacheBust.value = Date.now()
      message.success('Steam 캐시에서 아이콘을 가져왔습니다')
    } else {
      message.warning('Steam 캐시에서 아이콘을 찾지 못했습니다')
    }
  } finally {
    isSubmitting.value = false
  }
}

// Icon re-extract: runs immediately (not deferred), since the operation
// produces a new file at the same path — we want instant visual feedback.
const handleReextractIcon = async () => {
  if (!props.program || !canReextractIcon.value) return
  isSubmitting.value = true
  try {
    const newPath = await libraryStore.reextractIcon(props.program.id, executablePath.value)
    if (newPath) {
      // Adopt the fresh path as the new baseline so previews switch to wl-image.
      iconPath.value = newPath
      originalIconPath.value = newPath
      cacheBust.value = Date.now()
      message.success('아이콘을 추출했습니다')
    } else {
      message.error('아이콘 추출에 실패했습니다')
    }
  } finally {
    isSubmitting.value = false
  }
}

// Submit form
const handleSubmit = async () => {
  if (!isValid.value || !props.program) return
  
  isSubmitting.value = true
  
  try {
    const updatedProgram = await libraryStore.updateProgram({
      id: props.program.id,
      title: title.value.trim(),
      executablePath: executablePath.value,
      tags: [...tags.value]
    })
    
    if (updatedProgram) {
      if (thumbnailChanged.value) {
        if (thumbnailPath.value === null) {
          await libraryStore.deleteThumbnail(props.program.id)
        } else {
          await libraryStore.saveThumbnail(props.program.id, thumbnailPath.value)
        }
      }

      if (iconChanged.value) {
        if (iconPath.value === null) {
          await libraryStore.deleteIcon(props.program.id)
        } else {
          await libraryStore.saveIcon(props.program.id, iconPath.value)
        }
      }

      message.success('Program updated successfully')
      emit('update:show', false)
    } else {
      message.error('Failed to update program')
    }
  } catch (error) {
    message.error('Failed to update program')
    console.error(error)
  } finally {
    isSubmitting.value = false
  }
}

const handleCancel = () => {
  emit('update:show', false)
}

const handleDelete = () => {
  if (!props.program) return
  const program = props.program
  confirmDialog.warning({
    title: '프로그램 삭제',
    content: `"${program.title}"을(를) 삭제하시겠습니까? 되돌릴 수 없습니다.`,
    positiveText: '삭제',
    negativeText: '취소',
    onPositiveClick: async () => {
      const success = await libraryStore.deleteProgram(program.id)
      if (success) {
        message.success('삭제되었습니다')
        emit('update:show', false)
      } else {
        message.error('삭제에 실패했습니다')
      }
    }
  })
}
</script>

<template>
  <NModal
    :show="show"
    @update:show="emit('update:show', $event)"
    preset="card"
    title="Edit Program"
    :bordered="false"
    size="medium"
    :style="{ width: '520px' }"
    :mask-closable="false"
  >
    <div v-if="program" :class="themeClass">
    <NForm label-placement="top">
      <!-- Thumbnail section -->
      <div
        class="media-section"
        :class="{ 'is-drag-over': thumbInput.isDragOver.value }"
        @dragenter="thumbInput.onDragEnter"
        @dragover="thumbInput.onDragOver"
        @dragleave="thumbInput.onDragLeave"
        @drop="handleThumbDrop"
      >
        <div class="media-label">썸네일 (600×900)</div>
        <div class="media-row">
          <div class="thumbnail-preview" :class="{ 'is-empty': !thumbnailPreview }">
            <NImage
              v-if="thumbnailPreview"
              :src="thumbnailPreview"
              object-fit="cover"
              width="160"
              height="240"
              preview-disabled
            />
            <div v-else class="thumbnail-placeholder">
              <NIcon :component="ImageIcon" :size="40" />
              <span>여기로 드래그</span>
            </div>
          </div>
          <div class="media-actions">
            <NButton @click="handleSelectThumbnail" block>
              <template #icon><NIcon :component="ImageIcon" /></template>
              파일에서 선택
            </NButton>
            <NInputGroup>
              <NInput
                v-model:value="thumbUrl"
                placeholder="이미지 URL"
                @keydown.enter.prevent="handleFetchThumbUrl"
              />
              <NButton
                type="primary"
                :disabled="!thumbUrl.trim() || thumbInput.isFetching.value"
                :loading="thumbInput.isFetching.value"
                @click="handleFetchThumbUrl"
              >
                <template #icon><NIcon :component="LinkIcon" /></template>
                가져오기
              </NButton>
            </NInputGroup>
            <NButton
              v-if="steamAppId !== null"
              @click="handleOpenArtworkDialog"
              :disabled="isSubmitting"
              block
            >
              <template #icon><NIcon :component="CloudDownloadIcon" /></template>
              Steam 아트워크 선택
            </NButton>
            <NButton
              v-if="steamAppId !== null"
              @click="handleSteamRedownload"
              :disabled="isSubmitting"
              quaternary
              block
            >
              기본 커버로 복원
            </NButton>
            <NButton
              v-if="thumbnailPath"
              @click="handleRemoveThumbnail"
              quaternary
              block
            >
              <template #icon><NIcon :component="CloseIcon" /></template>
              제거
            </NButton>
          </div>
        </div>
      </div>

      <!-- Icon section -->
      <div
        class="media-section"
        :class="{ 'is-drag-over': iconInput.isDragOver.value }"
        @dragenter="iconInput.onDragEnter"
        @dragover="iconInput.onDragOver"
        @dragleave="iconInput.onDragLeave"
        @drop="handleIconDrop"
      >
        <div class="media-label">아이콘 (256×256)</div>
        <div class="media-row">
          <div class="icon-preview" :class="{ 'is-empty': !iconPreview }">
            <NImage
              v-if="iconPreview"
              :src="iconPreview"
              object-fit="cover"
              width="120"
              height="120"
              preview-disabled
            />
            <div v-else class="icon-placeholder">
              <NIcon :component="ImageIcon" :size="32" />
              <span>여기로 드래그</span>
            </div>
          </div>
          <div class="media-actions">
            <NButton @click="handleSelectIcon" block>
              <template #icon><NIcon :component="ImageIcon" /></template>
              파일에서 선택
            </NButton>
            <NInputGroup>
              <NInput
                v-model:value="iconUrl"
                placeholder="이미지 URL"
                @keydown.enter.prevent="handleFetchIconUrl"
              />
              <NButton
                type="primary"
                :disabled="!iconUrl.trim() || iconInput.isFetching.value"
                :loading="iconInput.isFetching.value"
                @click="handleFetchIconUrl"
              >
                <template #icon><NIcon :component="LinkIcon" /></template>
                가져오기
              </NButton>
            </NInputGroup>
            <NButton
              v-if="canReextractIcon"
              @click="handleReextractIcon"
              :disabled="isSubmitting"
              block
            >
              <template #icon><NIcon :component="RefreshIcon" /></template>
              .exe에서 재추출
            </NButton>
            <NButton
              v-if="steamAppId !== null"
              @click="handleApplySteamCachedIcon"
              :disabled="isSubmitting"
              block
            >
              <template #icon><NIcon :component="CloudDownloadIcon" /></template>
              Steam 캐시에서 가져오기
            </NButton>
            <NButton
              v-if="iconPath"
              @click="handleRemoveIcon"
              quaternary
              block
            >
              <template #icon><NIcon :component="CloseIcon" /></template>
              제거
            </NButton>
          </div>
        </div>
      </div>

      <!-- Title -->
      <NFormItem label="Title" required>
        <NInput 
          v-model:value="title" 
          placeholder="Enter program title"
          clearable
        />
      </NFormItem>

      <!-- Executable Path -->
      <NFormItem label="Executable Path" required>
        <NInput 
          v-model:value="executablePath" 
          placeholder="Select executable file"
          readonly
        >
          <template #suffix>
            <NButton quaternary size="small" @click="handleSelectExecutable">
              <template #icon>
                <NIcon :component="FolderIcon" />
              </template>
            </NButton>
          </template>
        </NInput>
      </NFormItem>

      <!-- Tags -->
      <NFormItem label="Tags">
        <NDynamicTags v-model:value="tags" />
      </NFormItem>
    </NForm>
    </div>

    <template #footer>
      <div class="footer-split">
        <NButton
          type="error"
          ghost
          @click="handleDelete"
          :disabled="isSubmitting"
        >
          <template #icon>
            <NIcon :component="DeleteIcon" />
          </template>
          Delete
        </NButton>
        <NSpace>
          <NButton @click="handleCancel" :disabled="isSubmitting">
            Cancel
          </NButton>
          <NButton
            type="primary"
            @click="handleSubmit"
            :disabled="!isValid"
            :loading="isSubmitting"
          >
            Save
          </NButton>
        </NSpace>
      </div>
    </template>

    <ImageCropDialog
      v-model:show="showCropDialog"
      :source="cropSourceUrl"
      :aspect-ratio="cropAspect"
      :title="cropTarget === 'icon' ? '아이콘 크롭 (1:1)' : '썸네일 크롭 (2:3)'"
      @confirm="handleCropConfirm"
    />

    <SteamArtworkDialog
      v-model:show="showArtworkDialog"
      :app-id="steamAppId"
      @selected="handleArtworkSelected"
    />
  </NModal>
</template>

<style scoped>
.media-section {
  margin-bottom: 16px;
  padding: 12px 16px;
  background-color: #3f3f46;
  border-radius: 8px;
  transition: box-shadow 0.15s ease;
}

.light-theme .media-section {
  background-color: #f4f4f5;
}

.media-section.is-drag-over {
  box-shadow: 0 0 0 2px #e87ea1;
}

.light-theme .media-section.is-drag-over {
  box-shadow: 0 0 0 2px #db2777;
}

.media-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #a1a1aa;
  margin-bottom: 10px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.light-theme .media-label {
  color: #52525b;
}

.media-row {
  display: flex;
  gap: 16px;
  align-items: stretch;
}

.thumbnail-preview,
.icon-preview {
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.thumbnail-preview {
  width: 160px;
  height: 240px;
}

.icon-preview {
  width: 120px;
  height: 120px;
}

.thumbnail-preview.is-empty,
.icon-preview.is-empty {
  border: 2px dashed #52525b;
  background-color: #27272a;
}

.light-theme .thumbnail-preview.is-empty,
.light-theme .icon-preview.is-empty {
  border-color: #d4d4d8;
  background-color: #e4e4e7;
}

.media-section.is-drag-over .thumbnail-preview.is-empty,
.media-section.is-drag-over .icon-preview.is-empty {
  border-color: #e87ea1;
}

.light-theme .media-section.is-drag-over .thumbnail-preview.is-empty,
.light-theme .media-section.is-drag-over .icon-preview.is-empty {
  border-color: #db2777;
}

.thumbnail-placeholder,
.icon-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #71717a;
  font-size: 0.8rem;
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

.footer-split {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
</style>
