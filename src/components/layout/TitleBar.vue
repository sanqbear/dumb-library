<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const isMaximized = ref(false)
let unsubscribe: (() => void) | undefined

onMounted(async () => {
  isMaximized.value = await window.electron.windowIsMaximized()
  unsubscribe = window.electron.onWindowMaximizeChanged((value) => {
    isMaximized.value = value
  })
})

onBeforeUnmount(() => {
  unsubscribe?.()
})

const handleMinimize = () => window.electron.windowMinimize()
const handleMaximize = () => window.electron.windowMaximize()
const handleClose = () => window.electron.windowClose()
</script>

<template>
  <div class="title-bar">
    <div class="drag-region">
      <span class="app-name">Waifu Library</span>
    </div>
    <div class="window-controls">
      <button class="control-btn" :aria-label="t('window.minimize')" @click="handleMinimize">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button class="control-btn" :aria-label="t('window.maximize')" @click="handleMaximize">
        <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10">
          <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
        </svg>
        <svg v-else width="10" height="10" viewBox="0 0 10 10">
          <rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" />
          <path d="M2.5 2.5 L2.5 0.5 L9.5 0.5 L9.5 7.5 L7.5 7.5" fill="none" stroke="currentColor" />
        </svg>
      </button>
      <button class="control-btn close-btn" :aria-label="t('window.close')" @click="handleClose">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M0.5 0.5 L9.5 9.5 M0.5 9.5 L9.5 0.5" stroke="currentColor" stroke-width="1" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  background-color: var(--bg);
  color: var(--text-2);
  border-bottom: 1px solid var(--line);
  user-select: none;
  flex-shrink: 0;
}

.drag-region {
  flex: 1;
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 12px;
  -webkit-app-region: drag;
}

.app-name {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.window-controls {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
}

.control-btn {
  width: 46px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  outline: none;
  transition: background-color 0.12s ease;
}

.control-btn:hover {
  background-color: var(--surface-2);
}

.control-btn:active {
  background-color: var(--surface);
}

.close-btn:hover {
  background-color: var(--danger);
  color: var(--on-plum);
}

.close-btn:active {
  background-color: var(--danger-press);
  color: var(--on-plum);
}
</style>
