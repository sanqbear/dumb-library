<script setup lang="ts">
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NCard, NIcon, NTag, NDropdown, NPopover, useMessage, useDialog } from 'naive-ui'
import type { DropdownMixedOption } from 'naive-ui/es/dropdown/src/interface'
import {
  Play as PlayIcon,
  Image as ImageIcon,
  FolderOpenOutline as FolderIcon,
  InformationCircleOutline as InfoIcon,
  CreateOutline as EditIcon,
  TrashOutline as TrashIcon,
  LogoSteam as SteamIcon,
  DesktopOutline as LocalIcon,
  PeopleOutline as DeveloperIcon
} from '@vicons/ionicons5'
import type { Program, ProviderId } from '../../types'
import { PROVIDERS, libImageUrl } from '../../types'
import { useLibraryStore } from '../../stores/libraryStore'
import { useDeveloperName } from '../../composables/useDeveloperName'

const props = defineProps<{
  program: Program
}>()

const { t } = useI18n()
const router = useRouter()
const libraryStore = useLibraryStore()
const message = useMessage()
const confirmDialog = useDialog()
const { resolveDeveloperName } = useDeveloperName()

const developerName = computed(() => resolveDeveloperName(props.program.developerId))

const isHovered = ref(false)

// Tags render on a single line. We measure how many actually fit and collapse
// the remainder into a "+n" badge, so a program with many/long tags never grows
// the card taller than its neighbours in the grid.
const metaRef = ref<HTMLElement | null>(null)
const visibleTagCount = ref(props.program.tags.length)

const visibleTags = computed(() => props.program.tags.slice(0, visibleTagCount.value))
const hiddenTagCount = computed(() => props.program.tags.length - visibleTagCount.value)

// Approx. footprint reserved for the "+n" badge (badge width + preceding gap)
// so the last visible tag never sits where the badge needs to go.
const OVERFLOW_RESERVE = 40

const computeVisibleTags = () => {
  const el = metaRef.value
  if (!el) return
  const total = props.program.tags.length
  if (total === 0) return
  const tagEls = Array.from(el.querySelectorAll<HTMLElement>('.card-tag'))
  if (tagEls.length < total) return // not all tags in the DOM yet
  const containerRight = el.getBoundingClientRect().right
  let count = total
  for (let i = 0; i < total; i++) {
    const tagEl = tagEls[i]
    if (!tagEl) break
    const right = tagEl.getBoundingClientRect().right
    const isLast = i === total - 1
    const limit = isLast ? containerRight : containerRight - OVERFLOW_RESERVE
    if (right > limit + 0.5) {
      count = i
      break
    }
  }
  visibleTagCount.value = count
}

// Two-phase: render every tag first so their natural widths are measurable,
// then trim to what fits. Re-runs on resize and whenever the tag list changes.
const measureTags = () => {
  const total = props.program.tags.length
  if (visibleTagCount.value !== total) {
    visibleTagCount.value = total
    nextTick(computeVisibleTags)
  } else {
    computeVisibleTags()
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (metaRef.value) {
    resizeObserver = new ResizeObserver(measureTags)
    resizeObserver.observe(metaRef.value)
  }
  nextTick(measureTags)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(() => props.program.tags, () => nextTick(measureTags), { deep: true })

const displayImage = computed(() => {
  const v = props.program.updatedAt
  if (props.program.thumbnailPath) return libImageUrl(props.program.thumbnailPath, v)
  if (props.program.iconPath) return libImageUrl(props.program.iconPath, v)
  return ''
})

const hasImage = computed(() => !!displayImage.value)

const isHighlighted = computed(() => libraryStore.highlightedProgramId === props.program.id)

// Provider badge shown over the top-left of the cover art.
const PROVIDER_ICONS: Record<ProviderId, Component> = {
  local: LocalIcon,
  steam: SteamIcon
}
const providerIcon = computed(() => PROVIDER_ICONS[props.program.category])
const providerLabel = computed(() => t(PROVIDERS[props.program.category].labelKey))

// Landscape preview images shown in the info-icon hover popover.
const previewUrls = computed(() =>
  props.program.previewImages.map(rel => libImageUrl(rel, props.program.updatedAt))
)
const hasPreviews = computed(() => previewUrls.value.length > 0)

// Last folder segment of the executable's location (e.g. "C:\Games\MyGame\game.exe" → "MyGame").
// Protocol-based programs (e.g. steam://run/<appId>) have no meaningful folder, so we skip them.
const isProtocolUrl = (value: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
const folderName = computed(() => {
  const exe = props.program.executablePath
  if (!exe || isProtocolUrl(exe)) return ''
  const parts = exe.replace(/\\/g, '/').replace(/\/+$/, '').split('/')
  parts.pop() // drop the filename
  return parts.length ? parts[parts.length - 1] : ''
})

const handleLaunch = async () => {
  try {
    await libraryStore.launchProgram(props.program)
    message.success(t('card.launchSuccess', { title: props.program.title }))
  } catch (error) {
    message.error(t('card.launchFailed'))
  }
}

const handleCardClick = () => {
  router.push({ name: 'detail', params: { id: props.program.id } })
}

const handleEdit = () => {
  router.push({ name: 'edit', params: { id: props.program.id } })
}

// Right-click context menu. Protocol-based programs (Steam) have no filesystem
// location, so "show in explorer" is omitted for them.
const canReveal = computed(() => {
  const exe = props.program.executablePath
  return !!exe && !isProtocolUrl(exe)
})

const renderMenuIcon = (icon: Component) => () => h(NIcon, null, { default: () => h(icon) })

const menuOptions = computed(() => {
  const options: DropdownMixedOption[] = [
    { label: t('cardMenu.launch'), key: 'launch', icon: renderMenuIcon(PlayIcon) },
    { label: t('cardMenu.viewDetail'), key: 'detail', icon: renderMenuIcon(InfoIcon) },
    { label: t('cardMenu.edit'), key: 'edit', icon: renderMenuIcon(EditIcon) }
  ]
  if (canReveal.value) {
    options.push({ label: t('cardMenu.revealInExplorer'), key: 'reveal', icon: renderMenuIcon(FolderIcon) })
  }
  options.push({ type: 'divider', key: 'divider' })
  options.push({ label: t('cardMenu.delete'), key: 'delete', icon: renderMenuIcon(TrashIcon) })
  return options
})

const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const handleContextMenu = (e: MouseEvent) => {
  e.preventDefault()
  // Force a teardown/rebuild so the dropdown repositions to the new cursor
  // point even when it's already open over another card (Naive UI guidance).
  showMenu.value = false
  nextTick(() => {
    menuX.value = e.clientX
    menuY.value = e.clientY
    showMenu.value = true
  })
}

const closeMenu = () => {
  showMenu.value = false
}

const handleMenuSelect = (key: string) => {
  showMenu.value = false
  if (key === 'launch') handleLaunch()
  else if (key === 'detail') handleCardClick()
  else if (key === 'edit') handleEdit()
  else if (key === 'reveal') handleReveal()
  else if (key === 'delete') handleDelete()
}

const handleReveal = async () => {
  await libraryStore.revealProgram(props.program)
}

const handleDelete = () => {
  const program = props.program
  confirmDialog.warning({
    title: t('editDialog.deleteConfirmTitle'),
    content: t('editDialog.deleteConfirmMessage', { title: program.title }),
    positiveText: t('common.delete'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const success = await libraryStore.deleteProgram(program.id)
      if (success) message.success(t('editDialog.deleted'))
      else message.error(t('editDialog.deleteFailed'))
    }
  })
}
</script>

<template>
  <NCard
    class="program-card card-hover no-select"
    :class="{ 'is-highlighted': isHighlighted }"
    :data-program-id="program.id"
    :bordered="false"
    content-style="padding: 0"
    @click="handleCardClick"
    @contextmenu="handleContextMenu"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Image area -->
    <div class="card-image">
      <!-- Native lazy <img>: the browser only fetches the cover when the card
           scrolls near the viewport, and it's far lighter than a per-card
           NImage component instance when the grid holds many programs. -->
      <img
        v-if="hasImage"
        :src="displayImage"
        class="card-img"
        loading="lazy"
        decoding="async"
        alt=""
      />
      <div v-else class="placeholder-image">
        <NIcon :component="ImageIcon" :size="48" />
      </div>

      <!-- Provider badge (top-left, over the cover) -->
      <div class="provider-badge" :title="providerLabel" :aria-label="providerLabel">
        <NIcon :component="providerIcon" :size="16" />
      </div>

      <!-- Info badge (top-right): hover reveals the preview images -->
      <NPopover
        v-if="hasPreviews"
        trigger="hover"
        placement="bottom-end"
        :show-arrow="false"
        raw
        class="preview-popover"
      >
        <template #trigger>
          <div
            class="info-badge"
            :aria-label="t('detailView.previews')"
            @click.stop
          >
            <NIcon :component="InfoIcon" :size="18" />
          </div>
        </template>
        <div class="preview-popover-inner">
          <img
            v-for="(url, i) in previewUrls"
            :key="i"
            :src="url"
            class="preview-popover-img"
            loading="lazy"
            decoding="async"
            alt=""
          />
        </div>
      </NPopover>

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
      <div v-if="developerName" class="card-developer truncate" :title="developerName">
        <NIcon :component="DeveloperIcon" :size="13" class="card-developer-icon" />
        <span class="truncate">{{ developerName }}</span>
      </div>
      <div v-if="folderName" class="card-folder truncate" :title="program.executablePath">
        <NIcon :component="FolderIcon" :size="13" class="card-folder-icon" />
        <span class="truncate">{{ folderName }}</span>
      </div>
      <div ref="metaRef" class="card-meta">
        <NTag
          v-for="tag in visibleTags"
          :key="tag"
          size="small"
          class="card-tag"
        >
          {{ tag }}
        </NTag>
        <NTag
          v-if="hiddenTagCount > 0"
          size="small"
          :bordered="false"
          class="card-tag card-tag-more"
        >
          +{{ hiddenTagCount }}
        </NTag>
        <span v-if="program.tags.length === 0" class="card-meta-empty">—</span>
      </div>
    </div>

    <!-- Right-click context menu -->
    <NDropdown
      trigger="manual"
      placement="bottom-start"
      :show="showMenu"
      :x="menuX"
      :y="menuY"
      :options="menuOptions"
      :on-clickoutside="closeMenu"
      @select="handleMenuSelect"
    />
  </NCard>
</template>

<style scoped>
.program-card {
  background-color: #27272a;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  /* Subtle top highlight + layered drop shadow give the card depth without
     touching layout, so the grid never shifts on hover/highlight. */
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.35),
    0 4px 10px rgba(0, 0, 0, 0.28);
  transition: transform 0.22s ease, box-shadow 0.22s ease;
}

.program-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 6px 14px rgba(0, 0, 0, 0.38),
    0 16px 32px rgba(0, 0, 0, 0.34);
}

.light-theme .program-card {
  background-color: #ffffff;
  border-color: rgba(0, 0, 0, 0.05);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.06),
    0 4px 12px rgba(0, 0, 0, 0.1);
}

.light-theme .program-card:hover {
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.12),
    0 18px 36px rgba(0, 0, 0, 0.16);
}

.program-card.is-highlighted {
  box-shadow:
    0 0 0 3px #ab4aba,
    0 0 24px rgba(171, 74, 186, 0.55);
  animation: highlight-pulse 1.4s ease-in-out infinite;
}

.light-theme .program-card.is-highlighted {
  box-shadow:
    0 0 0 3px #ab4aba,
    0 0 24px rgba(171, 74, 186, 0.45);
}

@keyframes highlight-pulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.08); }
}

.card-image {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  background-color: #3f3f46;
  overflow: hidden;
}

.light-theme .card-image {
  background-color: #e4e4e7;
}

.card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.placeholder-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #71717a;
}

/* Provider / info badges float above the cover and stay above the hover
   overlay so the info icon remains hoverable while the launch button shows. */
.provider-badge,
.info-badge {
  position: absolute;
  top: 8px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  color: #fff;
  background-color: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}

.provider-badge {
  left: 8px;
}

.info-badge {
  right: 8px;
  cursor: help;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.info-badge:hover {
  background-color: rgba(0, 0, 0, 0.78);
  transform: scale(1.08);
}

/* Floating preview gallery rendered by the info-badge popover.
   A fixed width (not max-width) is intentional: with a definite width the
   images' `aspect-ratio` resolves a definite height at first layout — before
   the lazy images load — so naive-ui measures the popover's true size on the
   first hover and can flip it above the badge when there's no room below.
   Without it the box starts near-zero-height, opens downward, and only
   repositions on a second hover once the images are cached. */
.preview-popover-inner {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  width: 280px;
  border-radius: 10px;
  background-color: #1f1f23;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.light-theme .preview-popover-inner {
  background-color: #ffffff;
  border-color: rgba(0, 0, 0, 0.08);
}

.preview-popover-img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 6px;
}

.card-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
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
  background-color: #ab4aba;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  padding-left: 4px; /* optical-center the play triangle */
}

.light-theme .launch-btn {
  background-color: #ab4aba;
}

.launch-btn:hover {
  transform: scale(1.06);
  background-color: #b658c4;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}

.light-theme .launch-btn:hover {
  background-color: #a144af;
}

.launch-btn:active {
  transform: scale(0.98);
  background-color: #8e3a9c;
}

.light-theme .launch-btn:active {
  background-color: #953ea3;
}

.card-info {
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.light-theme .card-info {
  border-top-color: rgba(0, 0, 0, 0.04);
}

.card-title {
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.card-developer {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.74rem;
  color: #d6a9dd;
  margin-bottom: 4px;
}

.light-theme .card-developer {
  color: #953ea3;
}

.card-developer-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.card-folder {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  color: #a1a1aa;
  margin-bottom: 8px;
}

.light-theme .card-folder {
  color: #71717a;
}

.card-folder-icon {
  flex-shrink: 0;
  opacity: 0.8;
}

.card-meta {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  min-height: 22px;
  align-items: center;
  overflow: hidden;
}

/* Tags stay on one line: never shrink, never wrap their own text. */
.card-tag {
  flex: 0 0 auto;
  white-space: nowrap;
}

.card-tag-more {
  flex-shrink: 0;
}

.card-meta-empty {
  font-size: 0.8rem;
  color: #52525b;
}
</style>
