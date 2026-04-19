<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NInput,
  NButton,
  NButtonGroup,
  NSelect,
  NSpace,
  NIcon,
  NTooltip,
  NPopover,
  NDropdown
} from 'naive-ui'
import {
  Search as SearchIcon,
  Grid as GridIcon,
  List as ListIcon,
  Add as AddIcon,
  Moon as MoonIcon,
  Sunny as SunnyIcon,
  FunnelOutline as FilterIcon,
  SwapVerticalOutline as SortIcon,
  DesktopOutline as DesktopIcon,
  LogoSteam as SteamIcon,
  LanguageOutline as LanguageIcon
} from '@vicons/ionicons5'
import { useLibraryStore } from '../../stores/libraryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import AddProgramDialog from '../dialogs/AddProgramDialog.vue'
import AddSteamProgramDialog from '../dialogs/AddSteamProgramDialog.vue'
import { PROVIDERS, PROVIDER_IDS, type ProviderId } from '../../types'
import { SUPPORTED_LOCALES, LOCALE_META, type LocaleCode } from '../../i18n'

const { t } = useI18n()
const libraryStore = useLibraryStore()
const settingsStore = useSettingsStore()

const showAddDialog = ref(false)
const showAddSteamDialog = ref(false)
const showFilters = ref(false)

const addMenuOptions = computed(() => [
  {
    label: t('header.addFromPC'),
    key: 'local',
    icon: () => h(NIcon, { component: DesktopIcon })
  },
  {
    label: t('header.addFromSteam'),
    key: 'steam',
    icon: () => h(NIcon, { component: SteamIcon })
  }
])

const handleAddMenuSelect = (key: string) => {
  if (key === 'local') {
    showAddDialog.value = true
  } else if (key === 'steam') {
    showAddSteamDialog.value = true
  }
}

// Language switcher — native names so each is recognisable in its own script
const languageMenuOptions = computed(() =>
  SUPPORTED_LOCALES.map(code => ({
    label: LOCALE_META[code].nativeName,
    key: code,
    // Highlight the currently active locale
    props: settingsStore.language === code ? { style: 'font-weight: 600;' } : {}
  }))
)

const handleLanguageSelect = (key: string) => {
  if ((SUPPORTED_LOCALES as string[]).includes(key)) {
    settingsStore.setLanguage(key as LocaleCode)
  }
}

// Provider options use i18n keys from the PROVIDERS registry
const categoryOptions = computed(() =>
  PROVIDER_IDS.map(id => ({
    label: t(PROVIDERS[id].labelKey),
    value: id
  }))
)

const tagOptions = computed(() =>
  libraryStore.allTags.map(tag => ({
    label: tag,
    value: tag
  }))
)

const sortOptions = computed(() => [
  { label: t('header.sortRecent'), value: 'createdAt-desc' },
  { label: t('header.sortOldest'), value: 'createdAt-asc' },
  { label: t('header.sortNameAsc'), value: 'title-asc' },
  { label: t('header.sortNameDesc'), value: 'title-desc' }
])

const currentSort = computed(() => `${libraryStore.sortBy}-${libraryStore.sortOrder}`)

const handleSortChange = (value: string) => {
  const [by, order] = value.split('-') as ['createdAt' | 'title', 'asc' | 'desc']
  libraryStore.setSortBy(by)
  libraryStore.setSortOrder(order)
}

const hasActiveFilters = computed(() =>
  libraryStore.selectedCategory !== null || libraryStore.selectedTags.length > 0
)

// Count of currently shown items. Matches filtered/total pattern so users
// see at a glance how much the current search/filter narrowed the library.
const isCountFiltered = computed(() =>
  libraryStore.searchQuery.trim() !== '' ||
  libraryStore.selectedCategory !== null ||
  libraryStore.selectedTags.length > 0
)

const handleSearch = (value: string) => {
  libraryStore.setSearchQuery(value)
}

const handleCategoryChange = (value: ProviderId | null) => {
  libraryStore.setSelectedCategory(value)
}

const handleTagsChange = (values: string[]) => {
  libraryStore.setSelectedTags(values)
}

const handleClearFilters = () => {
  libraryStore.clearFilters()
  showFilters.value = false
}
</script>

<template>
  <header class="app-header">
    <div class="header-center">
      <NInput
        :value="libraryStore.searchQuery"
        :placeholder="t('header.searchPlaceholder')"
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
            <label>{{ t('header.provider') }}</label>
            <NSelect
              :value="libraryStore.selectedCategory"
              :options="categoryOptions"
              :placeholder="t('header.allProviders')"
              clearable
              @update:value="handleCategoryChange"
            />
          </div>
          <div class="filter-section" v-if="tagOptions.length > 0">
            <label>{{ t('header.tags') }}</label>
            <NSelect
              :value="libraryStore.selectedTags"
              :options="tagOptions"
              :placeholder="t('header.selectTags')"
              multiple
              clearable
              @update:value="handleTagsChange"
            />
          </div>
          <div class="filter-actions" v-if="hasActiveFilters">
            <NButton size="small" quaternary @click="handleClearFilters">
              {{ t('header.clearFilters') }}
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

    <div class="header-count" aria-live="polite">
      {{ isCountFiltered
        ? t('header.filteredCountFormat', { filtered: libraryStore.filteredCount, total: libraryStore.programCount })
        : t('header.countFormat', { count: libraryStore.programCount }) }}
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
            {{ t('header.gridView') }}
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
            {{ t('header.listView') }}
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
          {{ settingsStore.theme === 'dark' ? t('header.lightMode') : t('header.darkMode') }}
        </NTooltip>

        <!-- Language switcher -->
        <NDropdown
          trigger="click"
          :options="languageMenuOptions"
          @select="handleLanguageSelect"
        >
          <NTooltip>
            <template #trigger>
              <NButton quaternary circle>
                <template #icon>
                  <NIcon :component="LanguageIcon" />
                </template>
              </NButton>
            </template>
            {{ t('header.language') }}
          </NTooltip>
        </NDropdown>

        <!-- Add button (dropdown) -->
        <NDropdown trigger="click" :options="addMenuOptions" @select="handleAddMenuSelect">
          <NButton type="primary">
            <template #icon>
              <NIcon :component="AddIcon" />
            </template>
            {{ t('header.addProgram') }}
          </NButton>
        </NDropdown>
      </NSpace>
    </div>

    <!-- Add Program Dialogs -->
    <AddProgramDialog v-model:show="showAddDialog" />
    <AddSteamProgramDialog v-model:show="showAddSteamDialog" />
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

.header-count {
  flex-shrink: 0;
  font-size: 0.8rem;
  color: #a1a1aa;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.light-theme .header-count {
  color: #52525b;
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
