<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted, onActivated, onBeforeUnmount } from 'vue'
import { NSpin } from 'naive-ui'
import { useLibraryStore } from '../../stores/libraryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import LibraryGrid from './LibraryGrid.vue'
import LibraryList from './LibraryList.vue'
import EmptyState from './EmptyState.vue'

// Named so <keep-alive include="['LibraryView']"> in App.vue can target it —
// keep-alive keeps the grid's incremental-render window mounted so a deep scroll
// position is actually reachable when we restore it.
defineOptions({ name: 'LibraryView' })

const libraryStore = useLibraryStore()
const settingsStore = useSettingsStore()

// Scroll-position persistence. The element that actually scrolls differs by
// view mode and isn't always .library-view itself: the grid scrolls inside
// NSpin's wrapper, the list inside the data table's scrollbar container. Rather
// than guess per mode, we remember whichever element inside the view last fired
// a scroll event and restore that same node (keep-alive preserves it).
const rootEl = ref<HTMLElement | null>(null)
let scrollerEl: HTMLElement | null = null

// Capture-phase listener on the root catches scrolls from the root *and* any
// descendant (scroll doesn't bubble, but it fires during capture). Naive's
// popovers/dropdowns teleport to <body>, so they're not contained here and
// can't clobber the saved value. This keeps the stored position current on
// every movement — we intentionally do NOT re-read scrollTop at deactivate
// time, because keep-alive has by then detached the node and it reports 0.
const handleScroll = (e: Event): void => {
  const target = e.target as HTMLElement | null
  if (!target || !rootEl.value || !rootEl.value.contains(target)) return
  scrollerEl = target
  libraryStore.setLibraryScrollTop(target.scrollTop)
}

// Restore can race the DOM: right after <keep-alive> re-attaches, the scroll
// container's height may not be settled, so a single assignment can get clamped
// back to 0. Re-apply across a few animation frames until it sticks.
const restoreScroll = (): void => {
  const target = libraryStore.libraryScrollTop
  if (target <= 0 || !scrollerEl) return
  let tries = 0
  const apply = (): void => {
    const el = scrollerEl
    if (el) {
      el.scrollTop = target
      if (Math.abs(el.scrollTop - target) <= 1) return
    }
    if (tries++ < 30) requestAnimationFrame(apply)
  }
  requestAnimationFrame(apply)
}

onMounted(() => {
  rootEl.value?.addEventListener('scroll', handleScroll, { capture: true, passive: true })
})

onActivated(() => {
  restoreScroll()
})

onBeforeUnmount(() => {
  rootEl.value?.removeEventListener('scroll', handleScroll, { capture: true })
})

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
  <div
    class="library-view"
    :class="{ 'is-list': settingsStore.viewMode === 'list' && !isEmpty }"
    ref="rootEl"
  >
    <NSpin
      :show="libraryStore.isLoading"
      description="Loading..."
      class="view-spin"
      content-class="view-spin-content"
    >
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

/* List mode: the table owns the scroll, so this container must NOT scroll
   (avoids a scrollbar nested inside the table's own). Turn it into a flex
   column and stretch NSpin's wrappers so the table's flex-height resolves. */
.library-view.is-list {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.library-view.is-list :deep(.view-spin) {
  flex: 1;
  min-height: 0;
}

.library-view.is-list :deep(.view-spin .view-spin-content) {
  height: 100%;
}
</style>
