<script setup lang="ts">
import { NEmpty, NButton, NIcon } from 'naive-ui'
import { Add as AddIcon, SearchOutline as SearchIcon } from '@vicons/ionicons5'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '../../stores/libraryStore'

defineProps<{
  isFiltered: boolean
}>()

const { t } = useI18n()
const libraryStore = useLibraryStore()

const handleClearFilters = () => {
  libraryStore.clearFilters()
}
</script>

<template>
  <div class="empty-state">
    <NEmpty
      :description="isFiltered ? t('library.emptyFilteredTitle') : t('library.emptyTitle')"
      size="large"
    >
      <template #icon>
        <NIcon :component="isFiltered ? SearchIcon : AddIcon" :size="64" />
      </template>
      <template #extra>
        <p class="empty-hint" v-if="!isFiltered">
          {{ t('library.emptyAction') }}
        </p>
        <NButton v-else @click="handleClearFilters">
          {{ t('header.clearFilters') }}
        </NButton>
      </template>
    </NEmpty>
  </div>
</template>

<style scoped>
.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-hint {
  color: #71717a;
  margin-top: 8px;
}
</style>
