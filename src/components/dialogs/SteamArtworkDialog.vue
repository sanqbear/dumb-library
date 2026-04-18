<script setup lang="ts">
import { ref, watch } from 'vue'
import { NModal, NButton, NSpace, NSpin, useMessage } from 'naive-ui'

interface ArtworkOption {
  key: string
  label: string
  aspectLabel: string
  url: (appId: number) => string
}

const ARTWORK_OPTIONS: ArtworkOption[] = [
  {
    key: 'library_600x900_2x',
    label: 'Library Cover',
    aspectLabel: '2:3',
    url: (id) => `https://steamcdn-a.akamaihd.net/steam/apps/${id}/library_600x900_2x.jpg`
  },
  {
    key: 'library_hero',
    label: 'Library Hero',
    aspectLabel: '~3:1',
    url: (id) => `https://steamcdn-a.akamaihd.net/steam/apps/${id}/library_hero.jpg`
  },
  {
    key: 'header',
    label: 'Header',
    aspectLabel: '~2:1',
    url: (id) => `https://steamcdn-a.akamaihd.net/steam/apps/${id}/header.jpg`
  },
  {
    key: 'capsule_616x353',
    label: 'Capsule',
    aspectLabel: '~16:9',
    url: (id) => `https://steamcdn-a.akamaihd.net/steam/apps/${id}/capsule_616x353.jpg`
  },
  {
    key: 'logo',
    label: 'Logo',
    aspectLabel: 'free',
    url: (id) => `https://steamcdn-a.akamaihd.net/steam/apps/${id}/logo.png`
  }
]

const props = defineProps<{
  show: boolean
  appId: number | null
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  /**
   * Payload is an absolute temp file path the caller can treat like a selected source.
   * The user has chosen one artwork and the main process has downloaded it.
   */
  (e: 'selected', tempPath: string): void
}>()

const message = useMessage()

// availability: 'loading' | 'ok' | 'error' per option key
const availability = ref<Record<string, 'loading' | 'ok' | 'error'>>({})
const fetchingKey = ref<string | null>(null)

watch(() => props.show, (v) => {
  if (v && props.appId !== null) {
    // reset availability map so <img> @load/@error re-fires
    availability.value = Object.fromEntries(
      ARTWORK_OPTIONS.map(o => [o.key, 'loading'])
    )
  }
})

const handleImageLoad = (key: string) => {
  availability.value[key] = 'ok'
}

const handleImageError = (key: string) => {
  availability.value[key] = 'error'
}

const handleSelect = async (option: ArtworkOption) => {
  if (props.appId === null) return
  if (availability.value[option.key] !== 'ok') return
  const url = option.url(props.appId)
  fetchingKey.value = option.key
  try {
    const tempPath = await window.electron.fetchImageFromUrl(url)
    if (tempPath) {
      emit('selected', tempPath)
      emit('update:show', false)
    } else {
      message.error('이미지 다운로드에 실패했습니다')
    }
  } finally {
    fetchingKey.value = null
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
    title="Steam 아트워크 선택"
    :bordered="false"
    size="medium"
    :style="{ width: '680px' }"
    :mask-closable="false"
  >
    <div class="artwork-grid" v-if="appId !== null">
      <div
        v-for="option in ARTWORK_OPTIONS"
        :key="option.key"
        class="artwork-card"
        :class="{
          'is-unavailable': availability[option.key] === 'error',
          'is-loading': availability[option.key] === 'loading' || fetchingKey === option.key,
          'is-selecting': fetchingKey === option.key
        }"
        @click="handleSelect(option)"
      >
        <div class="artwork-image">
          <img
            :src="option.url(appId)"
            :alt="option.label"
            @load="handleImageLoad(option.key)"
            @error="handleImageError(option.key)"
          />
          <NSpin v-if="fetchingKey === option.key" class="overlay-spinner" size="small" />
        </div>
        <div class="artwork-meta">
          <span class="artwork-label">{{ option.label }}</span>
          <span class="artwork-aspect">{{ option.aspectLabel }}</span>
        </div>
        <div v-if="availability[option.key] === 'error'" class="unavailable-hint">
          해당 아트워크 없음
        </div>
      </div>
    </div>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleCancel">닫기</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.artwork-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.artwork-card {
  border-radius: 8px;
  overflow: hidden;
  background-color: #3f3f46;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  position: relative;
  display: flex;
  flex-direction: column;
}

:global(.light-theme) .artwork-card {
  background-color: #f4f4f5;
}

.artwork-card:hover:not(.is-unavailable):not(.is-loading) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.artwork-card.is-unavailable {
  cursor: not-allowed;
  opacity: 0.4;
}

.artwork-card.is-selecting {
  cursor: progress;
}

.artwork-image {
  width: 100%;
  aspect-ratio: 3 / 2;
  background-color: #27272a;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.artwork-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.overlay-spinner {
  position: absolute;
  inset: 0;
  margin: auto;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.artwork-meta {
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  font-size: 0.8rem;
}

.artwork-label {
  font-weight: 500;
}

.artwork-aspect {
  color: #a1a1aa;
  font-variant-numeric: tabular-nums;
}

.unavailable-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #a1a1aa;
  pointer-events: none;
}
</style>
