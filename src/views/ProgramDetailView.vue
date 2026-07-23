<script setup lang="ts">
import { computed, h, nextTick, ref, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NImage, NImageGroup, NButton, NIcon, NTag, NDropdown, useMessage, useDialog } from 'naive-ui'
import type { DropdownMixedOption } from 'naive-ui/es/dropdown/src/interface'
import {
  Play as PlayIcon,
  CreateOutline as EditIcon,
  OpenOutline as MarketIcon,
  ArrowBackOutline as BackIcon,
  EllipsisHorizontal as MoreIcon,
  FolderOpenOutline as FolderIcon,
  TrashOutline as TrashIcon,
  ImageOutline as ImageIcon,
  PeopleOutline as DeveloperIcon,
  StorefrontOutline as PublisherIcon
} from '@vicons/ionicons5'
import { useLibraryStore } from '../stores/libraryStore'
import { useDeveloperName } from '../composables/useDeveloperName'
import MarkdownText from '../components/MarkdownText.vue'
import { useTagName } from '../composables/useTagName'
import JacketArt from '../components/library/JacketArt.vue'
import { libImageUrl, type Program } from '../types'

const props = defineProps<{ id: string }>()

const { t } = useI18n()
const router = useRouter()
const libraryStore = useLibraryStore()
const message = useMessage()
const confirmDialog = useDialog()
const { resolveDeveloperName } = useDeveloperName()
const { resolveTagName } = useTagName()

const program = computed(() => libraryStore.programs.find(p => p.id === props.id) ?? null)

const developerName = computed(() => resolveDeveloperName(program.value?.developerId))

// Publisher pill — only shown when it names a different entry than the
// developer (both usually hold the same circle via the form's auto-fill).
const publisherName = computed(() => {
  const p = program.value
  if (!p?.publisherId || p.publisherId === p.developerId) return ''
  return resolveDeveloperName(p.publisherId)
})

// Tag ids on this program; each resolves to its localized name at display time.
const localizedTags = computed(() => program.value?.tags ?? [])

// Deep-links / stale ids: if the program isn't in the store, bounce home.
watch(
  program,
  async (p) => {
    if (!p) {
      await nextTick()
      if (!program.value) router.replace({ name: 'library' })
    }
  },
  { immediate: true }
)

// Scroll the view back to the top when navigating between programs (e.g. via
// the recommendations strip), since Vue reuses this component for the route.
const detailViewRef = ref<HTMLElement | null>(null)
watch(
  () => props.id,
  () => nextTick(() => { if (detailViewRef.value) detailViewRef.value.scrollTop = 0 })
)

const previewUrls = computed(() =>
  program.value ? program.value.previewImages.map(rel => libImageUrl(rel, program.value!.updatedAt)) : []
)

const openExternalLink = async (url: string) => {
  const ok = await window.electron.openExternal(url)
  if (!ok) message.error(t('detailView.marketOpenFailed'))
}

// "Recommended" = other programs that share this one's circles (developer or
// publisher role, same master list) and/or tags. A shared circle is weighted
// above any single shared tag; ties break by title.
const RECOMMENDATION_LIMIT = 8
const recImage = (p: Program): string => {
  if (p.thumbnailPath) return libImageUrl(p.thumbnailPath, p.updatedAt)
  if (p.iconPath) return libImageUrl(p.iconPath, p.updatedAt)
  return ''
}
const recommendations = computed<Program[]>(() => {
  const cur = program.value
  if (!cur) return []
  const curTags = new Set(cur.tags)
  const curCircles = new Set([cur.developerId, cur.publisherId].filter((id): id is string => !!id))
  return libraryStore.programs
    .filter(p => p.id !== cur.id)
    .map(p => {
      let score = 0
      if ((p.developerId && curCircles.has(p.developerId)) ||
          (p.publisherId && curCircles.has(p.publisherId))) score += 5
      for (const tag of p.tags) if (curTags.has(tag)) score += 1
      return { program: p, score }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.program.title.localeCompare(b.program.title, 'ko'))
    .slice(0, RECOMMENDATION_LIMIT)
    .map(x => x.program)
})

const handleOpenRecommendation = (id: string) => {
  router.push({ name: 'detail', params: { id } })
}

// The jacket, shown at size. Previously this art only ever appeared blurred to
// 45% behind the title, so the page hid the one image the user chose for it.
const coverUrl = computed(() => {
  const p = program.value
  if (!p) return ''
  if (p.thumbnailPath) return libImageUrl(p.thumbnailPath, p.updatedAt)
  if (p.iconPath) return libImageUrl(p.iconPath, p.updatedAt)
  return ''
})

const isProtocolUrl = (value: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
const canReveal = computed(() => {
  const exe = program.value?.executablePath
  return !!exe && !isProtocolUrl(exe)
})

const handleLaunch = async () => {
  if (!program.value) return
  try {
    await libraryStore.launchProgram(program.value)
    message.success(t('card.launchSuccess', { title: program.value.title }))
  } catch {
    message.error(t('card.launchFailed'))
  }
}

const handleEdit = () => {
  if (program.value) router.push({ name: 'edit', params: { id: program.value.id } })
}

const handleOpenMarket = async () => {
  if (!program.value) return
  const ok = await libraryStore.openMarketUrl(program.value)
  if (!ok) message.error(t('detailView.marketOpenFailed'))
}

const handleBack = () => {
  router.push({ name: 'library' })
}

// Tag / developer click → jump to the library filtered by just that criterion.
// Replace existing filters so the result is exactly "everything with this
// tag / by this developer", and reset the saved scroll so the list opens at the
// top rather than restoring the previous position.
const handleFilterByTag = (tag: string) => {
  libraryStore.clearFilters()
  libraryStore.setSelectedTags([tag])
  libraryStore.setLibraryScrollTop(0)
  router.push({ name: 'library' })
}

const handleFilterByCircle = (id: string | null | undefined) => {
  if (!id) return
  libraryStore.clearFilters()
  libraryStore.setSelectedDeveloper(id)
  libraryStore.setLibraryScrollTop(0)
  router.push({ name: 'library' })
}

const handleReveal = async () => {
  if (program.value) await libraryStore.revealProgram(program.value)
}

const handleDelete = () => {
  const p = program.value
  if (!p) return
  confirmDialog.warning({
    title: t('editDialog.deleteConfirmTitle'),
    content: t('editDialog.deleteConfirmMessage', { title: p.title }),
    positiveText: t('common.delete'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const success = await libraryStore.deleteProgram(p.id)
      if (success) {
        message.success(t('editDialog.deleted'))
        router.replace({ name: 'library' })
      } else {
        message.error(t('editDialog.deleteFailed'))
      }
    }
  })
}

const renderMenuIcon = (icon: Component) => () => h(NIcon, null, { default: () => h(icon) })
const menuOptions = computed(() => {
  const options: DropdownMixedOption[] = []
  if (canReveal.value) {
    options.push({ label: t('cardMenu.revealInExplorer'), key: 'reveal', icon: renderMenuIcon(FolderIcon) })
  }
  options.push({ label: t('cardMenu.delete'), key: 'delete', icon: renderMenuIcon(TrashIcon) })
  return options
})
const handleMenuSelect = (key: string) => {
  if (key === 'reveal') handleReveal()
  else if (key === 'delete') handleDelete()
}
</script>

<template>
  <div v-if="program" ref="detailViewRef" class="detail-view">
    <div class="detail-topbar">
      <NButton quaternary circle @click="handleBack" :aria-label="t('detailView.back')">
        <template #icon><NIcon :component="BackIcon" /></template>
      </NButton>
      <NDropdown trigger="click" :options="menuOptions" @select="handleMenuSelect">
        <NButton quaternary circle>
          <template #icon><NIcon :component="MoreIcon" /></template>
        </NButton>
      </NDropdown>
    </div>

    <!-- Jacket alongside the record: the cover the user picked is the page's
         opening statement, at size and in focus. It stays put while the notes
         scroll, so the thing being read about never leaves the screen. -->
    <div class="detail-main">
      <div class="hero-jacket">
        <JacketArt :title="program.title" :src="coverUrl" />
      </div>

      <div class="detail-record">
        <header class="record-head">
          <h1 class="detail-title">{{ program.title }}</h1>

          <!-- Developer and publisher share one master list; the publisher only
               gets its own pill when it names a different entry. Either filters
               the library when clicked. -->
          <div v-if="developerName || publisherName" class="detail-circles">
            <button
              v-if="developerName"
              type="button"
              class="detail-developer detail-developer-btn"
              :title="`${t('detailView.developerLabel')} · ${t('detailView.filterByThis')}`"
              @click="handleFilterByCircle(program.developerId)"
            >
              <NIcon :component="DeveloperIcon" :size="15" class="developer-icon" />
              <span>{{ developerName }}</span>
            </button>
            <button
              v-if="publisherName"
              type="button"
              class="detail-developer detail-developer-btn"
              :title="`${t('detailView.publisherLabel')} · ${t('detailView.filterByThis')}`"
              @click="handleFilterByCircle(program.publisherId)"
            >
              <NIcon :component="PublisherIcon" :size="15" class="developer-icon" />
              <span>{{ publisherName }}</span>
            </button>
          </div>

          <div class="detail-actions">
            <NButton type="primary" size="large" @click="handleLaunch">
              <template #icon><NIcon :component="PlayIcon" /></template>
              {{ t('detailView.launch') }}
            </NButton>
            <NButton size="large" @click="handleEdit">
              <template #icon><NIcon :component="EditIcon" /></template>
              {{ t('detailView.edit') }}
            </NButton>
            <NButton v-if="program.marketUrl" size="large" @click="handleOpenMarket">
              <template #icon><NIcon :component="MarketIcon" /></template>
              {{ t('detailView.openMarket') }}
            </NButton>
          </div>

          <!-- Tags identify the program, so they sit with it rather than in a
               labelled section further down the page. -->
          <div v-if="localizedTags.length > 0" class="detail-tags">
            <NTag
              v-for="tag in localizedTags"
              :key="tag"
              :bordered="false"
              class="detail-tag-clickable"
              :title="t('detailView.filterByThis')"
              @click="handleFilterByTag(tag)"
            >{{ resolveTagName(tag) }}</NTag>
          </div>
        </header>

        <!-- Liner notes. The only words on this page the user wrote themselves,
             so they lead. Display only — never part of search/filtering.
             Rendered as markdown; links open in the system browser. -->
        <section v-if="program.memo" class="detail-section">
          <div class="section-label">{{ t('detailView.memoLabel') }}</div>
          <MarkdownText class="detail-memo" :source="program.memo" @link="openExternalLink" />
        </section>

        <section class="detail-section">
          <div class="section-label">{{ t('detailView.previews') }}</div>
          <NImageGroup v-if="previewUrls.length > 0">
            <div class="preview-strip">
              <div v-for="(url, i) in previewUrls" :key="i" class="preview-frame">
                <NImage :src="url" object-fit="cover" width="100%" height="100%" />
              </div>
            </div>
          </NImageGroup>
          <div v-else class="preview-empty">
            <NIcon :component="ImageIcon" :size="40" />
            <span>{{ t('detailView.noPreviews') }}</span>
          </div>
        </section>

        <!-- Recommendations based on shared developer / tags. -->
        <section v-if="recommendations.length > 0" class="detail-section">
          <div class="section-label">{{ t('detailView.recommended') }}</div>
          <div class="rec-strip">
            <button
              v-for="rec in recommendations"
              :key="rec.id"
              type="button"
              class="rec-card"
              @click="handleOpenRecommendation(rec.id)"
            >
              <div class="rec-thumb">
                <JacketArt :title="rec.title" :src="recImage(rec)" />
              </div>
              <div class="rec-title">{{ rec.title }}</div>
            </button>
          </div>
        </section>

        <!-- Where the file lives: needed occasionally, so it closes the page
             instead of taking a labelled block in the middle of it. -->
        <footer class="detail-path-row">
          <div class="detail-path" :title="program.executablePath">
            <NIcon :component="FolderIcon" :size="14" class="path-icon" />
            <span class="path-text truncate">{{ program.executablePath }}</span>
          </div>
          <NButton
            v-if="canReveal"
            quaternary
            size="small"
            :title="t('cardMenu.revealInExplorer')"
            @click="handleReveal"
          >
            <template #icon><NIcon :component="FolderIcon" /></template>
          </NButton>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-view {
  height: 100%;
  overflow-y: auto;
  margin: -16px;
}

.detail-topbar {
  display: flex;
  justify-content: space-between;
  padding: 14px 26px 0;
}

.detail-main {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
  padding: 14px 32px 40px;
}

.hero-jacket {
  position: sticky;
  top: 0;
  aspect-ratio: 2 / 3;
  border-radius: var(--r-sm);
  overflow: hidden;
  box-shadow: var(--shadow-2);
}

.detail-record {
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-width: 0;
}

.record-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}

/* One column below the app's minimum window width: the jacket keeps its
   presence but stops squeezing the record. */
@media (max-width: 900px) {
  .detail-main {
    grid-template-columns: minmax(0, 1fr);
    gap: 22px;
  }

  .hero-jacket {
    position: static;
    width: 168px;
  }
}

.detail-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 2.15rem;
  font-weight: 700;
  line-height: 1.25;
  /* The serif already has its own fit; the sans needed tightening, this does
     not. */
  letter-spacing: -0.005em;
  word-break: break-word;
}

.detail-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 2px;
}

/* Section label token: no uppercase, no tracking — see global.css. */
.section-label {
  font-size: var(--label-size);
  font-weight: var(--label-weight);
  color: var(--plum-soft);
  margin-bottom: 12px;
}

.detail-memo {
  /* A readable measure. Memo text ran the full window width before, which at
     1360px is well past what anyone tracks comfortably. */
  max-width: 760px;
  word-break: break-word;
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--text);
  background-color: var(--surface);
  border-radius: var(--r-md);
  padding: 14px 16px;
}

.preview-strip {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  padding-bottom: 8px;
  scroll-snap-type: x mandatory;
}

.preview-frame {
  flex: 0 0 auto;
  width: 420px;
  aspect-ratio: 16 / 9;
  border-radius: var(--r-lg);
  overflow: hidden;
  background-color: var(--surface-2);
  scroll-snap-align: start;
  box-shadow: var(--shadow-1);
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 160px;
  border: 2px dashed var(--border);
  border-radius: var(--r-lg);
  color: var(--text-3);
  font-size: 0.85rem;
}

.detail-developer {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  color: var(--text-2);
}

/* Developer name acts as a filter trigger — render as an inline, button-reset
   pill that hints at interactivity on hover. */
.detail-developer-btn {
  border: none;
  background: none;
  padding: 4px 8px;
  margin-left: -8px;
  border-radius: var(--r-md);
  cursor: pointer;
  font: inherit;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.detail-developer-btn:hover {
  background-color: var(--plum-wash);
  color: var(--plum-soft);
}

.developer-icon {
  flex-shrink: 0;
  opacity: 0.8;
}

.detail-circles {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-left: -8px;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.detail-tag-clickable {
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.detail-tag-clickable:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 0 1px var(--plum-ring);
}

/* Recommendations — horizontal strip of compact jackets. */
.rec-strip {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.rec-card {
  flex: 0 0 auto;
  width: 132px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
}

.rec-card:focus-visible {
  outline: 2px solid var(--plum);
  outline-offset: 3px;
  border-radius: var(--r-sm);
}

.rec-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: var(--r-sm);
  overflow: hidden;
  box-shadow: var(--shadow-1);
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.rec-card:hover .rec-thumb {
  transform: translateY(-4px);
  box-shadow: var(--shadow-2);
}

.rec-title {
  font-size: 0.82rem;
  line-height: 1.3;
  color: var(--text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Path footer — a quiet closing line, not a titled block. */
.detail-path-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.detail-path {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--text-3);
}

.path-icon {
  flex-shrink: 0;
  opacity: 0.8;
}

.path-text {
  min-width: 0;
}

@media (prefers-reduced-motion: reduce) {
  .rec-thumb,
  .detail-tag-clickable {
    transition: none;
  }
}
</style>
