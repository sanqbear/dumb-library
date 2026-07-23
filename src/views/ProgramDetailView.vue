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
import { useThemeClass } from '../composables/useThemeClass'
import { useDeveloperName } from '../composables/useDeveloperName'
import MarkdownText from '../components/MarkdownText.vue'
import { useTagName } from '../composables/useTagName'
import { libImageUrl, type Program } from '../types'

const props = defineProps<{ id: string }>()

const { t } = useI18n()
const router = useRouter()
const libraryStore = useLibraryStore()
const message = useMessage()
const confirmDialog = useDialog()
const themeClass = useThemeClass()
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

// Background art behind the title: first preview, else the thumbnail.
const backdropUrl = computed(() => {
  const p = program.value
  if (!p) return ''
  if (p.previewImages.length > 0) return libImageUrl(p.previewImages[0], p.updatedAt)
  if (p.thumbnailPath) return libImageUrl(p.thumbnailPath, p.updatedAt)
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
  <div v-if="program" ref="detailViewRef" class="detail-view" :class="themeClass">
    <!-- Header with blurred backdrop art -->
    <header class="detail-header">
      <div
        v-if="backdropUrl"
        class="detail-backdrop"
        :style="{ backgroundImage: `url('${backdropUrl}')` }"
      />
      <div class="detail-header-scrim" />
      <div class="detail-header-bar">
        <NButton quaternary circle class="header-btn" @click="handleBack" :aria-label="t('detailView.back')">
          <template #icon><NIcon :component="BackIcon" /></template>
        </NButton>
        <NDropdown trigger="click" :options="menuOptions" @select="handleMenuSelect">
          <NButton quaternary circle class="header-btn">
            <template #icon><NIcon :component="MoreIcon" /></template>
          </NButton>
        </NDropdown>
      </div>
      <div class="detail-header-content">
        <div class="detail-header-main">
          <h1 class="detail-title">{{ program.title }}</h1>
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
        </div>
        <!-- Developer / publisher — no field titles; sit at the header's
             bottom-right (below the "more" button) and filter the library when
             clicked. The publisher pill appears only when it differs from the
             developer. -->
        <div v-if="developerName || publisherName" class="header-circles">
          <button
            v-if="developerName"
            type="button"
            class="detail-developer detail-developer-btn header-developer"
            :title="`${t('detailView.developerLabel')} · ${t('detailView.filterByThis')}`"
            @click="handleFilterByCircle(program.developerId)"
          >
            <NIcon :component="DeveloperIcon" :size="14" class="developer-icon" />
            <span>{{ developerName }}</span>
          </button>
          <button
            v-if="publisherName"
            type="button"
            class="detail-developer detail-developer-btn header-developer"
            :title="`${t('detailView.publisherLabel')} · ${t('detailView.filterByThis')}`"
            @click="handleFilterByCircle(program.publisherId)"
          >
            <NIcon :component="PublisherIcon" :size="14" class="developer-icon" />
            <span>{{ publisherName }}</span>
          </button>
        </div>
      </div>
    </header>

    <div class="detail-body">
      <!-- Horizontal-scroll preview gallery -->
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

      <!-- Reference memo — display only, never part of search/filtering.
           Rendered as markdown; links open in the system browser. -->
      <section v-if="program.memo" class="detail-section">
        <div class="section-label">{{ t('detailView.memoLabel') }}</div>
        <MarkdownText class="detail-memo" :source="program.memo" @link="openExternalLink" />
      </section>

      <!-- Executable path, with a "reveal in explorer" button on the right. -->
      <section class="detail-section">
        <div class="section-label">{{ t('detailView.pathLabel') }}</div>
        <div class="detail-path-row">
          <div class="detail-path" :title="program.executablePath">
            <NIcon :component="FolderIcon" :size="15" class="path-icon" />
            <span class="path-text">{{ program.executablePath }}</span>
          </div>
          <NButton
            v-if="canReveal"
            quaternary
            class="path-reveal-btn"
            :title="t('cardMenu.revealInExplorer')"
            @click="handleReveal"
          >
            <template #icon><NIcon :component="FolderIcon" /></template>
          </NButton>
        </div>
      </section>

      <section class="detail-section">
        <div class="section-label">{{ t('detailView.tagsLabel') }}</div>
        <div class="detail-tags">
          <NTag
            v-for="tag in localizedTags"
            :key="tag"
            :bordered="false"
            class="detail-tag-clickable"
            :title="t('detailView.filterByThis')"
            @click="handleFilterByTag(tag)"
          >{{ resolveTagName(tag) }}</NTag>
          <span v-if="localizedTags.length === 0" class="tags-empty">—</span>
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
              <img
                v-if="recImage(rec)"
                :src="recImage(rec)"
                class="rec-thumb-img"
                loading="lazy"
                decoding="async"
                alt=""
              />
              <div v-else class="rec-thumb-empty">
                <NIcon :component="ImageIcon" :size="28" />
              </div>
            </div>
            <div class="rec-title">{{ rec.title }}</div>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.detail-view {
  height: 100%;
  overflow-y: auto;
  margin: -16px;
}

.detail-header {
  position: relative;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 16px 26px 16px;
  overflow: hidden;
}

.detail-backdrop {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center 30%;
  /* Show only "part of" the image, softly — opacity + blur per the spec. */
  opacity: 0.45;
  filter: blur(2px);
  transform: scale(1.05);
}

.detail-header-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(24, 24, 27, 0.35) 0%, rgba(24, 24, 27, 0.85) 100%);
}

.light-theme .detail-header-scrim {
  background: linear-gradient(to bottom, rgba(244, 244, 245, 0.4) 0%, rgba(244, 244, 245, 0.92) 100%);
}

.detail-header-bar {
  position: relative;
  display: flex;
  justify-content: space-between;
}

.header-btn {
  background-color: rgba(0, 0, 0, 0.35);
  color: #fafafa;
}

.light-theme .header-btn {
  background-color: rgba(255, 255, 255, 0.55);
  color: #18181b;
}

.detail-header-content {
  position: relative;
  margin-top: auto;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.detail-header-main {
  flex: 1;
  min-width: 0;
}

/* Developer/publisher pills stack in the header's bottom-right corner. They
   size to their content and never shrink, so each name stays on one line; the
   title beside them takes the remaining space and wraps instead. */
.header-circles {
  flex: 0 0 auto;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.header-developer {
  margin-left: 0;
  /* Cancel the pill's right padding so the name's right edge lines up with the
     header's, keeping the stack flush against the corner. */
  margin-right: -8px;
  margin-bottom: 4px;
  max-width: 100%;
  color: #e4d3e8;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35);
}

/* Names render in full on a single line — no ellipsis, no wrapping. */
.header-developer span {
  white-space: nowrap;
  text-align: right;
}

.light-theme .header-developer {
  text-shadow: none;
}

.detail-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 10px 0px;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  word-break: break-word;
}

.light-theme .detail-title {
  text-shadow: none;
}

.detail-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.detail-body {
  padding: 24px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.section-label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #a1a1aa;
  margin-bottom: 12px;
}

.light-theme .section-label {
  color: #71717a;
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
  border-radius: 10px;
  overflow: hidden;
  background-color: #27272a;
  scroll-snap-align: start;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
}

.light-theme .preview-frame {
  background-color: #e4e4e7;
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 160px;
  border: 2px dashed #3f3f46;
  border-radius: 10px;
  color: #71717a;
  font-size: 0.85rem;
}

.light-theme .preview-empty {
  border-color: #d4d4d8;
}

.detail-path-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.detail-path {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  color: #d4d4d8;
  background-color: #27272a;
  padding: 10px 14px;
  border-radius: 8px;
  word-break: break-all;
}

.path-reveal-btn {
  flex: 0 0 auto;
  height: auto;
  background-color: #27272a;
  color: #d4d4d8;
}

.light-theme .path-reveal-btn {
  background-color: #ffffff;
  color: #3f3f46;
}

.light-theme .detail-path {
  color: #3f3f46;
  background-color: #ffffff;
}

.path-icon {
  flex-shrink: 0;
  opacity: 0.8;
}

.path-text {
  min-width: 0;
}

.detail-developer {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #d4d4d8;
}

.light-theme .detail-developer {
  color: #3f3f46;
}

/* Developer name acts as a filter trigger — render as an inline, button-reset
   pill that hints at interactivity on hover. */
.detail-developer-btn {
  border: none;
  background: none;
  padding: 4px 8px;
  margin-left: -8px;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.detail-developer-btn:hover {
  background-color: rgba(171, 74, 186, 0.16);
  color: #d6a9dd;
}

.light-theme .detail-developer-btn:hover {
  background-color: rgba(171, 74, 186, 0.1);
  color: #953ea3;
}

.detail-tag-clickable {
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.detail-tag-clickable:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 0 1px rgba(171, 74, 186, 0.55);
}

.light-theme .detail-tag-clickable:hover {
  box-shadow: 0 0 0 1px rgba(171, 74, 186, 0.5);
}

.developer-icon {
  flex-shrink: 0;
  opacity: 0.8;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.tags-empty {
  color: #71717a;
}

.detail-memo {
  word-break: break-word;
  font-size: 0.9rem;
  line-height: 1.6;
  color: #d4d4d8;
  background-color: #27272a;
  border-radius: 8px;
  padding: 12px 14px;
}

.light-theme .detail-memo {
  color: #3f3f46;
  background-color: #ffffff;
}

/* Recommendations — horizontal strip of compact program cards. */
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

.rec-thumb {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 10px;
  overflow: hidden;
  background-color: #27272a;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.light-theme .rec-thumb {
  background-color: #e4e4e7;
}

.rec-card:hover .rec-thumb {
  transform: translateY(-4px);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.34);
}

.rec-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.rec-thumb-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #71717a;
}

.rec-title {
  font-size: 0.82rem;
  line-height: 1.3;
  color: #d4d4d8;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.light-theme .rec-title {
  color: #3f3f46;
}
</style>
