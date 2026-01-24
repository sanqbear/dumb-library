import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Theme, ViewMode, Settings } from '../types'

export const useSettingsStore = defineStore('settings', () => {
  // State
  const theme = ref<Theme>('dark')
  const viewMode = ref<ViewMode>('grid')
  const isLoading = ref(false)

  // Actions
  const loadSettings = async (): Promise<void> => {
    isLoading.value = true
    
    try {
      const settings: Settings = await window.electron.loadSettings()
      theme.value = settings.theme
      viewMode.value = settings.viewMode
    } catch (e) {
      console.error('Failed to load settings:', e)
      // Use defaults
      theme.value = 'dark'
      viewMode.value = 'grid'
    } finally {
      isLoading.value = false
    }
  }

  const saveSettings = async (): Promise<void> => {
    try {
      await window.electron.saveSettings({
        theme: theme.value,
        viewMode: viewMode.value
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

  return {
    // State
    theme,
    viewMode,
    isLoading,
    
    // Actions
    loadSettings,
    saveSettings,
    setTheme,
    toggleTheme,
    setViewMode,
    toggleViewMode
  }
})
