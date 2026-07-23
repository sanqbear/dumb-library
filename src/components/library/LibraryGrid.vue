<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useLibraryStore } from '../../stores/libraryStore'
import ProgramCard from './ProgramCard.vue'

const libraryStore = useLibraryStore()

// Incremental ("infinite scroll") rendering: only the first `visibleCount`
// filtered programs are mounted, and more are appended as the user scrolls near
// the bottom. This bounds initial DOM/image cost for large libraries without
// the variable-card-height complexity of full windowed virtualization.
const INITIAL_COUNT = 60
const BATCH = 40
const visibleCount = ref(INITIAL_COUNT)

const visiblePrograms = computed(() =>
  libraryStore.filteredPrograms.slice(0, visibleCount.value)
)
const hasMore = computed(() => visibleCount.value < libraryStore.filteredPrograms.length)

const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const loadMore = () => {
  if (!hasMore.value) return
  visibleCount.value = Math.min(visibleCount.value + BATCH, libraryStore.filteredPrograms.length)
}

// Re-arm the observer so it re-evaluates the sentinel's position after the DOM
// grows. IntersectionObserver only fires on intersection *changes*; if the
// sentinel is still within rootMargin after a load, re-observing pumps another
// callback so we keep filling until it's pushed out of range (or nothing left).
const rearm = () => {
  nextTick(() => {
    if (sentinel.value && observer) {
      observer.unobserve(sentinel.value)
      observer.observe(sentinel.value)
    }
  })
}

// Reset the window only when the *filter criteria* change — not when the
// underlying programs mutate (a background thumbnail patch bumps updatedAt and
// recomputes filteredPrograms, but must not collapse the scroll window).
watch(
  () => [
    libraryStore.effectiveSearch,
    libraryStore.selectedCategory,
    libraryStore.selectedTags,
    libraryStore.sortBy,
    libraryStore.sortOrder
  ],
  () => {
    visibleCount.value = INITIAL_COUNT
    rearm()
  }
)

// A random-picked program can sit anywhere in the filtered list — beyond the
// current window. Expand so LibraryView can scroll it into view.
watch(
  () => libraryStore.highlightedProgramId,
  (id) => {
    if (!id) return
    const idx = libraryStore.filteredPrograms.findIndex(p => p.id === id)
    if (idx >= visibleCount.value) {
      visibleCount.value = Math.min(idx + BATCH, libraryStore.filteredPrograms.length)
    }
  }
)

onMounted(() => {
  // Observe against the scrolling ancestor (LibraryView) so intersection is
  // measured within the scroll container, not just the window.
  const root = (sentinel.value?.closest('.library-view') as HTMLElement | null) ?? null
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some(e => e.isIntersecting) && hasMore.value) {
        loadMore()
        rearm()
      }
    },
    { root, rootMargin: '600px 0px' }
  )
  if (sentinel.value) observer.observe(sentinel.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div class="library-grid-wrap">
    <div class="library-grid">
      <ProgramCard
        v-for="program in visiblePrograms"
        :key="program.id"
        :program="program"
      />
    </div>
    <div ref="sentinel" class="grid-sentinel" aria-hidden="true" />
  </div>
</template>

<style scoped>
/* Tight gutters and no card chrome: the grid should read as a wall of jackets,
   not a page of widgets. The lift on hover needs a little room, so the gutter
   is small rather than absent. */
.library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px;
  padding: 4px;
}

/* Zero-height trigger row watched by the IntersectionObserver. */
.grid-sentinel {
  width: 100%;
  height: 1px;
}
</style>
