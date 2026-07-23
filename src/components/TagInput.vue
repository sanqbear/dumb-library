<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect } from 'naive-ui'
import type { SelectOption } from 'naive-ui'

const props = defineProps<{
  value: string[]
  // Existing values across the library, offered as a filterable dropdown so the
  // user can reference tags that already exist instead of retyping them.
  suggestions?: string[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:value': [value: string[]]
}>()

const { t } = useI18n()

// Sentinel for the synthetic "create the typed text as a new tag" option.
const CREATE_KEY = '__create_tag__'

// Live search text driving the suggestion list and the "add" affordance.
//
// We set `:ignore-composition="false"` on NSelect so its `@search` fires on every
// keystroke INCLUDING Hangul composition steps (live filtering), AND — crucially —
// so naive keeps its internal pattern in sync with the composing text. If the
// pattern lagged (the default `ignoreComposition: true`), our recomputed `options`
// would re-render the selection and naive would re-apply its stale/empty pattern
// to the inner <input>, wiping the in-flight glyph (only one char survived, prior
// ones erased). Keeping the pattern live makes that re-apply a no-op. See docs:
// input & IME handling guidelines.
const searchText = ref('')

const onSearch = (query: string) => {
  searchText.value = query
}

// Split tags by comma or semicolon so multiple tags can be entered at once.
function splitTags(values: string[]): string[] {
  const result: string[] = []
  for (const raw of values) {
    const parts = raw
      .split(/[,;，；]/)
      .map((s) => s.trim())
      .filter(Boolean)
    for (const part of parts) {
      if (!result.includes(part)) {
        result.push(part)
      }
    }
  }
  return result
}

// We filter the suggestion list ourselves (driven by the IME-live `searchText`)
// and tell NSelect not to re-filter, so narrowing stays in sync with composition.
// Selected chips don't need to appear here: NSelect's default `fallbackOption`
// renders any selected value (== the tag text) as its own label.
const options = computed<SelectOption[]>(() => {
  const raw = searchText.value.trim()
  const q = raw.toLowerCase()
  const selected = new Set(props.value)

  const matched = (props.suggestions ?? [])
    .filter((tag) => !selected.has(tag))
    .filter((tag) => !q || tag.toLowerCase().includes(q))
    .sort((a, b) => a.localeCompare(b))
    .map<SelectOption>((tag) => ({ label: tag, value: tag }))

  // Offer inline creation when the typed text isn't already an existing option
  // and isn't already selected. Placed first so Enter picks it by default.
  const isExisting = (props.suggestions ?? []).some((s) => s.toLowerCase() === q)
  if (raw && !isExisting && !selected.has(raw)) {
    matched.unshift({ label: t('addDialog.tagAddLabel', { name: raw }), value: CREATE_KEY })
  }
  return matched
})

function handleUpdate(values: string[]) {
  // Selecting the synthetic "create" option yields the sentinel in place of the
  // typed text — swap it back for the live search text before splitting, so
  // ";"/","-separated entries still expand into multiple tags.
  if (values.includes(CREATE_KEY)) {
    const typed = searchText.value
    const rest = values.filter((v) => v !== CREATE_KEY)
    emit('update:value', splitTags([...rest, typed]))
  } else {
    emit('update:value', splitTags(values))
  }
  searchText.value = ''
}
</script>

<template>
  <div class="tag-input">
    <NSelect
      multiple
      filterable
      :value="props.value"
      :options="options"
      :placeholder="props.placeholder"
      :filter="() => true"
      :ignore-composition="false"
      :show-arrow="false"
      @update:value="handleUpdate"
      @search="onSearch"
    />
  </div>
</template>

<style scoped>
/* Fill the field width so an empty tag input stays readable instead of
   collapsing to the (near-zero) width of its placeholder/content. */
.tag-input {
  width: 100%;
}

.tag-input :deep(.n-select) {
  width: 100%;
  min-width: 180px;
}
</style>
