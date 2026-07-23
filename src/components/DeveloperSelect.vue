<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect, NInputGroup, NButton, NIcon, useMessage } from 'naive-ui'
import { PeopleOutline as ManageIcon } from '@vicons/ionicons5'
import { useLibraryStore } from '../stores/libraryStore'
import { useDeveloperName } from '../composables/useDeveloperName'
import type { LocalizedName } from '../types'
import DeveloperManagerDialog from './dialogs/DeveloperManagerDialog.vue'

// `placeholder` lets the publisher field reuse this component with its own
// wording; the option list and manager are the shared developer master list.
const props = defineProps<{ value: string | null; placeholder?: string }>()
const emit = defineEmits<{ (e: 'update:value', value: string | null): void }>()

const { t } = useI18n()
const libraryStore = useLibraryStore()
const message = useMessage()
const { resolveDeveloperName } = useDeveloperName()

// Sentinel value for the synthetic "create from typed text" option.
const CREATE_KEY = '__create_developer__'

const searchText = ref('')
const showManager = ref(false)

// `:ignore-composition="false"` on NSelect makes `@search` fire on every keystroke
// INCLUDING Hangul composition steps (live filtering), and keeps naive's internal
// pattern in sync with the composing text. That sync is what prevents the wipe:
// our recomputed `options` re-render the selection, and with a lagging pattern
// naive would re-apply its stale value to the inner <input>, erasing the in-flight
// glyph. See docs: input & IME handling guidelines.
const onSearch = (query: string) => { searchText.value = query }

const matchesQuery = (names: LocalizedName, q: string): boolean =>
  Object.values(names).some(n => !!n && n.toLowerCase().includes(q))

const hasExactName = (names: LocalizedName, q: string): boolean =>
  Object.values(names).some(n => !!n && n.toLowerCase() === q)

// We filter the option list ourselves (driven by the IME-live `searchText`) and
// tell NSelect not to re-filter, so narrowing stays in sync with composition.
const options = computed(() => {
  const raw = searchText.value.trim()
  const q = raw.toLowerCase()
  const all = libraryStore.developers

  const matched = (q ? all.filter(d => matchesQuery(d.names, q)) : all)
    .map(d => ({ label: resolveDeveloperName(d.id), value: d.id }))
    .sort((a, b) => a.label.localeCompare(b.label))

  // Keep the current selection resolvable even when filtered out, so the closed
  // input shows its name instead of the raw id.
  if (props.value && !matched.some(o => o.value === props.value)) {
    const name = resolveDeveloperName(props.value)
    if (name) matched.push({ label: name, value: props.value })
  }

  // Offer inline creation when the typed text names no existing developer.
  if (raw && !all.some(d => hasExactName(d.names, q))) {
    matched.unshift({ label: t('developer.createNamed', { name: raw }), value: CREATE_KEY })
  }
  return matched
})

const handleUpdate = async (val: string | null) => {
  if (val === CREATE_KEY) {
    const name = searchText.value.trim()
    if (!name) return
    const created = await libraryStore.addDeveloper({ names: { ko: name } })
    if (created) {
      message.success(t('developer.added'))
      emit('update:value', created.id)
    } else {
      message.error(t('developer.saveFailed'))
    }
    searchText.value = ''
    return
  }
  emit('update:value', val)
  searchText.value = ''
}
</script>

<template>
  <div class="dev-select">
    <NInputGroup>
      <NSelect
        :value="value"
        :options="options"
        :placeholder="placeholder ?? t('developer.selectPlaceholder')"
        :filter="() => true"
        :ignore-composition="false"
        filterable
        clearable
        @update:value="handleUpdate"
        @search="onSearch"
      />
      <NButton :title="t('developer.manage')" @click="showManager = true">
        <template #icon><NIcon :component="ManageIcon" /></template>
      </NButton>
    </NInputGroup>
  </div>

  <DeveloperManagerDialog v-model:show="showManager" />
</template>

<style scoped>
.dev-select {
  display: flex;
  /* Fill the form item whether mounted bare or inside a width-100% stack, so
     the developer and publisher fields always render at the same width. */
  width: 100%;
}

.dev-select :deep(.n-input-group) {
  flex: 1;
  min-width: 0;
}
</style>
