<script setup lang="ts">
import { computed, h, nextTick, watch, type Component } from 'vue'
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
  ImageOutline as ImageIcon
} from '@vicons/ionicons5'
import { useLibraryStore } from '../stores/libraryStore'
import { useThemeClass } from '../composables/useThemeClass'
import { PROVIDERS, libImageUrl } from '../types'

const props = defineProps<{ id: string }>()

const { t } = useI18n()
const router = useRouter()
const libraryStore = useLibraryStore()
const message = useMessage()
const confirmDialog = useDialog()
const themeClass = useThemeClass()

const program = computed(() => libraryStore.programs.find(p => p.id === props.id) ?? null)

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

const previewUrls = computed(() =>
  program.value ? program.value.previewImages.map(rel => libImageUrl(rel, program.value!.updatedAt)) : []
)

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
  <div v-if="program" class="detail-view" :class="themeClass">
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

      <!-- Path + tags (kept as-is per requirements) -->
      <section class="detail-section">
        <div class="section-label">{{ t('detailView.pathLabel') }}</div>
        <div class="detail-path" :title="program.executablePath">
          <NIcon :component="FolderIcon" :size="15" class="path-icon" />
          <span class="path-text">{{ program.executablePath }}</span>
        </div>
      </section>

      <section class="detail-section">
        <div class="section-label">{{ t('detailView.tagsLabel') }}</div>
        <div class="detail-tags">
          <NTag type="info" :bordered="false">{{ t(PROVIDERS[program.category].labelKey) }}</NTag>
          <NTag v-for="tag in program.tags" :key="tag" :bordered="false">{{ tag }}</NTag>
          <span v-if="program.tags.length === 0" class="tags-empty">—</span>
        </div>
      </section>

      <!-- Reference memo — display only, never part of search/filtering. -->
      <section v-if="program.memo" class="detail-section">
        <div class="section-label">{{ t('detailView.memoLabel') }}</div>
        <p class="detail-memo">{{ program.memo }}</p>
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

.detail-path {
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
  margin: 0;
  white-space: pre-wrap;
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
</style>
