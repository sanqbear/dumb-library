<script setup lang="ts">
import { h, ref, computed, watch } from 'vue'
import {
  NModal,
  NTabs,
  NTabPane,
  NDataTable,
  NButton,
  NSpace,
  NInput,
  NInputNumber,
  NIcon,
  NForm,
  NFormItem,
  NEmpty,
  NSpin,
  NAlert,
  useMessage
} from 'naive-ui'
import { Search as SearchIcon } from '@vicons/ionicons5'
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import { useLibraryStore } from '../../stores/libraryStore'
import { useThemeClass } from '../../composables/useThemeClass'
import type { SteamGame } from '../../types'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const libraryStore = useLibraryStore()
const message = useMessage()
const themeClass = useThemeClass()

const activeTab = ref<'installed' | 'manual'>('installed')
const isScanning = ref(false)
const isSubmitting = ref(false)
const games = ref<SteamGame[]>([])
const checkedAppIds = ref<DataTableRowKey[]>([])
const searchQuery = ref('')

const manualAppId = ref<number | null>(null)
const manualName = ref('')

// Preview modal state (shown when a row title is clicked)
const previewGame = ref<SteamGame | null>(null)
// 0 = library_600x900_2x, 1 = library_600x900, 2 = header.jpg
const previewFallbackIndex = ref(0)
const previewImageLoaded = ref(false)

const previewUrlCandidates = (appId: number): string[] => [
  `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900_2x.jpg`,
  `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`,
  `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`
]

const previewImageUrl = computed(() => {
  if (!previewGame.value) return ''
  const urls = previewUrlCandidates(previewGame.value.appId)
  return urls[previewFallbackIndex.value] ?? ''
})

const openPreview = (game: SteamGame) => {
  previewGame.value = game
  previewFallbackIndex.value = 0
  previewImageLoaded.value = false
}

const closePreview = () => {
  previewGame.value = null
}

const handlePreviewImageError = () => {
  if (!previewGame.value) return
  const candidates = previewUrlCandidates(previewGame.value.appId)
  if (previewFallbackIndex.value < candidates.length - 1) {
    previewFallbackIndex.value += 1
  }
}

const handlePreviewImageLoad = () => {
  previewImageLoaded.value = true
}

const rowKey = (row: SteamGame) => row.appId

// Filter games by case-insensitive substring match on the name.
// Selection state is kept across filter changes — DataTable preserves
// rowKeys that aren't currently in `data` and we merge them back on submit.
const filteredGames = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return games.value
  return games.value.filter(g => g.name.toLowerCase().includes(q))
})

const columns: DataTableColumns<SteamGame> = [
  { type: 'selection' },
  {
    title: 'Name',
    key: 'name',
    ellipsis: { tooltip: true },
    render(row) {
      return h(
        'span',
        {
          class: 'clickable-name',
          title: `미리보기: ${row.name}`,
          onClick: (e: MouseEvent) => {
            e.stopPropagation()
            openPreview(row)
          }
        },
        row.name
      )
    }
  },
  {
    title: 'AppID',
    key: 'appId',
    width: 100
  }
]

const scan = async () => {
  isScanning.value = true
  try {
    games.value = await libraryStore.scanSteamGames()
  } finally {
    isScanning.value = false
  }
}

watch(() => props.show, (v) => {
  if (v) {
    checkedAppIds.value = []
    searchQuery.value = ''
    manualAppId.value = null
    manualName.value = ''
    activeTab.value = 'installed'
    previewGame.value = null
    scan()
  }
})

const checkedCount = computed(() => checkedAppIds.value.length)

const manualValid = computed(() =>
  manualAppId.value !== null && manualAppId.value > 0 && manualName.value.trim() !== ''
)

const reportAddResult = (added: { thumbnailPath: string | null }[], requested: number) => {
  const missingThumb = added.filter(p => !p.thumbnailPath).length
  if (added.length === 0) {
    message.error('추가 실패')
    return
  }
  if (added.length < requested) {
    message.warning(`${added.length}/${requested}개 게임만 추가되었습니다`)
  } else if (missingThumb > 0) {
    message.warning(`${added.length}개 추가됨. ${missingThumb}개는 커버를 못 받았습니다. 편집에서 "Steam 커버 다시 받기"로 재시도할 수 있습니다.`)
  } else {
    message.success(`${added.length}개 게임이 추가되었습니다`)
  }
}

const handleSubmitInstalled = async () => {
  if (checkedAppIds.value.length === 0) return
  const selected = games.value.filter(g => checkedAppIds.value.includes(g.appId))
  const entries = selected.map(g => ({ appId: g.appId, name: g.name }))

  isSubmitting.value = true
  try {
    const added = await libraryStore.addSteamPrograms(entries)
    reportAddResult(added, entries.length)
    emit('update:show', false)
  } finally {
    isSubmitting.value = false
  }
}

const handleSubmitManual = async () => {
  if (!manualValid.value || manualAppId.value === null) return

  isSubmitting.value = true
  try {
    const added = await libraryStore.addSteamPrograms([{
      appId: manualAppId.value,
      name: manualName.value.trim()
    }])
    if (added.length > 0) {
      reportAddResult(added, 1)
      emit('update:show', false)
    } else {
      message.error('추가 실패')
    }
  } finally {
    isSubmitting.value = false
  }
}

const handleCancel = () => {
  emit('update:show', false)
}
</script>

<template>
  <NModal
    :show="show"
    @update:show="emit('update:show', $event)"
    preset="card"
    title="스팀에서 추가"
    :bordered="false"
    size="medium"
    :style="{ width: '600px' }"
    :mask-closable="false"
  >
    <div :class="themeClass">
    <NTabs v-model:value="activeTab" type="line" animated>
      <NTabPane name="installed" tab="설치된 게임">
        <div class="installed-section">
          <NSpin :show="isScanning">
            <div v-if="!isScanning && games.length === 0" class="empty-state">
              <NAlert type="info" :show-icon="true" :bordered="false">
                설치된 Steam 게임을 찾지 못했습니다. Steam이 설치되어 있지 않거나 라이브러리를 읽지 못했을 수 있습니다.
                'AppID로 추가' 탭에서 수동으로 입력할 수 있습니다.
              </NAlert>
              <NSpace justify="center" style="margin-top: 12px;">
                <NButton @click="scan" size="small">다시 스캔</NButton>
              </NSpace>
            </div>
            <div v-else-if="!isScanning" class="games-table">
              <div class="games-toolbar">
                <NInput
                  v-model:value="searchQuery"
                  placeholder="이름으로 검색"
                  clearable
                  size="small"
                >
                  <template #prefix>
                    <NIcon :component="SearchIcon" />
                  </template>
                </NInput>
                <div class="games-count">
                  {{ searchQuery.trim() ? `${filteredGames.length} / ${games.length}` : `${games.length}개` }}
                </div>
              </div>
              <NDataTable
                :columns="columns"
                :data="filteredGames"
                :row-key="rowKey"
                v-model:checked-row-keys="checkedAppIds"
                :max-height="380"
                size="small"
                :bordered="false"
              />
            </div>
            <div v-else style="min-height: 200px;" />
          </NSpin>
        </div>
      </NTabPane>

      <NTabPane name="manual" tab="AppID로 추가">
        <NForm label-placement="top">
          <NFormItem label="AppID" required>
            <NInputNumber
              v-model:value="manualAppId"
              :min="1"
              :show-button="false"
              placeholder="예: 730"
              style="width: 100%;"
            />
          </NFormItem>
          <NFormItem label="이름" required>
            <NInput
              v-model:value="manualName"
              placeholder="게임 이름"
              clearable
            />
          </NFormItem>
          <div class="manual-help">
            <NAlert type="info" :show-icon="false" :bordered="false">
              AppID는 Steam 상점 URL에서 확인할 수 있습니다.<br />
              예: <code>store.steampowered.com/app/<strong>730</strong></code> → AppID는 <code>730</code>
            </NAlert>
          </div>
        </NForm>
      </NTabPane>
    </NTabs>
    </div>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleCancel" :disabled="isSubmitting">
          취소
        </NButton>
        <NButton
          v-if="activeTab === 'installed'"
          type="primary"
          @click="handleSubmitInstalled"
          :disabled="checkedCount === 0 || isSubmitting"
          :loading="isSubmitting"
        >
          {{ checkedCount > 0 ? `${checkedCount}개 추가` : '추가' }}
        </NButton>
        <NButton
          v-else
          type="primary"
          @click="handleSubmitManual"
          :disabled="!manualValid || isSubmitting"
          :loading="isSubmitting"
        >
          추가
        </NButton>
      </NSpace>
    </template>

    <!-- Preview modal — triggered by clicking a game name in the table -->
    <NModal
      :show="previewGame !== null"
      @update:show="(v: boolean) => !v && closePreview()"
      preset="card"
      :title="previewGame?.name ?? ''"
      :bordered="false"
      size="medium"
      :style="{ width: '440px' }"
    >
      <div :class="themeClass">
        <div class="preview-body">
          <div class="preview-image">
            <NSpin v-if="!previewImageLoaded" size="small" />
            <img
              v-if="previewGame"
              :key="previewImageUrl"
              :src="previewImageUrl"
              :alt="previewGame.name"
              @load="handlePreviewImageLoad"
              @error="handlePreviewImageError"
              :style="{ opacity: previewImageLoaded ? 1 : 0 }"
            />
          </div>
          <div class="preview-meta" v-if="previewGame">
            <span>AppID</span>
            <code>{{ previewGame.appId }}</code>
          </div>
        </div>
      </div>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="closePreview">닫기</NButton>
        </NSpace>
      </template>
    </NModal>
  </NModal>
</template>

<style scoped>
.installed-section {
  min-height: 200px;
}

.empty-state {
  padding: 16px 0;
}

.games-table {
  margin-top: 4px;
}

.games-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.games-toolbar :deep(.n-input) {
  flex: 1;
}

.games-count {
  font-size: 0.8rem;
  color: #a1a1aa;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.light-theme .games-count {
  color: #52525b;
}

/* h()-rendered spans do not receive the scoped data-v attribute, so we
   expose these rules globally. Class name is specific to this dialog so
   collision risk is minimal. */
:global(.clickable-name) {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  border-bottom: 1px dotted transparent;
  transition: color 0.12s ease, border-bottom-color 0.12s ease;
}

:global(.clickable-name:hover) {
  color: #f093b0;
  border-bottom-color: currentColor;
}

:global(.light-theme .clickable-name:hover) {
  color: #db2777;
}

.preview-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.preview-image {
  width: 100%;
  aspect-ratio: 2 / 3;
  background-color: #18181b;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.light-theme .preview-image {
  background-color: #e4e4e7;
}

.preview-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.2s ease;
}

.preview-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 0.85rem;
  color: #a1a1aa;
}

.light-theme .preview-meta {
  color: #52525b;
}

.preview-meta code {
  padding: 2px 8px;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.08);
  font-variant-numeric: tabular-nums;
}

.light-theme .preview-meta code {
  background-color: rgba(0, 0, 0, 0.06);
}

.manual-help {
  margin-top: 8px;
  font-size: 0.85rem;
}

.manual-help code {
  padding: 2px 4px;
  border-radius: 3px;
  background-color: rgba(255, 255, 255, 0.08);
  font-size: 0.85em;
}

.light-theme .manual-help code {
  background-color: rgba(0, 0, 0, 0.06);
}
</style>
