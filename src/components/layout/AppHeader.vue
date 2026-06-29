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
  LanguageOutline as LanguageIcon,
  ShuffleOutline as ShuffleIcon,
  PeopleOutline as DeveloperIcon
} from '@vicons/ionicons5'
import { useMessage } from 'naive-ui'
import { useLibraryStore } from '../../stores/libraryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import AddProgramDialog from '../dialogs/AddProgramDialog.vue'
import AddSteamProgramDialog from '../dialogs/AddSteamProgramDialog.vue'
import DeveloperManagerDialog from '../dialogs/DeveloperManagerDialog.vue'
import { PROVIDERS, PROVIDER_IDS, type ProviderId } from '../../types'
import { SUPPORTED_LOCALES, LOCALE_META, type LocaleCode } from '../../i18n'
import { useDeveloperName } from '../../composables/useDeveloperName'

const { t } = useI18n()
const libraryStore = useLibraryStore()
const settingsStore = useSettingsStore()
const message = useMessage()
const { resolveDeveloperName } = useDeveloperName()

const showAddDialog = ref(false)
const showAddSteamDialog = ref(false)
const showDeveloperManager = ref(false)
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

// Developer filter options, resolved to the active UI language and sorted by name.
const developerOptions = computed(() =>
  libraryStore.developers
    .map(d => ({ label: resolveDeveloperName(d.id), value: d.id }))
    .sort((a, b) => a.label.localeCompare(b.label))
)

// Custom dropdown search: match the typed text against every localized name of
// the developer (ko/en/ja/zh-CN), not just the label shown in the active UI
// language — so a circle can be found by any of its translated names regardless
// of the current language.
const developerFilter = (pattern: string, option: { value?: string | number }): boolean => {
  const dev = typeof option.value === 'string' ? libraryStore.developerMap.get(option.value) : undefined
  if (!dev) return false
  const haystack = Object.values(dev.names).filter(Boolean).join('\n').toLowerCase()
  return haystack.includes(pattern.toLowerCase())
}

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
  libraryStore.selectedCategory !== null ||
  libraryStore.selectedDeveloper !== null ||
  libraryStore.selectedTags.length > 0
)

// Count of currently shown items. Matches filtered/total pattern so users
// see at a glance how much the current search/filter narrowed the library.
const isCountFiltered = computed(() =>
  libraryStore.effectiveSearch.trim() !== '' ||
  libraryStore.selectedCategory !== null ||
  libraryStore.selectedDeveloper !== null ||
  libraryStore.selectedTags.length > 0
)

// Live read from the native `input` event (bubbles out of NInput's inner
// <input>). Fires on every keystroke including IME composition steps, so
// Hangul filtering reacts per visible character instead of per syllable.
// Leaves the committed ref bound to the field untouched to avoid rewriting
// the input value mid-composition. See IME input handling guideline.
const handleSearchInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  if (target) libraryStore.setSearchQueryLive(target.value)
}

// Committed/clear path: composition end and the clearable button emit here.
const handleSearch = (value: string) => {
  libraryStore.setSearchQuery(value)
}

const handleCategoryChange = (value: ProviderId | null) => {
  libraryStore.setSelectedCategory(value)
}

const handleDeveloperChange = (value: string | null) => {
  libraryStore.setSelectedDeveloper(value)
}

const handleTagsChange = (values: string[]) => {
  libraryStore.setSelectedTags(values)
}

const handleClearFilters = () => {
  libraryStore.clearFilters()
  showFilters.value = false
}

const handleRandomPick = () => {
  const picked = libraryStore.pickRandom()
  if (!picked) {
    message.info(t('header.randomEmpty'))
  }
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <div class="search-cluster">
        <!-- Native @input on the wrapper catches the inner <input>'s DOM event
             (it bubbles), giving a live, IME-aware read of what the user sees.
             v-model stays on NInput for composition-safe committed state. -->
        <div class="search-input-wrap" @input="handleSearchInput">
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
        </div>

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
            <div class="filter-section" v-if="developerOptions.length > 0">
              <label>{{ t('header.developer') }}</label>
              <NSelect
                :value="libraryStore.selectedDeveloper"
                :options="developerOptions"
                :placeholder="t('header.allDevelopers')"
                filterable
                :filter="developerFilter"
                clearable
                @update:value="handleDeveloperChange"
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

        <!-- Random pick -->
        <NTooltip>
          <template #trigger>
            <NButton
              quaternary
              circle
              :disabled="libraryStore.programCount === 0"
              @click="handleRandomPick"
            >
              <template #icon>
                <NIcon :component="ShuffleIcon" />
              </template>
            </NButton>
          </template>
          {{ t('header.randomPick') }}
        </NTooltip>

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

        <!-- Developer (circle) manager -->
        <NTooltip>
          <template #trigger>
            <NButton quaternary circle @click="showDeveloperManager = true">
              <template #icon>
                <NIcon :component="DeveloperIcon" />
              </template>
            </NButton>
          </template>
          {{ t('developer.manage') }}
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
    <DeveloperManagerDialog v-model:show="showDeveloperManager" />
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  background-color: #27272a;
  border-bottom: 1px solid #3f3f46;
  gap: 20px;
}

.light-theme .app-header {
  background-color: #ffffff;
  border-bottom-color: #e4e4e7;
}

/* Left cluster grows to fill free space, pushing .header-right to the edge.
   Its children (search-cluster + count) stay left-aligned so the count
   docks right next to the sort select instead of drifting to center. */
.header-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.search-cluster {
  flex: 1;
  max-width: 600px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.search-input-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
}

.search-input {
  flex: 1;
  min-width: 0;
}

.header-count {
  flex-shrink: 0;
  font-size: 0.8rem;
  color: #a1a1aa;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  padding-left: 12px;
  border-left: 1px solid #3f3f46;
}

.light-theme .header-count {
  color: #52525b;
  border-left-color: #e4e4e7;
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
