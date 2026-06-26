<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme, lightTheme, type GlobalThemeOverrides } from 'naive-ui'
import { useLibraryStore } from './stores/libraryStore'
import { useSettingsStore } from './stores/settingsStore'
import TitleBar from './components/layout/TitleBar.vue'
import AppHeader from './components/layout/AppHeader.vue'

const libraryStore = useLibraryStore()
const settingsStore = useSettingsStore()
const route = useRoute()

// The library search/filter header is only meaningful on the library route;
// the detail/edit pages provide their own headers.
const showLibraryHeader = computed(() => route.name === 'library')

// Sakura Rose palette — softer pastel for dark surfaces,
// richer saturation for light surfaces (pastels wash out on white).
const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#e87ea1',
    primaryColorHover: '#f093b0',
    primaryColorPressed: '#c96081',
    primaryColorSuppl: '#e87ea1'
  }
}

const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#db2777',
    primaryColorHover: '#ec4899',
    primaryColorPressed: '#be185d',
    primaryColorSuppl: '#db2777'
  }
}

const currentTheme = computed(() => {
  return settingsStore.theme === 'dark' ? darkTheme : lightTheme
})

const themeOverrides = computed<GlobalThemeOverrides>(() => {
  return settingsStore.theme === 'dark' ? darkThemeOverrides : lightThemeOverrides
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
          <TitleBar />
          <AppHeader v-if="showLibraryHeader" />
          <main class="main-content">
            <RouterView />
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
