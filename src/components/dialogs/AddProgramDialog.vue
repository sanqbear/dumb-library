<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { 
  NModal, 
  NForm, 
  NFormItem, 
  NInput, 
  NButton, 
  NSpace, 
  NSelect,
  NDynamicTags,
  NImage,
  NIcon,
  useMessage
} from 'naive-ui'
import { FolderOpen as FolderIcon, Image as ImageIcon, Close as CloseIcon } from '@vicons/ionicons5'
import { useLibraryStore } from '../../stores/libraryStore'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const libraryStore = useLibraryStore()
const message = useMessage()

// Form data
const title = ref('')
const executablePath = ref('')
const category = ref<string | null>(null)
const tags = ref<string[]>([])
const thumbnailPath = ref<string | null>(null)

const isSubmitting = ref(false)

// Category options
const categoryOptions = computed(() => {
  return libraryStore.categories.map(cat => ({
    label: cat,
    value: cat
  }))
})

// Reset form when dialog closes
watch(() => props.show, (newVal) => {
  if (!newVal) {
    title.value = ''
    executablePath.value = ''
    category.value = null
    tags.value = []
    thumbnailPath.value = null
  }
})

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

// Select thumbnail image
const handleSelectThumbnail = async () => {
  const path = await window.electron.selectImage()
  if (path) {
    thumbnailPath.value = path
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
      category: category.value || null,
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
      <!-- Thumbnail preview -->
      <div class="thumbnail-section">
        <div class="thumbnail-preview">
          <NImage
            v-if="thumbnailPath"
            :src="`file://${thumbnailPath}`"
            object-fit="cover"
            width="120"
            height="160"
            preview-disabled
          />
          <div v-else class="thumbnail-placeholder">
            <NIcon :component="ImageIcon" :size="32" />
            <span>No thumbnail</span>
          </div>
        </div>
        <div class="thumbnail-actions">
          <NButton @click="handleSelectThumbnail" size="small">
            <template #icon>
              <NIcon :component="ImageIcon" />
            </template>
            Select Image
          </NButton>
          <NButton 
            v-if="thumbnailPath" 
            @click="handleRemoveThumbnail" 
            size="small"
            quaternary
          >
            <template #icon>
              <NIcon :component="CloseIcon" />
            </template>
            Remove
          </NButton>
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

      <!-- Category -->
      <NFormItem label="Category">
        <NSelect
          v-model:value="category"
          :options="categoryOptions"
          placeholder="Select or create category"
          clearable
          filterable
          tag
          @create="(label: string) => ({ label, value: label })"
        />
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
  height: 160px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
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
