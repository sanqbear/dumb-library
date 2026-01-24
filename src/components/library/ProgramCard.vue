<script setup lang="ts">
import { computed, ref, h } from 'vue'
import { NCard, NImage, NButton, NIcon, NDropdown, NTag, NSpace, useMessage, useDialog } from 'naive-ui'
import { 
  Play as PlayIcon, 
  EllipsisVertical as MoreIcon,
  Create as EditIcon,
  Trash as DeleteIcon,
  Image as ImageIcon
} from '@vicons/ionicons5'
import type { Program } from '../../types'
import { useLibraryStore } from '../../stores/libraryStore'
import EditProgramDialog from '../dialogs/EditProgramDialog.vue'

const props = defineProps<{
  program: Program
}>()

const libraryStore = useLibraryStore()
const message = useMessage()
const dialog = useDialog()

const showEditDialog = ref(false)
const isHovered = ref(false)

const displayImage = computed(() => {
  if (props.program.thumbnailPath) return `file://${props.program.thumbnailPath}`
  if (props.program.iconPath) return `file://${props.program.iconPath}`
  return ''
})

const hasImage = computed(() => !!displayImage.value)

const menuOptions = [
  {
    label: 'Edit',
    key: 'edit',
    icon: () => h(NIcon, { component: EditIcon })
  },
  {
    label: 'Change Thumbnail',
    key: 'thumbnail',
    icon: () => h(NIcon, { component: ImageIcon })
  },
  {
    type: 'divider',
    key: 'd1'
  },
  {
    label: 'Delete',
    key: 'delete',
    icon: () => h(NIcon, { component: DeleteIcon })
  }
]

const handleLaunch = async () => {
  try {
    await libraryStore.launchProgram(props.program)
    message.success(`Launching ${props.program.title}`)
  } catch (error) {
    message.error('Failed to launch program')
  }
}

const handleDoubleClick = () => {
  handleLaunch()
}

const handleMenuSelect = async (key: string) => {
  switch (key) {
    case 'edit':
      showEditDialog.value = true
      break
    case 'thumbnail':
      await handleChangeThumbnail()
      break
    case 'delete':
      handleDelete()
      break
  }
}

const handleChangeThumbnail = async () => {
  const imagePath = await window.electron.selectImage()
  if (imagePath) {
    const result = await libraryStore.saveThumbnail(props.program.id, imagePath)
    if (result) {
      message.success('Thumbnail updated')
    } else {
      message.error('Failed to update thumbnail')
    }
  }
}

const handleDelete = () => {
  dialog.warning({
    title: 'Delete Program',
    content: `Are you sure you want to delete "${props.program.title}"?`,
    positiveText: 'Delete',
    negativeText: 'Cancel',
    onPositiveClick: async () => {
      const success = await libraryStore.deleteProgram(props.program.id)
      if (success) {
        message.success('Program deleted')
      } else {
        message.error('Failed to delete program')
      }
    }
  })
}
</script>

<template>
  <NCard 
    class="program-card card-hover no-select"
    :bordered="false"
    content-style="padding: 0"
    @dblclick="handleDoubleClick"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Image area -->
    <div class="card-image">
      <NImage
        v-if="hasImage"
        :src="displayImage"
        object-fit="cover"
        width="100%"
        height="100%"
        preview-disabled
        :fallback-src="undefined"
      />
      <div v-else class="placeholder-image">
        <NIcon :component="ImageIcon" :size="48" />
      </div>

      <!-- Overlay on hover -->
      <div v-show="isHovered" class="card-overlay">
        <NButton 
          type="primary" 
          circle 
          size="large"
          @click.stop="handleLaunch"
        >
          <template #icon>
            <NIcon :component="PlayIcon" />
          </template>
        </NButton>
      </div>

      <!-- Menu button -->
      <div class="card-menu">
        <NDropdown 
          trigger="click" 
          :options="menuOptions"
          @select="handleMenuSelect"
        >
          <NButton 
            quaternary 
            circle 
            size="small"
            @click.stop
          >
            <template #icon>
              <NIcon :component="MoreIcon" />
            </template>
          </NButton>
        </NDropdown>
      </div>
    </div>

    <!-- Info area -->
    <div class="card-info">
      <div class="card-title truncate">{{ program.title }}</div>
      <NSpace size="small" v-if="program.category || program.tags.length > 0">
        <NTag v-if="program.category" size="small" type="info">
          {{ program.category }}
        </NTag>
      </NSpace>
    </div>

    <!-- Edit Dialog -->
    <EditProgramDialog 
      v-model:show="showEditDialog"
      :program="program"
    />
  </NCard>
</template>

<style scoped>
.program-card {
  background-color: #27272a;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
}

.light-theme .program-card {
  background-color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card-image {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  background-color: #3f3f46;
  overflow: hidden;
}

.light-theme .card-image {
  background-color: #e4e4e7;
}

.placeholder-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #71717a;
}

.card-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-menu {
  position: absolute;
  top: 4px;
  right: 4px;
}

.card-info {
  padding: 12px;
}

.card-title {
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 4px;
}
</style>
