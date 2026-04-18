import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Program, LibraryData, CreateProgramData, UpdateProgramData, ProviderId } from '../types'

export const useLibraryStore = defineStore('library', () => {
  // State
  const programs = ref<Program[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Filter state
  const searchQuery = ref('')
  const selectedCategory = ref<ProviderId | null>(null)
  const selectedTags = ref<string[]>([])

  // Sort state
  const sortBy = ref<'createdAt' | 'title'>('createdAt')
  const sortOrder = ref<'asc' | 'desc'>('desc')

  // Getters
  const filteredPrograms = computed(() => {
    let result = [...programs.value]
    
    // Filter by search query
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase().trim()
      result = result.filter(p => 
        p.title.toLowerCase().includes(query)
      )
    }
    
    // Filter by category
    if (selectedCategory.value) {
      result = result.filter(p => p.category === selectedCategory.value)
    }
    
    // Filter by tags
    if (selectedTags.value.length > 0) {
      result = result.filter(p => 
        selectedTags.value.some(tag => p.tags.includes(tag))
      )
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

      // Extract icon
      if (newProgram.executablePath) {
        const iconPath = await window.electron.extractIcon(newProgram.executablePath, newProgram.id)
        if (iconPath) {
          const index = programs.value.findIndex(p => p.id === newProgram.id)
          if (index !== -1) {
            const program = programs.value[index]
            if (program) {
              program.iconPath = iconPath
            }
          }
        }
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

  const launchProgram = async (program: Program): Promise<void> => {
    try {
      await window.electron.launchProgram(program.executablePath)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to launch program'
      console.error('Failed to launch program:', e)
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
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete thumbnail'
      console.error('Failed to delete thumbnail:', e)
    }
  }

  // Filter actions
  const setSearchQuery = (query: string): void => {
    searchQuery.value = query
  }

  const setSelectedCategory = (category: ProviderId | null): void => {
    selectedCategory.value = category
  }

  const setSelectedTags = (tags: string[]): void => {
    selectedTags.value = tags
  }

  const clearFilters = (): void => {
    searchQuery.value = ''
    selectedCategory.value = null
    selectedTags.value = []
  }

  const setSortBy = (value: 'createdAt' | 'title'): void => {
    sortBy.value = value
  }

  const setSortOrder = (value: 'asc' | 'desc'): void => {
    sortOrder.value = value
  }

  return {
    // State
    programs,
    isLoading,
    error,
    searchQuery,
    selectedCategory,
    selectedTags,
    sortBy,
    sortOrder,

    // Getters
    filteredPrograms,
    allTags,
    programCount,
    filteredCount,

    // Actions
    loadLibrary,
    addProgram,
    updateProgram,
    deleteProgram,
    launchProgram,
    saveThumbnail,
    deleteThumbnail,
    setSearchQuery,
    setSelectedCategory,
    setSelectedTags,
    clearFilters,
    setSortBy,
    setSortOrder
  }
})
