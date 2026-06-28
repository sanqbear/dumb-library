import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Program, LibraryData, CreateProgramData, UpdateProgramData, ProviderId, SteamGame, CreateSteamProgramData } from '../types'

export const useLibraryStore = defineStore('library', () => {
  // State
  const programs = ref<Program[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Filter state
  // `searchQuery` is the committed value bound to the search field (IME
  // composition-aware). `searchQueryLive` is updated from the input's native
  // `input` event on every keystroke — including Hangul composition steps —
  // so filtering reacts per visible character rather than per finished
  // syllable. See docs guideline on IME input handling.
  const searchQuery = ref('')
  const searchQueryLive = ref('')
  const selectedCategory = ref<ProviderId | null>(null)
  const selectedTags = ref<string[]>([])

  // The text the user currently sees in the field. Falls back to the
  // committed value for seeded/cleared states where no live keystroke arrived.
  const effectiveSearch = computed(() => searchQueryLive.value || searchQuery.value)

  // Debounced copy of the search text that actually drives filtering. The field
  // and the result count react to effectiveSearch instantly, but the expensive
  // filter/sort over the whole library only re-runs after a short pause. 120ms
  // keeps per-character Hangul filtering responsive while collapsing bursts of
  // keystrokes into a single recompute.
  const debouncedSearch = ref('')
  let searchDebounceTimer: number | null = null
  watch(effectiveSearch, (value) => {
    if (searchDebounceTimer !== null) window.clearTimeout(searchDebounceTimer)
    searchDebounceTimer = window.setTimeout(() => {
      debouncedSearch.value = value
      searchDebounceTimer = null
    }, 120)
  })

  // Precomputed lowercase search blob (title + tags + keywords) per program id.
  // Rebuilt only when the program list changes — not on every keystroke — so
  // searching no longer re-lowercases every field of every program each time.
  const searchIndex = computed(() => {
    const index = new Map<string, string>()
    for (const p of programs.value) {
      index.set(
        p.id,
        `${p.title}\n${p.tags.join('\n')}\n${(p.keywords ?? []).join('\n')}`.toLowerCase()
      )
    }
    return index
  })

  // Sort state — default to 가나다(title ascending) on first launch
  const sortBy = ref<'createdAt' | 'title'>('title')
  const sortOrder = ref<'asc' | 'desc'>('asc')

  // Random-pick highlight: ID of the program currently highlighted by
  // pickRandom(). Components watch this to scroll into view and apply a
  // non-layout-shifting visual ring. Auto-clears via a timer.
  const highlightedProgramId = ref<string | null>(null)
  let highlightTimer: number | null = null
  const HIGHLIGHT_DURATION_MS = 3500

  // Getters
  const filteredPrograms = computed(() => {
    let result = [...programs.value]

    // Filter by search query — matches title, categorization tags, and
    // search-index keywords (all folded into searchIndex). Uses the debounced
    // value so rapid typing doesn't re-run the whole filter/sort per keystroke.
    const query = debouncedSearch.value.toLowerCase().trim()
    if (query) {
      const index = searchIndex.value
      result = result.filter(p => index.get(p.id)?.includes(query))
    }

    // Filter by category
    if (selectedCategory.value) {
      result = result.filter(p => p.category === selectedCategory.value)
    }

    // Filter by tags — membership tested against a Set to avoid a nested scan.
    if (selectedTags.value.length > 0) {
      const tagSet = new Set(selectedTags.value)
      result = result.filter(p => p.tags.some(tag => tagSet.has(tag)))
    }

    // Sort
    result.sort((a, b) => {
      let cmp: number
      if (sortBy.value === 'title') {
        cmp = a.title.localeCompare(b.title, 'ko')
      } else {
        cmp = a.createdAt.localeCompare(b.createdAt)
      }
      return sortOrder.value === 'asc' ? cmp : -cmp
    })

    return result
  })

  const allTags = computed(() => {
    const tagSet = new Set<string>()
    programs.value.forEach(p => {
      p.tags.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  })

  const programCount = computed(() => programs.value.length)
  const filteredCount = computed(() => filteredPrograms.value.length)

  // Actions
  const loadLibrary = async (): Promise<void> => {
    isLoading.value = true
    error.value = null
    
    try {
      const data: LibraryData = await window.electron.loadLibrary()
      programs.value = data.programs
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load library'
      console.error('Failed to load library:', e)
    } finally {
      isLoading.value = false
    }
  }

  const addProgram = async (data: CreateProgramData): Promise<Program | null> => {
    isLoading.value = true
    error.value = null
    
    try {
      const newProgram = await window.electron.addProgram(data)
      programs.value.push(newProgram)

      // Extract the icon in the background. Icon extraction spawns PowerShell
      // and can be slow (or hang up to its 15s timeout) on slow disks, network
      // drives, or broken executables — blocking the add flow would leave the
      // Add dialog spinning. The program is already added; patch its icon in
      // place when extraction resolves.
      if (newProgram.executablePath) {
        void window.electron
          .extractIcon(newProgram.executablePath, newProgram.id)
          .then((iconPath) => {
            if (!iconPath) return
            const program = programs.value.find(p => p.id === newProgram.id)
            if (program) {
              program.iconPath = iconPath
              program.updatedAt = new Date().toISOString()
            }
          })
          .catch((e) => console.error('Background icon extraction failed:', e))
      }

      return newProgram
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to add program'
      console.error('Failed to add program:', e)
      return null
    } finally {
      isLoading.value = false
    }
  }

  const updateProgram = async (data: UpdateProgramData): Promise<Program | null> => {
    isLoading.value = true
    error.value = null
    
    try {
      const updatedProgram = await window.electron.updateProgram(data)
      const index = programs.value.findIndex(p => p.id === data.id)
      if (index !== -1) {
        programs.value[index] = updatedProgram
      }

      return updatedProgram
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update program'
      console.error('Failed to update program:', e)
      return null
    } finally {
      isLoading.value = false
    }
  }

  const deleteProgram = async (id: string): Promise<boolean> => {
    isLoading.value = true
    error.value = null
    
    try {
      await window.electron.deleteProgram(id)
      const index = programs.value.findIndex(p => p.id === id)
      if (index !== -1) {
        programs.value.splice(index, 1)
      }
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete program'
      console.error('Failed to delete program:', e)
      return false
    } finally {
      isLoading.value = false
    }
  }

  const scanSteamGames = async (): Promise<SteamGame[]> => {
    try {
      return await window.electron.scanSteamGames()
    } catch (e) {
      console.error('Failed to scan Steam games:', e)
      return []
    }
  }

  const addSteamPrograms = async (entries: CreateSteamProgramData[]): Promise<Program[]> => {
    isLoading.value = true
    error.value = null

    try {
      const newPrograms = await window.electron.addSteamPrograms(entries)
      programs.value.push(...newPrograms)
      return newPrograms
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to add Steam programs'
      console.error('Failed to add Steam programs:', e)
      return []
    } finally {
      isLoading.value = false
    }
  }

  const launchProgram = async (program: Program): Promise<void> => {
    try {
      await window.electron.launchProgram(program.executablePath)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to launch program'
      console.error('Failed to launch program:', e)
    }
  }

  const openMarketUrl = async (program: Program): Promise<boolean> => {
    if (!program.marketUrl) return false
    try {
      return await window.electron.openExternal(program.marketUrl)
    } catch (e) {
      console.error('Failed to open market URL:', e)
      return false
    }
  }

  const revealProgram = async (program: Program): Promise<void> => {
    try {
      await window.electron.revealProgram(program.executablePath)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to reveal program'
      console.error('Failed to reveal program:', e)
    }
  }

  const saveThumbnail = async (programId: string, imagePath: string): Promise<string | null> => {
    try {
      const thumbnailPath = await window.electron.saveThumbnail(programId, imagePath)
      const index = programs.value.findIndex(p => p.id === programId)
      if (index !== -1) {
        const program = programs.value[index]
        if (program) {
          program.thumbnailPath = thumbnailPath
          program.updatedAt = new Date().toISOString()
        }
      }
      return thumbnailPath
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save thumbnail'
      console.error('Failed to save thumbnail:', e)
      return null
    }
  }

  const deleteThumbnail = async (programId: string): Promise<void> => {
    try {
      await window.electron.deleteThumbnail(programId)
      const index = programs.value.findIndex(p => p.id === programId)
      if (index !== -1) {
        const program = programs.value[index]
        if (program) {
          program.thumbnailPath = null
          program.updatedAt = new Date().toISOString()
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete thumbnail'
      console.error('Failed to delete thumbnail:', e)
    }
  }

  const savePreviewImage = async (programId: string, imagePath: string): Promise<string | null> => {
    try {
      const relPath = await window.electron.savePreviewImage(programId, imagePath)
      const program = programs.value.find(p => p.id === programId)
      if (program && relPath) {
        program.previewImages = [...program.previewImages, relPath]
        program.updatedAt = new Date().toISOString()
      }
      return relPath
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save preview image'
      console.error('Failed to save preview image:', e)
      return null
    }
  }

  const deletePreviewImage = async (programId: string, relPath: string): Promise<void> => {
    try {
      await window.electron.deletePreviewImage(programId, relPath)
      const program = programs.value.find(p => p.id === programId)
      if (program) {
        program.previewImages = program.previewImages.filter(p => p !== relPath)
        program.updatedAt = new Date().toISOString()
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete preview image'
      console.error('Failed to delete preview image:', e)
    }
  }

  const reorderPreviewImages = async (programId: string, relPaths: string[]): Promise<void> => {
    try {
      await window.electron.reorderPreviewImages(programId, relPaths)
      const program = programs.value.find(p => p.id === programId)
      if (program) {
        program.previewImages = [...relPaths]
        program.updatedAt = new Date().toISOString()
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to reorder preview images'
      console.error('Failed to reorder preview images:', e)
    }
  }

  const saveIcon = async (programId: string, imagePath: string): Promise<string | null> => {
    try {
      const iconPath = await window.electron.saveIcon(programId, imagePath)
      const program = programs.value.find(p => p.id === programId)
      if (program) {
        program.iconPath = iconPath
        program.updatedAt = new Date().toISOString()
      }
      return iconPath
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save icon'
      console.error('Failed to save icon:', e)
      return null
    }
  }

  const deleteIcon = async (programId: string): Promise<void> => {
    try {
      await window.electron.deleteIcon(programId)
      const program = programs.value.find(p => p.id === programId)
      if (program) {
        program.iconPath = null
        program.updatedAt = new Date().toISOString()
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete icon'
      console.error('Failed to delete icon:', e)
    }
  }

  const fetchImageFromUrl = async (url: string): Promise<string | null> => {
    try {
      return await window.electron.fetchImageFromUrl(url)
    } catch (e) {
      console.error('Failed to fetch image from URL:', e)
      return null
    }
  }

  const downloadSteamThumbnail = async (programId: string, appId: number): Promise<string | null> => {
    try {
      const relPath = await window.electron.downloadSteamThumbnail(programId, appId)
      const program = programs.value.find(p => p.id === programId)
      if (program && relPath) {
        program.thumbnailPath = relPath
        program.updatedAt = new Date().toISOString()
      }
      return relPath
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to download Steam thumbnail'
      console.error('Failed to download Steam thumbnail:', e)
      return null
    }
  }

  const applySteamCachedIcon = async (programId: string, appId: number): Promise<string | null> => {
    try {
      const relPath = await window.electron.applySteamCachedIcon(programId, appId)
      const program = programs.value.find(p => p.id === programId)
      if (program && relPath) {
        program.iconPath = relPath
        program.updatedAt = new Date().toISOString()
      }
      return relPath
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to apply Steam cached icon'
      console.error('Failed to apply Steam cached icon:', e)
      return null
    }
  }

  const reextractIcon = async (programId: string, executablePath: string): Promise<string | null> => {
    try {
      const iconPath = await window.electron.extractIcon(executablePath, programId)
      const program = programs.value.find(p => p.id === programId)
      if (program && iconPath) {
        program.iconPath = iconPath
        program.updatedAt = new Date().toISOString()
      }
      return iconPath
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to re-extract icon'
      console.error('Failed to re-extract icon:', e)
      return null
    }
  }

  // Filter actions
  // Committed/clear path (composition end, clear button, programmatic reset).
  // Keeps both refs in sync so the live fallback never serves stale text.
  const setSearchQuery = (query: string): void => {
    searchQuery.value = query
    searchQueryLive.value = query
  }

  // Live path — driven by the input's native `input` event. Updates only the
  // live ref, leaving the field-bound committed ref untouched so naive-ui does
  // not rewrite the input value mid-composition (which would break the IME).
  const setSearchQueryLive = (query: string): void => {
    searchQueryLive.value = query
  }

  const setSelectedCategory = (category: ProviderId | null): void => {
    selectedCategory.value = category
  }

  const setSelectedTags = (tags: string[]): void => {
    selectedTags.value = tags
  }

  const clearFilters = (): void => {
    searchQuery.value = ''
    searchQueryLive.value = ''
    selectedCategory.value = null
    selectedTags.value = []
  }

  const setSortBy = (value: 'createdAt' | 'title'): void => {
    sortBy.value = value
  }

  const setSortOrder = (value: 'asc' | 'desc'): void => {
    sortOrder.value = value
  }

  const clearHighlight = (): void => {
    if (highlightTimer !== null) {
      window.clearTimeout(highlightTimer)
      highlightTimer = null
    }
    highlightedProgramId.value = null
  }

  // Pick a random program from the entire library (not the filtered view).
  // If the picked program is currently filtered out, filters are cleared so
  // it becomes visible. Returns the picked program, or null when the library
  // is empty.
  const pickRandom = (): Program | null => {
    if (programs.value.length === 0) return null
    const picked = programs.value[Math.floor(Math.random() * programs.value.length)]
    if (!picked) return null

    const visibleIds = new Set(filteredPrograms.value.map(p => p.id))
    if (!visibleIds.has(picked.id)) {
      clearFilters()
    }

    if (highlightTimer !== null) {
      window.clearTimeout(highlightTimer)
    }
    highlightedProgramId.value = picked.id
    highlightTimer = window.setTimeout(() => {
      highlightedProgramId.value = null
      highlightTimer = null
    }, HIGHLIGHT_DURATION_MS)

    return picked
  }

  // Apply background patches pushed from the main process (e.g. a Steam
  // thumbnail that finished downloading after the program was already added).
  // Subscribed once for the app lifetime — the store is a singleton.
  if (typeof window !== 'undefined' && window.electron?.onProgramPatched) {
    window.electron.onProgramPatched(({ id, changes }) => {
      const program = programs.value.find(p => p.id === id)
      if (!program) return
      Object.assign(program, changes)
      // Bump updatedAt so image URLs cache-bust when a path is replaced in place.
      program.updatedAt = new Date().toISOString()
    })
  }

  return {
    // State
    programs,
    isLoading,
    error,
    searchQuery,
    searchQueryLive,
    selectedCategory,
    selectedTags,
    sortBy,
    sortOrder,
    highlightedProgramId,

    // Getters
    filteredPrograms,
    effectiveSearch,
    allTags,
    programCount,
    filteredCount,

    // Actions
    loadLibrary,
    addProgram,
    updateProgram,
    deleteProgram,
    launchProgram,
    revealProgram,
    openMarketUrl,
    saveThumbnail,
    deleteThumbnail,
    savePreviewImage,
    deletePreviewImage,
    reorderPreviewImages,
    saveIcon,
    deleteIcon,
    reextractIcon,
    fetchImageFromUrl,
    downloadSteamThumbnail,
    applySteamCachedIcon,
    scanSteamGames,
    addSteamPrograms,
    setSearchQuery,
    setSearchQueryLive,
    setSelectedCategory,
    setSelectedTags,
    clearFilters,
    setSortBy,
    setSortOrder,
    pickRandom,
    clearHighlight
  }
})
