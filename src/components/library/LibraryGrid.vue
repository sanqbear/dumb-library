<script setup lang="ts">
import { useLibraryStore } from '../../stores/libraryStore'
import ProgramCard from './ProgramCard.vue'

const libraryStore = useLibraryStore()
</script>

<template>
  <div class="library-grid">
    <ProgramCard
      v-for="program in libraryStore.filteredPrograms"
      :key="program.id"
      :program="program"
    />
  </div>
</template>

<style scoped>
.library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  padding: 4px;
}
</style>
