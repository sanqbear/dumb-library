<script setup lang="ts">
import { computed, h, nextTick, ref, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NCard, NImage, NIcon, NTag, NDropdown, useMessage, useDialog } from 'naive-ui'
import type { DropdownMixedOption } from 'naive-ui/es/dropdown/src/interface'
import {
  Play as PlayIcon,
  Image as ImageIcon,
  FolderOpenOutline as FolderIcon,
  InformationCircleOutline as InfoIcon,
  CreateOutline as EditIcon,
  TrashOutline as TrashIcon
} from '@vicons/ionicons5'
import type { Program } from '../../types'
import { PROVIDERS, libImageUrl } from '../../types'
import { useLibraryStore } from '../../stores/libraryStore'

const props = defineProps<{
  program: Program
}>()

const { t } = useI18n()
const router = useRouter()
const libraryStore = useLibraryStore()
const message = useMessage()
const confirmDialog = useDialog()

const isHovered = ref(false)

const displayImage = computed(() => {
  const v = props.program.updatedAt
  if (props.program.thumbnailPath) return libImageUrl(props.program.thumbnailPath, v)
  if (props.program.iconPath) return libImageUrl(props.program.iconPath, v)
  return ''
})

const hasImage = computed(() => !!displayImage.value)

const isHighlighted = computed(() => libraryStore.highlightedProgramId === props.program.id)

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
      <NImage
        v-if="hasImage"
        :src="displayImage"
        object-fit="cover"
        width="100%"
        height="100%"
        preview-disabled
        :fallback-src="undefined"
      />
      <div v-else class="placeholder-image">
        <NIcon :component="ImageIcon" :size="48" />
      </div>

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
      <div v-if="folderName" class="card-folder truncate" :title="program.executablePath">
        <NIcon :component="FolderIcon" :size="13" class="card-folder-icon" />
        <span class="truncate">{{ folderName }}</span>
      </div>
      <div class="card-meta">
        <NTag size="small" type="info">
          {{ t(PROVIDERS[program.category].labelKey) }}
        </NTag>
        <NTag
          v-for="tag in program.tags.slice(0, 2)"
          :key="tag"
          size="small"
        >
          {{ tag }}
        </NTag>
        <NTag v-if="program.tags.length > 2" size="small" :bordered="false">
          +{{ program.tags.length - 2 }}
        </NTag>
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
    0 0 0 3px #e87ea1,
    0 0 24px rgba(232, 126, 161, 0.55);
  animation: highlight-pulse 1.4s ease-in-out infinite;
}

.light-theme .program-card.is-highlighted {
  box-shadow:
    0 0 0 3px #db2777,
    0 0 24px rgba(219, 39, 119, 0.45);
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

.placeholder-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #71717a;
}

.card-overlay {
  position: absolute;
  inset: 0;
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
  background-color: #e87ea1;
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
  background-color: #db2777;
}

.launch-btn:hover {
  transform: scale(1.06);
  background-color: #f093b0;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}

.light-theme .launch-btn:hover {
  background-color: #ec4899;
}

.launch-btn:active {
  transform: scale(0.98);
  background-color: #c96081;
}

.light-theme .launch-btn:active {
  background-color: #be185d;
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
  flex-wrap: wrap;
  gap: 4px;
}
</style>
