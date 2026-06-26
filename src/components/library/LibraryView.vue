<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
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
  libraryStore.effectiveSearch.trim() !== '' ||
  libraryStore.selectedCategory !== null ||
  libraryStore.selectedTags.length > 0
)

// Scroll a randomly-picked program into view. The grid sets data-program-id
// on each card root and the list sets it via row-props, so a single selector
// covers both view modes. nextTick gives the DOM time to update if a filter
// reset happened in pickRandom().
watch(
  () => libraryStore.highlightedProgramId,
  async (id) => {
    if (!id) return
    await nextTick()
    const el = document.querySelector(`[data-program-id="${CSS.escape(id)}"]`) as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
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
