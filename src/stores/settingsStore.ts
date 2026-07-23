import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Theme, ViewMode, Settings, GridCardSize } from '../types'
import { i18n, detectInitialLocale, isLocaleCode, type LocaleCode } from '../i18n'

export const useSettingsStore = defineStore('settings', () => {
  // State
  const theme = ref<Theme>('dark')
  const viewMode = ref<ViewMode>('grid')
  const language = ref<LocaleCode>('ko')
  const gridCardSize = ref<GridCardSize>('medium')
  const isLoading = ref(false)

  const applyLanguage = (lang: LocaleCode) => {
    language.value = lang
    i18n.global.locale.value = lang
  }

  // Actions
  const loadSettings = async (): Promise<void> => {
    isLoading.value = true

    try {
      const settings: Settings = await window.electron.loadSettings()
      theme.value = settings.theme
      viewMode.value = settings.viewMode
      // Added after the first release — older settings files lack it.
      gridCardSize.value = settings.gridCardSize ?? 'medium'
      // Language was introduced later — detect from OS when missing
      const savedLang = isLocaleCode(settings.language) ? settings.language : detectInitialLocale()
      applyLanguage(savedLang)
    } catch (e) {
      console.error('Failed to load settings:', e)
      theme.value = 'dark'
      viewMode.value = 'grid'
      applyLanguage(detectInitialLocale())
    } finally {
      isLoading.value = false
    }
  }

  const saveSettings = async (): Promise<void> => {
    try {
      await window.electron.saveSettings({
        theme: theme.value,
        viewMode: viewMode.value,
        language: language.value,
        gridCardSize: gridCardSize.value
      })
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  }

  const setTheme = (newTheme: Theme): void => {
    theme.value = newTheme
    saveSettings()
  }

  const toggleTheme = (): void => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    saveSettings()
  }

  const setViewMode = (mode: ViewMode): void => {
    viewMode.value = mode
    saveSettings()
  }

  const toggleViewMode = (): void => {
    viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
    saveSettings()
  }

  const setLanguage = (lang: LocaleCode): void => {
    applyLanguage(lang)
    saveSettings()
  }

  const setGridCardSize = (size: GridCardSize): void => {
    gridCardSize.value = size
    saveSettings()
  }

  return {
    // State
    theme,
    viewMode,
    language,
    gridCardSize,
    isLoading,

    // Actions
    loadSettings,
    saveSettings,
    setTheme,
    toggleTheme,
    setViewMode,
    toggleViewMode,
    setLanguage,
    setGridCardSize
  }
})
