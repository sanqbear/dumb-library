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
  NDropdown,
  NDrawer,
  NDrawerContent,
  NDivider
} from 'naive-ui'
import {
  Search as SearchIcon,
  Grid as GridIcon,
  List as ListIcon,
  Add as AddIcon,
  Moon as MoonIcon,
  Sunny as SunnyIcon,
  MenuOutline as MenuIcon,
  SwapVerticalOutline as SortIcon,
  DesktopOutline as DesktopIcon,
  LogoSteam as SteamIcon,
  LanguageOutline as LanguageIcon,
  ShuffleOutline as ShuffleIcon,
  PeopleOutline as DeveloperIcon,
  PricetagsOutline as TagIcon
} from '@vicons/ionicons5'
import { useMessage } from 'naive-ui'
import { useLibraryStore } from '../../stores/libraryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import AddProgramDialog from '../dialogs/AddProgramDialog.vue'
import AddSteamProgramDialog from '../dialogs/AddSteamProgramDialog.vue'
import DeveloperManagerDialog from '../dialogs/DeveloperManagerDialog.vue'
import TagManagerDialog from '../dialogs/TagManagerDialog.vue'
import { PROVIDERS, PROVIDER_IDS, type ProviderId, type GridCardSize } from '../../types'
import { SUPPORTED_LOCALES, LOCALE_META, type LocaleCode } from '../../i18n'
import { useDeveloperName } from '../../composables/useDeveloperName'
import { useTagName, tagSearchBlob } from '../../composables/useTagName'

const { t } = useI18n()
const libraryStore = useLibraryStore()
const settingsStore = useSettingsStore()
const message = useMessage()
const { resolveDeveloperName } = useDeveloperName()
const { resolveTagName } = useTagName()

const showAddDialog = ref(false)
const showAddSteamDialog = ref(false)
const showDeveloperManager = ref(false)
const showTagManager = ref(false)
// Left overlay sidebar holding filters, tags, sort and utility actions.
const showDrawer = ref(false)

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

// Grid card density — three fixed steps persisted in settings.
const CARD_SIZES: GridCardSize[] = ['small', 'medium', 'large']
const cardSizeLabel = (size: GridCardSize) => t(`header.cardSize_${size}`)

const hasActiveFilters = computed(() =>
  libraryStore.selectedCategory !== null ||
  libraryStore.selectedDeveloper !== null ||
  libraryStore.selectedTags.length > 0
)

// Badge on the menu button: how many filter facets are currently narrowing the
// list (each active tag counts once). 0 hides the badge.
const activeFilterCount = computed(() =>
  (libraryStore.selectedCategory !== null ? 1 : 0) +
  (libraryStore.selectedDeveloper !== null ? 1 : 0) +
  libraryStore.selectedTags.length
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

// Tag search — filters the chip cloud when the library has many tags.
//
// `tagQuery` is bound to the field AND updated from the native `input` event on
// every keystroke, including IME composition steps. This is deliberate: filtering
// the tag cloud re-renders this section, and naive's NInput re-applies its
// `mergedValue` to the DOM on re-render. If the bound value lagged behind the
// composing text (as a composition-gated committed ref would), that re-apply
// would wipe the in-flight Hangul from the field. Keeping the bound value equal
// to what's displayed makes the re-apply a no-op (Vue skips writing when the DOM
// value already matches), so composition survives. See IME input guideline.
const tagQuery = ref('')

const handleTagSearchInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  if (target) tagQuery.value = target.value
}
// Clear button / composition-end commit path.
const handleTagSearch = (value: string) => {
  tagQuery.value = value
}

// Chip cloud of the tag master list, filtered by the search across every
// language + keyword (tagSearchBlob), so a tag is findable regardless of the
// active UI language.
const filteredTags = computed(() => {
  const q = tagQuery.value.trim().toLowerCase()
  if (!q) return libraryStore.allTags
  return libraryStore.allTags.filter(tag => tagSearchBlob(tag).includes(q))
})

// Tags are toggled individually from the prominent chip cloud rather than a
// multi-select, so picking/removing a tag (by id) is a single click.
const isTagSelected = (id: string) => libraryStore.selectedTags.includes(id)

const toggleTag = (id: string) => {
  const current = libraryStore.selectedTags
  if (current.includes(id)) {
    libraryStore.setSelectedTags(current.filter(x => x !== id))
  } else {
    libraryStore.setSelectedTags([...current, id])
  }
}

const clearTags = () => libraryStore.setSelectedTags([])

const handleClearFilters = () => {
  libraryStore.clearFilters()
}

const handleRandomPick = () => {
  const picked = libraryStore.pickRandom()
  if (!picked) {
    message.info(t('header.randomEmpty'))
    return
  }
  // Close the sidebar so the highlighted pick is visible in the list.
  showDrawer.value = false
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <!-- Opens the left sidebar Drawer holding all filters/sort/actions.
           Turns primary + shows a badge while any filter is active. -->
      <div class="menu-btn-wrap">
        <NTooltip>
          <template #trigger>
            <NButton
              quaternary
              circle
              :type="hasActiveFilters ? 'primary' : 'default'"
              @click="showDrawer = true"
            >
              <template #icon>
                <NIcon :component="MenuIcon" />
              </template>
            </NButton>
          </template>
          {{ t('header.menu') }}
        </NTooltip>
        <span v-if="activeFilterCount > 0" class="menu-badge">{{ activeFilterCount }}</span>
      </div>

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

      <div class="header-count" aria-live="polite">
        {{ isCountFiltered
          ? t('header.filteredCountFormat', { filtered: libraryStore.filteredCount, total: libraryStore.programCount })
          : t('header.countFormat', { count: libraryStore.programCount }) }}
      </div>
    </div>

    <div class="header-right">
      <NSpace>
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

    <!-- Left overlay sidebar: scoped to .app-body so it covers the header +
         content as an absolute layer without pushing them or hiding the OS
         window controls. -->
    <NDrawer
      v-model:show="showDrawer"
      :width="340"
      placement="left"
      to=".app-body"
      :trap-focus="false"
    >
      <NDrawerContent :title="t('header.menuTitle')" closable :native-scrollbar="false">
        <!-- Tags — front and centre: a searchable, self-scrolling chip cloud,
             kept separate from the other filters so the tag-centric library is
             quick to slice. The cloud scrolls on its own so a long tag list
             never pushes the rest of the drawer out of view. -->
        <section class="drawer-section drawer-section-tags">
          <div class="drawer-section-head">
            <span class="drawer-section-title">
              <NIcon :component="TagIcon" :size="15" class="section-icon" />
              {{ t('header.tags') }}
            </span>
            <NButton
              v-if="libraryStore.selectedTags.length > 0"
              text
              size="tiny"
              @click="clearTags"
            >
              {{ t('header.clearTags') }}
            </NButton>
          </div>
          <template v-if="libraryStore.allTags.length > 0">
            <!-- IME-aware live read via native @input on the wrapper. -->
            <div class="tag-search-wrap" @input="handleTagSearchInput">
              <NInput
                :value="tagQuery"
                :placeholder="t('header.tagSearchPlaceholder')"
                size="small"
                clearable
                @update:value="handleTagSearch"
              >
                <template #prefix>
                  <NIcon :component="SearchIcon" />
                </template>
              </NInput>
            </div>
            <div class="tag-cloud">
              <button
                v-for="tag in filteredTags"
                :key="tag.id"
                type="button"
                class="tag-chip"
                :class="{ 'is-active': isTagSelected(tag.id) }"
                @click="toggleTag(tag.id)"
              >
                {{ resolveTagName(tag.id) }}
              </button>
              <p v-if="filteredTags.length === 0" class="drawer-empty">
                {{ t('header.noMatchingTags') }}
              </p>
            </div>
          </template>
          <p v-else class="drawer-empty">{{ t('header.noTags') }}</p>
        </section>

        <NDivider />

        <!-- Other filters -->
        <section class="drawer-section">
          <div class="drawer-section-title">{{ t('header.filters') }}</div>
          <div class="drawer-field">
            <label>{{ t('header.provider') }}</label>
            <NSelect
              :value="libraryStore.selectedCategory"
              :options="categoryOptions"
              :placeholder="t('header.allProviders')"
              clearable
              @update:value="handleCategoryChange"
            />
          </div>
          <div class="drawer-field" v-if="developerOptions.length > 0">
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
          <div class="drawer-field">
            <label>{{ t('header.sort') }}</label>
            <NSelect
              :value="currentSort"
              :options="sortOptions"
              @update:value="handleSortChange"
            >
              <template #arrow>
                <NIcon :component="SortIcon" />
              </template>
            </NSelect>
          </div>
          <!-- Grid card density — only meaningful in grid mode. -->
          <div class="drawer-field" v-if="settingsStore.viewMode === 'grid'">
            <label>{{ t('header.cardSize') }}</label>
            <NButtonGroup class="card-size-group">
              <NButton
                v-for="size in CARD_SIZES"
                :key="size"
                :type="settingsStore.gridCardSize === size ? 'primary' : 'default'"
                secondary
                @click="settingsStore.setGridCardSize(size)"
              >
                {{ cardSizeLabel(size) }}
              </NButton>
            </NButtonGroup>
          </div>
          <NButton
            v-if="hasActiveFilters"
            secondary
            block
            @click="handleClearFilters"
          >
            {{ t('header.clearFilters') }}
          </NButton>
        </section>

        <NDivider />

        <!-- Utility actions moved out of the header -->
        <section class="drawer-section">
          <div class="drawer-section-title">{{ t('header.actions') }}</div>
          <div class="drawer-action-list">
            <NButton block @click="showTagManager = true">
              <template #icon><NIcon :component="TagIcon" /></template>
              {{ t('header.manageTags') }}
            </NButton>
            <NButton block @click="showDeveloperManager = true">
              <template #icon><NIcon :component="DeveloperIcon" /></template>
              {{ t('developer.manage') }}
            </NButton>
            <NDropdown
              trigger="click"
              :options="languageMenuOptions"
              @select="handleLanguageSelect"
            >
              <NButton block>
                <template #icon><NIcon :component="LanguageIcon" /></template>
                {{ t('header.language') }}
              </NButton>
            </NDropdown>
          </div>
        </section>
      </NDrawerContent>
    </NDrawer>

    <!-- Add Program Dialogs -->
    <AddProgramDialog v-model:show="showAddDialog" />
    <AddSteamProgramDialog v-model:show="showAddSteamDialog" />
    <DeveloperManagerDialog v-model:show="showDeveloperManager" />
    <TagManagerDialog v-model:show="showTagManager" />
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

/* Left cluster grows to fill free space, pushing .header-right to the edge. */
.header-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.menu-btn-wrap {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
}

/* Card-size steps span the drawer width in equal thirds. */
.card-size-group {
  display: flex;
  width: 100%;
}

.card-size-group :deep(.n-button) {
  flex: 1;
}

/* Small count badge over the menu button's top-right corner. */
.menu-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.66rem;
  font-weight: 600;
  line-height: 1;
  color: #ffffff;
  background-color: #ab4aba;
  border-radius: 999px;
  pointer-events: none;
}

.search-input-wrap {
  flex: 1;
  max-width: 560px;
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

/* ---- Drawer ---- */
.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.drawer-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.drawer-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #a1a1aa;
}

.light-theme .drawer-section-title {
  color: #71717a;
}

.section-icon {
  opacity: 0.9;
}

.tag-search-wrap {
  display: flex;
}

/* The chip cloud scrolls within its own bounded box so a large tag list keeps
   the search input, other filters, and actions reachable without scrolling the
   whole drawer. */
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
  padding: 2px 4px 2px 0;
}

/* Toggleable tag chip. Selected chips fill with the brand colour. */
.tag-chip {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid #3f3f46;
  background-color: transparent;
  color: #d4d4d8;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.tag-chip:hover {
  border-color: #ab4aba;
  color: #e8c4ee;
}

.tag-chip.is-active {
  background-color: #ab4aba;
  border-color: #ab4aba;
  color: #ffffff;
}

.light-theme .tag-chip {
  border-color: #e4e4e7;
  color: #3f3f46;
}

.light-theme .tag-chip:hover {
  border-color: #ab4aba;
  color: #953ea3;
}

.light-theme .tag-chip.is-active {
  color: #ffffff;
}

.drawer-empty {
  margin: 0;
  font-size: 0.85rem;
  color: #71717a;
}

.drawer-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drawer-field label {
  font-size: 0.8rem;
  color: #a1a1aa;
}

.light-theme .drawer-field label {
  color: #71717a;
}

.drawer-action-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer-action-list :deep(.n-button) {
  justify-content: flex-start;
}
</style>
