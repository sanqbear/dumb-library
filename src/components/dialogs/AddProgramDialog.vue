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
  useMessage
} from 'naive-ui'
import { FolderOpen as FolderIcon, Image as ImageIcon, Close as CloseIcon, LinkOutline as LinkIcon } from '@vicons/ionicons5'
import { useLibraryStore } from '../../stores/libraryStore'
import { useImageInput } from '../../composables/useImageInput'
import ImageCropDialog from './ImageCropDialog.vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const libraryStore = useLibraryStore()
const message = useMessage()

// Drag&drop + URL fetch shared helpers
const thumbInput = useImageInput()

// Form data
const title = ref('')
const executablePath = ref('')
const tags = ref<string[]>([])
const thumbnailPath = ref<string | null>(null)
const thumbnailPreview = ref<string>('')
const thumbUrl = ref('')

// Crop flow — once a source is picked (file picker / drag / URL), we open
// the crop dialog. User confirms the crop → we get a temp file path holding
// the cropped bytes, which becomes our new `thumbnailPath`.
const showCropDialog = ref(false)
const cropSourceUrl = ref('')

const isSubmitting = ref(false)

// Preview is always a data URL — the selected source file lives outside
// userData so we can't serve it via wl-image:// yet. Translate via IPC.
watch(thumbnailPath, async (value) => {
  if (!value) {
    thumbnailPreview.value = ''
    return
  }
  thumbnailPreview.value = (await window.electron.readImageAsDataUrl(value)) ?? ''
})

// Reset form when dialog closes
watch(() => props.show, (newVal) => {
  if (!newVal) {
    title.value = ''
    executablePath.value = ''
    tags.value = []
    thumbnailPath.value = null
    thumbnailPreview.value = ''
    thumbUrl.value = ''
  }
})

// Opens the crop dialog for a newly acquired source (file/drop/URL).
const openCropFor = async (absSourcePath: string) => {
  const dataUrl = await window.electron.readImageAsDataUrl(absSourcePath)
  if (!dataUrl) {
    message.error('이미지를 읽지 못했습니다')
    return
  }
  cropSourceUrl.value = dataUrl
  showCropDialog.value = true
}

const handleCropConfirm = (tempPath: string) => {
  thumbnailPath.value = tempPath
}

// Drop handlers for the thumbnail preview area
const handleThumbDrop = async (e: DragEvent) => {
  const absPath = thumbInput.onDrop(e)
  if (absPath) {
    await openCropFor(absPath)
  } else {
    message.warning('이미지 파일만 지원합니다')
  }
}

const handleFetchThumbUrl = async () => {
  const tempPath = await thumbInput.fetchFromUrl(thumbUrl.value)
  if (tempPath) {
    thumbUrl.value = ''
    await openCropFor(tempPath)
  } else {
    message.error('URL에서 이미지를 가져오지 못했습니다')
  }
}

// Validation
const isValid = computed(() => {
  return title.value.trim() !== '' && executablePath.value.trim() !== ''
})

// Select executable file
const handleSelectExecutable = async () => {
  const path = await window.electron.selectExecutable()
  if (path) {
    executablePath.value = path
    // Auto-fill title from filename if empty
    if (!title.value.trim()) {
      const fileName = path.split('\\').pop()?.replace('.exe', '') || ''
      title.value = fileName
    }
  }
}

// Select thumbnail image via OS file picker
const handleSelectThumbnail = async () => {
  const path = await window.electron.selectImage()
  if (path) {
    await openCropFor(path)
  }
}

// Remove thumbnail
const handleRemoveThumbnail = () => {
  thumbnailPath.value = null
}

// Submit form
const handleSubmit = async () => {
  if (!isValid.value) return
  
  isSubmitting.value = true
  
  try {
    const newProgram = await libraryStore.addProgram({
      title: title.value.trim(),
      executablePath: executablePath.value,
      tags: [...tags.value]
    })
    
    if (newProgram) {
      // Save thumbnail if selected
      if (thumbnailPath.value) {
        await libraryStore.saveThumbnail(newProgram.id, thumbnailPath.value)
      }
      
      message.success('Program added successfully')
      emit('update:show', false)
    } else {
      message.error('Failed to add program')
    }
  } catch (error) {
    message.error('Failed to add program')
    console.error(error)
  } finally {
    isSubmitting.value = false
  }
}

const handleCancel = () => {
  emit('update:show', false)
}
</script>

<template>
  <NModal
    :show="show"
    @update:show="emit('update:show', $event)"
    preset="card"
    title="Add Program"
    :bordered="false"
    size="medium"
    :style="{ width: '480px' }"
    :mask-closable="false"
  >
    <NForm label-placement="top">
      <!-- Thumbnail -->
      <div class="thumbnail-section">
        <div
          class="thumbnail-preview"
          :class="{ 'is-drag-over': thumbInput.isDragOver.value }"
          @dragenter="thumbInput.onDragEnter"
          @dragover="thumbInput.onDragOver"
          @dragleave="thumbInput.onDragLeave"
          @drop="handleThumbDrop"
        >
          <NImage
            v-if="thumbnailPreview"
            :src="thumbnailPreview"
            object-fit="cover"
            width="120"
            height="180"
            preview-disabled
          />
          <div v-else class="thumbnail-placeholder">
            <NIcon :component="ImageIcon" :size="32" />
            <span>드래그 또는 선택</span>
          </div>
        </div>
        <div class="thumbnail-actions">
          <NButton @click="handleSelectThumbnail" size="small">
            <template #icon><NIcon :component="ImageIcon" /></template>
            Select Image
          </NButton>
          <NButton
            v-if="thumbnailPath"
            @click="handleRemoveThumbnail"
            size="small"
            quaternary
          >
            <template #icon><NIcon :component="CloseIcon" /></template>
            Remove
          </NButton>
          <NInputGroup size="small">
            <NInput
              v-model:value="thumbUrl"
              placeholder="이미지 URL"
              :loading="thumbInput.isFetching.value"
              @keydown.enter.prevent="handleFetchThumbUrl"
            />
            <NButton
              type="primary"
              size="small"
              :disabled="!thumbUrl.trim() || thumbInput.isFetching.value"
              :loading="thumbInput.isFetching.value"
              @click="handleFetchThumbUrl"
            >
              <template #icon><NIcon :component="LinkIcon" /></template>
            </NButton>
          </NInputGroup>
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

    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleCancel" :disabled="isSubmitting">
          Cancel
        </NButton>
        <NButton
          type="primary"
          @click="handleSubmit"
          :disabled="!isValid"
          :loading="isSubmitting"
        >
          Add
        </NButton>
      </NSpace>
    </template>

    <ImageCropDialog
      v-model:show="showCropDialog"
      :source="cropSourceUrl"
      :aspect-ratio="2 / 3"
      title="썸네일 크롭 (2:3)"
      @confirm="handleCropConfirm"
    />
  </NModal>
</template>

<style scoped>
.thumbnail-section {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding: 16px;
  background-color: #3f3f46;
  border-radius: 8px;
}

.light-theme .thumbnail-section {
  background-color: #f4f4f5;
}

.thumbnail-preview {
  width: 120px;
  height: 180px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.thumbnail-preview.is-drag-over {
  box-shadow: 0 0 0 2px #e87ea1;
  transform: scale(1.02);
}

:global(.light-theme) .thumbnail-preview.is-drag-over {
  box-shadow: 0 0 0 2px #db2777;
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: #27272a;
  color: #71717a;
  font-size: 0.75rem;
}

.light-theme .thumbnail-placeholder {
  background-color: #e4e4e7;
}

.thumbnail-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}
</style>
