<script setup lang="ts">
import { computed, ref } from 'vue'
import { NCard, NImage, NIcon, NTag, useMessage } from 'naive-ui'
import { Play as PlayIcon, Image as ImageIcon } from '@vicons/ionicons5'
import type { Program } from '../../types'
import { PROVIDERS } from '../../types'
import { useLibraryStore } from '../../stores/libraryStore'
import EditProgramDialog from '../dialogs/EditProgramDialog.vue'

const props = defineProps<{
  program: Program
}>()

const libraryStore = useLibraryStore()
const message = useMessage()

const showEditDialog = ref(false)
const isHovered = ref(false)

const displayImage = computed(() => {
  if (props.program.thumbnailPath) return `file://${props.program.thumbnailPath}`
  if (props.program.iconPath) return `file://${props.program.iconPath}`
  return ''
})

const hasImage = computed(() => !!displayImage.value)

const handleLaunch = async () => {
  try {
    await libraryStore.launchProgram(props.program)
    message.success(`Launching ${props.program.title}`)
  } catch (error) {
    message.error('Failed to launch program')
  }
}

const handleCardClick = () => {
  showEditDialog.value = true
}
</script>

<template>
  <NCard
    class="program-card card-hover no-select"
    :bordered="false"
    content-style="padding: 0"
    @click="handleCardClick"
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
      <div v-show="isHovered" class="card-overlay" @click.stop="handleCardClick">
        <button class="launch-btn" @click.stop="handleLaunch" aria-label="실행">
          <NIcon :component="PlayIcon" :size="32" />
        </button>
      </div>
    </div>

    <!-- Info area -->
    <div class="card-info">
      <div class="card-title truncate">{{ program.title }}</div>
      <div class="card-meta">
        <NTag size="small" type="info">
          {{ PROVIDERS[program.category].label }}
        </NTag>
        <NTag
          v-for="tag in program.tags.slice(0, 2)"
          :key="tag"
          size="small"
        >
          {{ tag }}
        </NTag>
        <NTag v-if="program.tags.length > 2" size="small" :bordered="false">
          +{{ program.tags.length - 2 }}
        </NTag>
      </div>
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
  cursor: pointer;
}

.launch-btn {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: none;
  background-color: #e87ea1;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  padding-left: 4px; /* optical-center the play triangle */
}

:global(.light-theme) .launch-btn {
  background-color: #db2777;
}

.launch-btn:hover {
  transform: scale(1.06);
  background-color: #f093b0;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}

:global(.light-theme) .launch-btn:hover {
  background-color: #ec4899;
}

.launch-btn:active {
  transform: scale(0.98);
  background-color: #c96081;
}

:global(.light-theme) .launch-btn:active {
  background-color: #be185d;
}

.card-info {
  padding: 12px;
}

.card-title {
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 6px;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
