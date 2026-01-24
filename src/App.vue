<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme, lightTheme, type GlobalThemeOverrides } from 'naive-ui'
import { useLibraryStore } from './stores/libraryStore'
import { useSettingsStore } from './stores/settingsStore'
import AppHeader from './components/layout/AppHeader.vue'
import LibraryView from './components/library/LibraryView.vue'

const libraryStore = useLibraryStore()
const settingsStore = useSettingsStore()

// Theme configuration
const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#6366f1',
    primaryColorHover: '#818cf8',
    primaryColorPressed: '#4f46e5',
    primaryColorSuppl: '#6366f1'
  }
}

const currentTheme = computed(() => {
  return settingsStore.theme === 'dark' ? darkTheme : lightTheme
})

// Initialize app
onMounted(async () => {
  await settingsStore.loadSettings()
  await libraryStore.loadLibrary()
})
</script>

<template>
  <NConfigProvider :theme="currentTheme" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <NDialogProvider>
        <div 
          class="app-container"
          :class="{ 'light-theme': settingsStore.theme === 'light' }"
        >
          <AppHeader />
          <main class="main-content">
            <LibraryView />
          </main>
        </div>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #18181b;
  color: #fafafa;
}

.light-theme.app-container {
  background-color: #f4f4f5;
  color: #18181b;
}

.main-content {
  flex: 1;
  overflow: hidden;
  padding: 16px;
}
</style>
