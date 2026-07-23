<script setup lang="ts">
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NIcon, NTag, NDropdown, NPopover, useMessage, useDialog } from 'naive-ui'
import type { DropdownMixedOption } from 'naive-ui/es/dropdown/src/interface'
import {
  Play as PlayIcon,
  FolderOpenOutline as FolderIcon,
  InformationCircleOutline as InfoIcon,
  CreateOutline as EditIcon,
  TrashOutline as TrashIcon,
  LogoSteam as SteamIcon,
  DesktopOutline as LocalIcon,
  PeopleOutline as DeveloperIcon
} from '@vicons/ionicons5'
import type { Program, ProviderId } from '../../types'
import { DEFAULT_PROVIDER, PROVIDERS, libImageUrl } from '../../types'
import { useLibraryStore } from '../../stores/libraryStore'
import { useDeveloperName } from '../../composables/useDeveloperName'
import { useTagName } from '../../composables/useTagName'
import { useThemeClass } from '../../composables/useThemeClass'
import JacketArt from './JacketArt.vue'

const props = defineProps<{
  program: Program
}>()

const { t, locale } = useI18n()
const router = useRouter()
const libraryStore = useLibraryStore()
const message = useMessage()
const confirmDialog = useDialog()
const { resolveDeveloperName } = useDeveloperName()
const { resolveTagName } = useTagName()
const themeClass = useThemeClass()

const developerName = computed(() => resolveDeveloperName(props.program.developerId))

// Publisher shares the developer master list and — thanks to the form's
// auto-fill — usually equals the developer. It gets its own segment on the
// circle row only when it names a different entry, so the common case renders
// exactly one name and the card height never changes.
const publisherName = computed(() => {
  const p = props.program
  if (!p.publisherId || p.publisherId === p.developerId) return ''
  return resolveDeveloperName(p.publisherId)
})

// Full, labeled names for the hover tooltip — the row itself may truncate both.
const circleTooltip = computed(() => {
  const parts: string[] = []
  if (developerName.value) parts.push(`${t('detailView.developerLabel')}: ${developerName.value}`)
  if (publisherName.value) parts.push(`${t('detailView.publisherLabel')}: ${publisherName.value}`)
  return parts.join(' · ')
})

// Tags render on a single line. We measure how many actually fit and collapse
// the remainder into a "+n" badge, so a program with many/long tags never grows
// the card taller than its neighbours in the grid.
const metaRef = ref<HTMLElement | null>(null)

// Tag ids on this program; the measurement/display resolves each to its
// localized name. Recomputes when the tag list or UI language changes.
const localizedTags = computed(() => props.program.tags)

const visibleTagCount = ref(localizedTags.value.length)

const visibleTags = computed(() => localizedTags.value.slice(0, visibleTagCount.value))
const hiddenTagCount = computed(() => localizedTags.value.length - visibleTagCount.value)

// Approx. footprint reserved for the "+n" badge (badge width + preceding gap)
// so the last visible tag never sits where the badge needs to go.
const OVERFLOW_RESERVE = 40

const computeVisibleTags = () => {
  const el = metaRef.value
  if (!el) return
  const total = localizedTags.value.length
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
  const total = localizedTags.value.length
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

// Re-measure when the tag set changes, and when the UI language switches (tag
// labels — and thus their widths — differ per language).
watch([localizedTags, locale], () => nextTick(measureTags))

const displayImage = computed(() => {
  const v = props.program.updatedAt
  if (props.program.thumbnailPath) return libImageUrl(props.program.thumbnailPath, v)
  if (props.program.iconPath) return libImageUrl(props.program.iconPath, v)
  return ''
})

// With no cover art JacketArt sets the title itself, so repeating it in the
// caption would print the same words twice on one card.
const hasArt = computed(() => !!displayImage.value)

// How far the caption sits below the card edge while idle: exactly the height
// of the rows that only appear on hover, so nothing shifts for a program that
// has neither a circle nor tags.
const revealHeight = computed(() => {
  let h = 0
  if (developerName.value || publisherName.value) h += 20
  if (props.program.tags.length > 0) h += 27
  return h
})

// Keyboard: Enter/Space on the card itself mirrors a click (open detail).
// Guarded to the card root so inner buttons keep their own key behaviour.
const handleCardKeydown = (e: KeyboardEvent) => {
  if (e.target !== e.currentTarget) return
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    handleCardClick()
  }
}

const isHighlighted = computed(() => libraryStore.highlightedProgramId === props.program.id)

// Provider badge over the top-left of the cover art. A local file is the
// default, so it carries no mark — badging every jacket with the norm would
// repeat the same glyph across the whole wall and say nothing.
const PROVIDER_ICONS: Record<ProviderId, Component> = {
  local: LocalIcon,
  steam: SteamIcon
}
const showProviderBadge = computed(() => props.program.category !== DEFAULT_PROVIDER)
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

// The install folder disambiguates two entries of the same game, but it is
// filesystem trivia rather than something to spend a line of the jacket on —
// it rides along in the title's native tooltip instead.
const titleTooltip = computed(() => {
  const exe = props.program.executablePath
  return folderName.value ? `${props.program.title}\n${exe}` : props.program.title
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
  <article
    class="jacket no-select"
    :class="{ 'is-highlighted': isHighlighted }"
    :style="{ '--reveal-h': `${revealHeight}px`, '--veil-base': hasArt ? '46%' : '0px' }"
    :data-program-id="program.id"
    role="button"
    tabindex="0"
    :aria-label="program.title"
    @click="handleCardClick"
    @keydown="handleCardKeydown"
    @contextmenu="handleContextMenu"
  >
    <JacketArt :title="program.title" :src="displayImage" />

    <!-- Provider badge (top-left, over the cover) -->
    <div
      v-if="showProviderBadge"
      class="badge provider-badge"
      :title="providerLabel"
      :aria-label="providerLabel"
    >
      <NIcon :component="providerIcon" :size="13" />
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
        <div class="badge info-badge" :aria-label="t('detailView.previews')" @click.stop>
          <NIcon :component="InfoIcon" :size="15" />
        </div>
      </template>
      <!-- NPopover teleports this to <body>, outside `.app-container`, so it
           needs its own theme class to pick up the light token overrides. -->
      <div class="preview-popover-inner" :class="themeClass">
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

    <!-- Veil + caption sit on the jacket rather than under it, so the grid is a
         wall of covers instead of a grid of cards. -->
    <div class="jacket-veil" />
    <div class="jacket-caption">
      <div v-if="hasArt" class="card-title" :title="titleTooltip">{{ program.title }}</div>
      <div class="card-reveal">
        <div
          v-if="developerName || publisherName"
          class="card-circle truncate"
          :title="circleTooltip"
        >
          <NIcon :component="DeveloperIcon" :size="13" class="card-circle-icon" />
          <span class="truncate">{{ developerName }}</span>
          <span v-if="publisherName" class="card-circle-sep">·</span>
          <span v-if="publisherName" class="truncate">{{ publisherName }}</span>
        </div>
        <div v-if="program.tags.length > 0" ref="metaRef" class="card-meta">
          <NTag v-for="tag in visibleTags" :key="tag" size="small" class="card-tag">
            {{ resolveTagName(tag) }}
          </NTag>
          <NTag
            v-if="hiddenTagCount > 0"
            size="small"
            :bordered="false"
            class="card-tag card-tag-more"
          >
            +{{ hiddenTagCount }}
          </NTag>
        </div>
      </div>
    </div>

    <button class="launch-btn" :title="t('cardMenu.launch')" @click.stop="handleLaunch">
      <NIcon :component="PlayIcon" :size="18" />
    </button>

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
  </article>
</template>

<style scoped>
.jacket {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: var(--r-sm);
  overflow: hidden;
  cursor: pointer;
  /* No surface, no border, no resting shadow: the artwork is the card. */
  transition: transform 0.22s ease, box-shadow 0.22s ease;
}

.jacket:hover,
.jacket:focus-visible {
  transform: translateY(-6px);
  box-shadow: var(--shadow-2);
}

.jacket:focus-visible {
  outline: 2px solid var(--plum);
  outline-offset: 2px;
}

.jacket.is-highlighted {
  box-shadow:
    0 0 0 3px var(--plum),
    0 0 24px var(--plum-ring);
  animation: highlight-pulse 1.4s ease-in-out infinite;
}

@keyframes highlight-pulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.08); }
}

/* Badges float above the cover and stay above the veil so the info icon
   remains hoverable while the caption is expanded. Both are chrome on top of
   artwork, so they are kept as small and as quiet as legibility allows. */
.badge {
  position: absolute;
  top: 7px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--on-art);
  background-color: var(--scrim-chip);
  backdrop-filter: blur(2px);
}

.provider-badge {
  left: 7px;
}

/* The screenshot peek is a hover affordance by definition — showing it on every
   idle jacket would put a second floating mark on all covers for nothing. */
.info-badge {
  right: 7px;
  cursor: help;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.16s ease, background-color 0.15s ease;
}

.jacket:hover .info-badge,
.jacket:focus-within .info-badge {
  opacity: 1;
  pointer-events: auto;
}

.info-badge:hover {
  background-color: var(--scrim-chip-hover);
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
  border-radius: var(--r-lg);
  background-color: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-pop);
}

.preview-popover-img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: var(--r-md);
}

/* Legibility for caption text sitting directly on artwork. Grows on hover to
   cover the rows that slide in. */
.jacket-veil {
  position: absolute;
  inset: auto 0 0 0;
  z-index: 1;
  height: calc(var(--veil-base) + var(--reveal-h));
  pointer-events: none;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.92) 0%,
    rgba(0, 0, 0, 0.72) 38%,
    rgba(0, 0, 0, 0) 100%
  );
  opacity: 0.82;
  transform: translateY(var(--reveal-h));
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.jacket:hover .jacket-veil,
.jacket:focus-visible .jacket-veil {
  opacity: 1;
  transform: translateY(0);
}

.jacket-caption {
  position: absolute;
  inset: auto 0 0 0;
  z-index: 2;
  /* Keeps text clear of the launch button's corner. */
  padding: 0 46px 9px 10px;
  color: var(--on-art);
  transform: translateY(var(--reveal-h));
  transition: transform 0.2s ease;
}

.jacket:hover .jacket-caption,
.jacket:focus-visible .jacket-caption {
  transform: translateY(0);
}

.card-title {
  font-size: 0.86rem;
  font-weight: 600;
  line-height: 1.32;
  letter-spacing: -0.01em;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Always laid out — only translated out of sight — so the tag-overflow
   measurement stays correct while the card is idle. */
.card-reveal {
  height: var(--reveal-h);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.jacket:hover .card-reveal,
.jacket:focus-visible .card-reveal {
  opacity: 1;
}

/* Circle row: developer, plus the publisher only when it names a different
   entry (the forms auto-fill one from the other, so they usually match). */
.card-circle {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  font-size: 0.72rem;
  color: var(--plum-soft);
}

.card-circle-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.card-circle-sep {
  flex-shrink: 0;
  opacity: 0.6;
}

.card-meta {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  height: 27px;
  padding-top: 5px;
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

.launch-btn {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 3;
  width: 34px;
  height: 34px;
  padding-left: 2px; /* optical-center the play triangle */
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background-color: var(--plum);
  color: var(--on-plum);
  cursor: pointer;
  opacity: 0;
  transform: scale(0.85);
  transition: opacity 0.16s ease, transform 0.16s ease, background-color 0.15s ease;
}

.jacket:hover .launch-btn,
.jacket:focus-visible .launch-btn,
.launch-btn:focus-visible {
  opacity: 1;
  transform: scale(1);
}

.launch-btn:hover {
  background-color: var(--plum-hover);
}

.launch-btn:active {
  background-color: var(--plum-press);
  transform: scale(0.95);
}

.launch-btn:focus-visible {
  outline: 2px solid var(--on-plum);
  outline-offset: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .jacket,
  .jacket-veil,
  .jacket-caption,
  .card-reveal,
  .info-badge,
  .launch-btn {
    transition: none;
  }

  .jacket.is-highlighted {
    animation: none;
  }
}
</style>
