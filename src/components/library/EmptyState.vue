<script setup lang="ts">
import { NEmpty, NButton, NIcon } from 'naive-ui'
import { Add as AddIcon, SearchOutline as SearchIcon } from '@vicons/ionicons5'
import { useLibraryStore } from '../../stores/libraryStore'

defineProps<{
  isFiltered: boolean
}>()

const libraryStore = useLibraryStore()

const handleClearFilters = () => {
  libraryStore.clearFilters()
}
</script>

<template>
  <div class="empty-state">
    <NEmpty 
      :description="isFiltered ? 'No programs found' : 'Your library is empty'"
      size="large"
    >
      <template #icon>
        <NIcon :component="isFiltered ? SearchIcon : AddIcon" :size="64" />
      </template>
      <template #extra>
        <p class="empty-hint" v-if="!isFiltered">
          Click the "Add Program" button to get started
        </p>
        <NButton v-else @click="handleClearFilters">
          Clear Filters
        </NButton>
      </template>
    </NEmpty>
  </div>
</template>

<style scoped>
.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-hint {
  color: #71717a;
  margin-top: 8px;
}
</style>
