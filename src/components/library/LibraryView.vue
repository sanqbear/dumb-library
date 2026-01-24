<script setup lang="ts">
import { computed } from 'vue'
import { NSpin } from 'naive-ui'
import { useLibraryStore } from '../../stores/libraryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import LibraryGrid from './LibraryGrid.vue'
import LibraryList from './LibraryList.vue'
import EmptyState from './EmptyState.vue'

const libraryStore = useLibraryStore()
const settingsStore = useSettingsStore()

const isEmpty = computed(() => libraryStore.filteredPrograms.length === 0)
const isFiltered = computed(() => 
  libraryStore.searchQuery.trim() !== '' || 
  libraryStore.selectedCategory !== null ||
  libraryStore.selectedTags.length > 0
)
</script>

<template>
  <div class="library-view">
    <NSpin :show="libraryStore.isLoading" description="Loading...">
      <template v-if="isEmpty">
        <EmptyState :is-filtered="isFiltered" />
      </template>
      <template v-else>
        <LibraryGrid v-if="settingsStore.viewMode === 'grid'" />
        <LibraryList v-else />
      </template>
    </NSpin>
  </div>
</template>

<style scoped>
.library-view {
  height: 100%;
  overflow: auto;
}
</style>
