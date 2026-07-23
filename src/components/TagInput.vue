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

// Live, IME-aware read of NSelect's inner <input>. The native `input` event
// fires on every keystroke — including Hangul composition steps — so the
// suggestion list and the "add" affordance react per visible character rather
// than per finished syllable. NSelect's own `@search` is composition-gated
// (it commits only on composition end), which is the IME lag we want to avoid.
// Mirrors DeveloperSelect. We only read here; never write back (that breaks the
// IME). See docs: input & IME handling guidelines.
const searchText = ref('')

const handleNativeInput = (event: Event) => {
  const target = event.target as HTMLElement | null
  if (target && target.tagName === 'INPUT') {
    searchText.value = (target as HTMLInputElement).value
  }
}

// NSelect commits the pattern on composition end / clear / selection — mirror it
// so the live text resets correctly when the field is cleared or an item chosen.
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
  <!-- @input on the wrapper captures the inner <input>'s native event (it
       bubbles), giving an IME-aware live read. -->
  <div class="tag-input" @input="handleNativeInput">
    <NSelect
      multiple
      filterable
      :value="props.value"
      :options="options"
      :placeholder="props.placeholder"
      :filter="() => true"
      :show-arrow="false"
      @update:value="handleUpdate"
      @search="onSearch"
    />
  </div>
</template>

<style scoped>
/* Fill the container. NFormItem lays its content out as a flex row, so without
   an explicit width this wrapper shrinks to fit its chips — and with no tags at
   all it collapsed to barely wider than the caret, taking the suggestion menu
   (which naive-ui sizes to the trigger) down with it. */
.tag-input {
  width: 100%;
  min-width: 0;
}
</style>
