<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useLibraryStore } from '../../stores/libraryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import type { GridCardSize } from '../../types'
import ProgramCard from './ProgramCard.vue'

const libraryStore = useLibraryStore()
const settingsStore = useSettingsStore()

// Minimum card width per user-selected density; the grid auto-fills columns.
const CARD_MIN: Record<GridCardSize, string> = {
  small: '150px',
  medium: '180px',
  large: '230px'
}
const gridStyle = computed(() => ({ '--card-min': CARD_MIN[settingsStore.gridCardSize] }))

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

// Arrow-key navigation between cards. Cards are tabbable; arrows move focus by
// one card (left/right) or one visual row (up/down, using the grid's current
// column count). Reaching past the rendered window loads the next batch first.
const gridEl = ref<HTMLElement | null>(null)

const focusCard = (cards: HTMLElement[], index: number) => {
  const card = cards[index]
  if (!card) return
  card.focus()
  card.scrollIntoView({ block: 'nearest' })
}

const handleGridKeydown = (e: KeyboardEvent) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
  const grid = gridEl.value
  if (!grid) return
  const active = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.program-card')
  if (!active) return
  const cards = Array.from(grid.querySelectorAll<HTMLElement>('.program-card'))
  const index = cards.indexOf(active)
  if (index === -1) return
  const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length
  const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' ? -columns : columns
  const target = index + delta
  if (target < 0) return
  e.preventDefault()
  if (target >= cards.length) {
    if (!hasMore.value) return
    loadMore()
    nextTick(() => {
      const grown = grid ? Array.from(grid.querySelectorAll<HTMLElement>('.program-card')) : []
      focusCard(grown, Math.min(target, grown.length - 1))
    })
    return
  }
  focusCard(cards, target)
}

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
    <div ref="gridEl" class="library-grid" :style="gridStyle" @keydown="handleGridKeydown">
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
.library-grid {
  display: grid;
  /* --card-min is set inline from the user's card-size setting. */
  grid-template-columns: repeat(auto-fill, minmax(var(--card-min, 180px), 1fr));
  gap: 16px;
  padding: 4px;
}

/* Zero-height trigger row watched by the IntersectionObserver. */
.grid-sentinel {
  width: 100%;
  height: 1px;
}
</style>
