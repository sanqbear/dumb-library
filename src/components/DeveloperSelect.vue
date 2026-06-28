<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect, NInputGroup, NButton, NIcon, useMessage } from 'naive-ui'
import { PeopleOutline as ManageIcon } from '@vicons/ionicons5'
import { useLibraryStore } from '../stores/libraryStore'
import { useDeveloperName } from '../composables/useDeveloperName'
import type { LocalizedName } from '../types'
import DeveloperManagerDialog from './dialogs/DeveloperManagerDialog.vue'

const props = defineProps<{ value: string | null }>()
const emit = defineEmits<{ (e: 'update:value', value: string | null): void }>()

const { t } = useI18n()
const libraryStore = useLibraryStore()
const message = useMessage()
const { resolveDeveloperName } = useDeveloperName()

// Sentinel value for the synthetic "create from typed text" option.
const CREATE_KEY = '__create_developer__'

const searchText = ref('')
const showManager = ref(false)

// Live, IME-aware read of NSelect's inner <input>. The native `input` event
// fires on every keystroke — including Hangul composition steps — so the option
// list and the "create" affordance react per visible character rather than per
// finished syllable. NSelect's own `@search` is composition-gated (it only
// commits on composition end), which is the same IME lag the search box avoids.
// We only read the value here; we never write it back (that would break the IME).
const handleNativeInput = (event: Event) => {
  const target = event.target as HTMLElement | null
  if (target && target.tagName === 'INPUT') {
    searchText.value = (target as HTMLInputElement).value
  }
}

// NSelect commits the pattern on composition end / clear / selection — mirror it
// so the live text resets correctly when the field is cleared or an item chosen.
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
  <!-- @input on the wrapper captures the inner <input>'s native event (it
       bubbles), giving an IME-aware live read while the group styling between
       the select and button stays intact. -->
  <div class="dev-select" @input="handleNativeInput">
    <NInputGroup>
      <NSelect
        :value="value"
        :options="options"
        :placeholder="t('developer.selectPlaceholder')"
        :filter="() => true"
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
}

.dev-select :deep(.n-input-group) {
  flex: 1;
  min-width: 0;
}
</style>
