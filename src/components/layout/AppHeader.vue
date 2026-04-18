<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  NInput, 
  NButton, 
  NButtonGroup,
  NSelect,
  NSpace,
  NIcon,
  NTooltip,
  NPopover
} from 'naive-ui'
import {
  Search as SearchIcon,
  Grid as GridIcon,
  List as ListIcon,
  Add as AddIcon,
  Moon as MoonIcon,
  Sunny as SunnyIcon,
  FunnelOutline as FilterIcon,
  SwapVerticalOutline as SortIcon
} from '@vicons/ionicons5'
import { useLibraryStore } from '../../stores/libraryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import AddProgramDialog from '../dialogs/AddProgramDialog.vue'

const libraryStore = useLibraryStore()
const settingsStore = useSettingsStore()

const showAddDialog = ref(false)
const showFilters = ref(false)

// Category options for filter
const categoryOptions = computed(() => 
  libraryStore.categories.map(cat => ({
    label: cat,
    value: cat
  }))
)

// Tag options for filter
const tagOptions = computed(() => 
  libraryStore.allTags.map(tag => ({
    label: tag,
    value: tag
  }))
)

// Sort options
const sortOptions = [
  { label: '최신순', value: 'createdAt-desc' },
  { label: '오래된순', value: 'createdAt-asc' },
  { label: '이름순 (ㄱ-ㅎ)', value: 'title-asc' },
  { label: '이름순 (ㅎ-ㄱ)', value: 'title-desc' }
]

const currentSort = computed(() => `${libraryStore.sortBy}-${libraryStore.sortOrder}`)

const handleSortChange = (value: string) => {
  const [by, order] = value.split('-') as ['createdAt' | 'title', 'asc' | 'desc']
  libraryStore.setSortBy(by)
  libraryStore.setSortOrder(order)
}

// Check if any filter is active
const hasActiveFilters = computed(() =>
  libraryStore.selectedCategory !== null || libraryStore.selectedTags.length > 0
)

const handleSearch = (value: string) => {
  libraryStore.setSearchQuery(value)
}

const handleCategoryChange = (value: string | null) => {
  libraryStore.setSelectedCategory(value === '' ? null : value)
}

const handleTagsChange = (values: string[]) => {
  libraryStore.setSelectedTags(values)
}

const handleClearFilters = () => {
  libraryStore.clearFilters()
  showFilters.value = false
}

const handleAddProgram = () => {
  showAddDialog.value = true
}
</script>

<template>
  <header class="app-header">
    <div class="header-center">
      <NInput
        :value="libraryStore.searchQuery"
        placeholder="Search programs..."
        clearable
        @update:value="handleSearch"
        class="search-input"
      >
        <template #prefix>
          <NIcon :component="SearchIcon" />
        </template>
      </NInput>

      <NPopover trigger="click" placement="bottom" v-model:show="showFilters">
        <template #trigger>
          <NButton quaternary circle :type="hasActiveFilters ? 'primary' : 'default'">
            <template #icon>
              <NIcon :component="FilterIcon" />
            </template>
          </NButton>
        </template>
        <div class="filter-popover">
          <div class="filter-section">
            <label>Category</label>
            <NSelect
              :value="libraryStore.selectedCategory"
              :options="[{ label: 'All', value: '' }, ...categoryOptions]"
              placeholder="All categories"
              clearable
              @update:value="handleCategoryChange"
            />
          </div>
          <div class="filter-section" v-if="tagOptions.length > 0">
            <label>Tags</label>
            <NSelect
              :value="libraryStore.selectedTags"
              :options="tagOptions"
              placeholder="Select tags"
              multiple
              clearable
              @update:value="handleTagsChange"
            />
          </div>
          <div class="filter-actions" v-if="hasActiveFilters">
            <NButton size="small" quaternary @click="handleClearFilters">
              Clear Filters
            </NButton>
          </div>
        </div>
      </NPopover>

      <NSelect
        :value="currentSort"
        :options="sortOptions"
        :consistent-menu-width="false"
        class="sort-select"
        @update:value="handleSortChange"
      >
        <template #arrow>
          <NIcon :component="SortIcon" />
        </template>
      </NSelect>
    </div>

    <div class="header-right">
      <NSpace>
        <!-- View mode toggle -->
        <NButtonGroup>
          <NTooltip>
            <template #trigger>
              <NButton 
                :type="settingsStore.viewMode === 'grid' ? 'primary' : 'default'"
                @click="settingsStore.setViewMode('grid')"
                quaternary
              >
                <template #icon>
                  <NIcon :component="GridIcon" />
                </template>
              </NButton>
            </template>
            Grid View
          </NTooltip>
          <NTooltip>
            <template #trigger>
              <NButton 
                :type="settingsStore.viewMode === 'list' ? 'primary' : 'default'"
                @click="settingsStore.setViewMode('list')"
                quaternary
              >
                <template #icon>
                  <NIcon :component="ListIcon" />
                </template>
              </NButton>
            </template>
            List View
          </NTooltip>
        </NButtonGroup>

        <!-- Theme toggle -->
        <NTooltip>
          <template #trigger>
            <NButton quaternary circle @click="settingsStore.toggleTheme">
              <template #icon>
                <NIcon :component="settingsStore.theme === 'dark' ? SunnyIcon : MoonIcon" />
              </template>
            </NButton>
          </template>
          {{ settingsStore.theme === 'dark' ? 'Light Mode' : 'Dark Mode' }}
        </NTooltip>

        <!-- Add button -->
        <NButton type="primary" @click="handleAddProgram">
          <template #icon>
            <NIcon :component="AddIcon" />
          </template>
          Add Program
        </NButton>
      </NSpace>
    </div>

    <!-- Add Program Dialog -->
    <AddProgramDialog v-model:show="showAddDialog" />
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background-color: #27272a;
  border-bottom: 1px solid #3f3f46;
  gap: 20px;
}

.light-theme .app-header {
  background-color: #ffffff;
  border-bottom-color: #e4e4e7;
}

.header-center {
  flex: 1;
  max-width: 600px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  flex: 1;
}

.header-right {
  flex-shrink: 0;
}

.sort-select {
  width: 150px;
  flex-shrink: 0;
}

.filter-popover {
  padding: 8px;
  min-width: 200px;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.filter-section:last-of-type {
  margin-bottom: 0;
}

.filter-section label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #a1a1aa;
}

.filter-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #3f3f46;
  text-align: right;
}

.light-theme .filter-actions {
  border-top-color: #e4e4e7;
}
</style>
