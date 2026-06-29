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

// Radix Plum brand over a Tailwind zinc neutral ramp. Plum 9 (#ab4aba) is the
// solid primary in both themes; dark brightens on hover and darkens on press,
// light darkens on both. Status: info = Radix Indigo (bright on dark surfaces),
// danger = Radix Tomato (window close / delete).
// Force white text on filled primary/error buttons. naive-ui derives a filled
// button's label color from `common.baseColor`, which is #000 in the dark theme
// (its default primary is a light mint where black reads fine). Our plum/tomato
// fills are dark enough that black text fails contrast, so we pin the label to
// white — matching the design's --on-primary token. Ghost/text button variants
// keep deriving their color from the brand hue, so they're left untouched.
const onPrimaryText = {
  textColorPrimary: '#ffffff',
  textColorHoverPrimary: '#ffffff',
  textColorPressedPrimary: '#ffffff',
  textColorFocusPrimary: '#ffffff',
  textColorError: '#ffffff',
  textColorHoverError: '#ffffff',
  textColorPressedError: '#ffffff',
  textColorFocusError: '#ffffff'
}

// Match naive-ui components to the bundled Inter + Pretendard stack so buttons,
// inputs, tables, etc. render with the same fonts as the rest of the app.
const fontFamily =
  "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    fontFamily,
    primaryColor: '#ab4aba',
    primaryColorHover: '#b658c4',
    primaryColorPressed: '#8e3a9c',
    primaryColorSuppl: '#ab4aba',
    infoColor: '#7c8cf8',
    infoColorHover: '#8f9dfa',
    infoColorPressed: '#6575e8',
    infoColorSuppl: '#7c8cf8',
    errorColor: '#e54d2e',
    errorColorHover: '#ec5e43',
    errorColorPressed: '#d13c1c',
    errorColorSuppl: '#e54d2e'
  },
  Button: onPrimaryText
}

const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    fontFamily,
    primaryColor: '#ab4aba',
    primaryColorHover: '#a144af',
    primaryColorPressed: '#953ea3',
    primaryColorSuppl: '#ab4aba',
    infoColor: '#3e63dd',
    infoColorHover: '#5472e4',
    infoColorPressed: '#3658c8',
    infoColorSuppl: '#3e63dd',
    errorColor: '#e54d2e',
    errorColorHover: '#ec5e43',
    errorColorPressed: '#d13c1c',
    errorColorSuppl: '#e54d2e'
  },
  Button: onPrimaryText
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
            <!-- Keep the library list alive across navigation so its filters,
                 incremental-render window, and scroll position survive a trip to
                 the detail/edit pages and back. Only LibraryView is cached; the
                 detail/edit views remount fresh each time. -->
            <RouterView v-slot="{ Component }">
              <KeepAlive :include="['LibraryView']">
                <component :is="Component" />
              </KeepAlive>
            </RouterView>
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
