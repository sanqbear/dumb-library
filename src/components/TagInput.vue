<script setup lang="ts">
import { NDynamicTags } from 'naive-ui'

const props = defineProps<{
  value: string[]
}>()

const emit = defineEmits<{
  'update:value': [value: string[]]
}>()

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

function handleUpdate(values: string[]) {
  emit('update:value', splitTags(values))
}
</script>

<template>
  <NDynamicTags :value="props.value" @update:value="handleUpdate" />
</template>
