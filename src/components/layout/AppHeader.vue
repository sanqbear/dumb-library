<script setup lang="ts">
import { ref, computed, h, type Component } from 'vue'
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
  NDrawerContent
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
  PricetagsOutline as TagIcon,
  Close as CloseIcon
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

// How many programs carry each tag, keyed by tag id. Counting the whole library
// rather than the current result keeps the number stable while a filter is being
// built up, so it reads as "how big is this slice" instead of flickering with
// every click.
const tagCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const program of libraryStore.programs) {
    for (const id of program.tags) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
})

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

// Every filter currently narrowing the view, as one removable chip each.
// Previously the header only carried a count badge, so the answer to "why am I
// seeing 8 of 24?" lived behind opening the sidebar. Each chip names one reason
// and takes it back off.
type FilterChip = { key: string; icon: Component; label: string; clear: () => void }

const activeFilterChips = computed<FilterChip[]>(() => {
  const chips: FilterChip[] = []
  const provider = libraryStore.selectedCategory
  if (provider) {
    chips.push({
      key: `provider:${provider}`,
      icon: provider === 'steam' ? SteamIcon : DesktopIcon,
      label: t(PROVIDERS[provider].labelKey),
      clear: () => libraryStore.setSelectedCategory(null)
    })
  }
  const developerId = libraryStore.selectedDeveloper
  if (developerId) {
    chips.push({
      key: `developer:${developerId}`,
      icon: DeveloperIcon,
      label: resolveDeveloperName(developerId),
      clear: () => libraryStore.setSelectedDeveloper(null)
    })
  }
  for (const tag of libraryStore.selectedTags) {
    chips.push({
      key: `tag:${tag}`,
      icon: TagIcon,
      label: resolveTagName(tag),
      clear: () => toggleTag(tag)
    })
  }
  return chips
})

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
    <div class="header-bar">
    <div class="header-left">
      <!-- Opens the left sidebar Drawer holding all filters/sort/actions. -->
      <NTooltip>
        <template #trigger>
          <NButton quaternary circle @click="showDrawer = true">
            <template #icon>
              <NIcon :component="MenuIcon" />
            </template>
          </NButton>
        </template>
        {{ t('header.menu') }}
      </NTooltip>

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
    </div>

    <!-- What is narrowing the view right now, and how to undo each part of it.
         Only present while something is filtered, so the resting header stays
         a single quiet row. -->
    <div v-if="activeFilterChips.length > 0" class="filter-bar">
      <button
        v-for="chip in activeFilterChips"
        :key="chip.key"
        type="button"
        class="filter-chip"
        :aria-label="`${chip.label} — ${t('header.removeFilter')}`"
        @click="chip.clear()"
      >
        <NIcon :component="chip.icon" :size="12" class="filter-chip-icon" />
        <span class="filter-chip-label">{{ chip.label }}</span>
        <NIcon :component="CloseIcon" :size="13" class="filter-chip-x" />
      </button>
      <NButton text size="tiny" class="filter-clear" @click="handleClearFilters">
        {{ t('header.clearFilters') }}
      </NButton>
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
                <span class="tag-chip-count">{{ tagCounts.get(tag.id) ?? 0 }}</span>
              </button>
              <p v-if="filteredTags.length === 0" class="drawer-empty">
                {{ t('header.noMatchingTags') }}
              </p>
            </div>
          </template>
          <p v-else class="drawer-empty">{{ t('header.noTags') }}</p>
        </section>

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
          <NButton
            v-if="hasActiveFilters"
            secondary
            block
            @click="handleClearFilters"
          >
            {{ t('header.clearFilters') }}
          </NButton>
        </section>

        <!-- Presentation, kept apart from the filters: ordering and density
             change how the results are shown, not which results there are. -->
        <section class="drawer-section">
          <div class="drawer-section-title">{{ t('header.view') }}</div>
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
        </section>

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
/* No filled surface: the header sits on the same ink as the wall and is
   separated by a hairline, so the covers own every bit of colour on screen. */
.app-header {
  padding: 12px 20px;
  border-bottom: 1px solid var(--line);
}

.header-bar {
  display: flex;
  align-items: center;
  gap: 20px;
}

/* Left cluster grows to fill free space, pushing .header-right to the edge. */
.header-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

/* Card-size steps span the drawer width in equal thirds. */
.card-size-group {
  display: flex;
  width: 100%;
}

.card-size-group :deep(.n-button) {
  flex: 1;
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
  color: var(--text-2);
  white-space: nowrap;
}

/* ---- Active filters ---- */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}

/* Tinted rather than filled: these echo the drawer's selected tag chips without
   putting several solid plum blocks in a row. */
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 6px 3px 9px;
  border: none;
  border-radius: var(--r-pill);
  background-color: var(--plum-wash);
  color: var(--plum-soft);
  font: inherit;
  font-size: 0.78rem;
  line-height: 1.5;
  cursor: pointer;
  transition: background-color 0.14s ease, color 0.14s ease;
}

.filter-chip:hover {
  background-color: var(--plum);
  color: var(--on-plum);
}

.filter-chip:focus-visible {
  outline: 2px solid var(--plum);
  outline-offset: 1px;
}

.filter-chip-icon {
  flex-shrink: 0;
  opacity: 0.75;
}

.filter-chip-label {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-chip-x {
  flex-shrink: 0;
  opacity: 0.7;
}

.filter-chip:hover .filter-chip-x {
  opacity: 1;
}

.filter-clear {
  margin-left: 4px;
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

.drawer-section + .drawer-section {
  margin-top: 26px;
}

.drawer-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

/* Section label token: no uppercase, no tracking — see global.css. */
.drawer-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--label-size);
  font-weight: var(--label-weight);
  color: var(--plum-soft);
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
  max-height: 42vh;
  overflow-y: auto;
  padding: 2px 4px 2px 0;
}

/* Toggleable tag chip. Selected chips fill with the brand colour. */
.tag-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 5px 10px 5px 12px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text);
  font-size: 0.82rem;
  cursor: pointer;
  transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.tag-chip:hover {
  border-color: var(--plum);
  color: var(--plum-soft-hover);
}

.tag-chip.is-active {
  background-color: var(--plum);
  border-color: var(--plum);
  color: var(--on-plum);
}

/* Frequency, set quieter than the tag itself — it qualifies the name, it isn't
   part of it. */
.tag-chip-count {
  font-size: 0.72rem;
  color: var(--text-3);
}

.tag-chip:hover .tag-chip-count {
  color: inherit;
  opacity: 0.75;
}

.tag-chip.is-active .tag-chip-count {
  color: var(--on-plum);
  opacity: 0.7;
}

.drawer-empty {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-3);
}

.drawer-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drawer-field label {
  font-size: 0.8rem;
  color: var(--text-2);
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
