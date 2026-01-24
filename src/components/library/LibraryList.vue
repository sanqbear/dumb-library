<script setup lang="ts">
import { h, ref, onMounted, onUnmounted } from 'vue'
import { NDataTable, NButton, NIcon, NSpace, NImage, NTag, useMessage, useDialog } from 'naive-ui'
import { Play as PlayIcon, Create as EditIcon, Trash as DeleteIcon } from '@vicons/ionicons5'
import type { DataTableColumns } from 'naive-ui'
import { useLibraryStore } from '../../stores/libraryStore'
import type { Program } from '../../types'
import EditProgramDialog from '../dialogs/EditProgramDialog.vue'

const libraryStore = useLibraryStore()
const message = useMessage()
const dialog = useDialog()

const showEditDialog = ref(false)
const editingProgram = ref<Program | null>(null)
const tableMaxHeight = ref(500)

const updateTableHeight = () => {
  // Calculate available height (viewport - header - padding)
  tableMaxHeight.value = window.innerHeight - 120
}

onMounted(() => {
  updateTableHeight()
  window.addEventListener('resize', updateTableHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateTableHeight)
})

const getDisplayImage = (program: Program): string => {
  if (program.thumbnailPath) return `file://${program.thumbnailPath}`
  if (program.iconPath) return `file://${program.iconPath}`
  return ''
}

const handleLaunch = async (program: Program) => {
  try {
    await libraryStore.launchProgram(program)
    message.success(`Launching ${program.title}`)
  } catch (error) {
    message.error('Failed to launch program')
  }
}

const handleEdit = (program: Program) => {
  editingProgram.value = program
  showEditDialog.value = true
}

const handleDelete = (program: Program) => {
  dialog.warning({
    title: 'Delete Program',
    content: `Are you sure you want to delete "${program.title}"?`,
    positiveText: 'Delete',
    negativeText: 'Cancel',
    onPositiveClick: async () => {
      const success = await libraryStore.deleteProgram(program.id)
      if (success) {
        message.success('Program deleted')
      } else {
        message.error('Failed to delete program')
      }
    }
  })
}

const columns: DataTableColumns<Program> = [
  {
    title: '',
    key: 'image',
    width: 50,
    render(row) {
      const src = getDisplayImage(row)
      if (src) {
        return h(NImage, {
          src,
          width: 32,
          height: 32,
          objectFit: 'cover',
          style: { borderRadius: '4px' },
          fallbackSrc: undefined
        })
      }
      return h('div', {
        style: {
          width: '32px',
          height: '32px',
          backgroundColor: '#3f3f46',
          borderRadius: '4px'
        }
      })
    }
  },
  {
    title: 'Title',
    key: 'title',
    ellipsis: {
      tooltip: true
    }
  },
  {
    title: 'Category',
    key: 'category',
    width: 120,
    render(row) {
      return row.category 
        ? h(NTag, { size: 'small', type: 'info' }, { default: () => row.category })
        : '-'
    }
  },
  {
    title: 'Tags',
    key: 'tags',
    width: 200,
    render(row) {
      if (row.tags.length === 0) return '-'
      return h(NSpace, { size: 'small' }, {
        default: () => row.tags.slice(0, 3).map(tag => 
          h(NTag, { size: 'small' }, { default: () => tag })
        )
      })
    }
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 150,
    fixed: 'right',
    render(row) {
      return h(NSpace, { size: 'small' }, {
        default: () => [
          h(NButton, {
            size: 'small',
            type: 'primary',
            quaternary: true,
            onClick: () => handleLaunch(row)
          }, {
            icon: () => h(NIcon, { component: PlayIcon })
          }),
          h(NButton, {
            size: 'small',
            quaternary: true,
            onClick: () => handleEdit(row)
          }, {
            icon: () => h(NIcon, { component: EditIcon })
          }),
          h(NButton, {
            size: 'small',
            type: 'error',
            quaternary: true,
            onClick: () => handleDelete(row)
          }, {
            icon: () => h(NIcon, { component: DeleteIcon })
          })
        ]
      })
    }
  }
]
</script>

<template>
  <div class="library-list">
    <NDataTable
      :columns="columns"
      :data="libraryStore.filteredPrograms"
      :row-key="(row: Program) => row.id"
      :bordered="false"
      striped
      :max-height="tableMaxHeight"
    />

    <EditProgramDialog 
      v-model:show="showEditDialog"
      :program="editingProgram"
    />
  </div>
</template>

<style scoped>
.library-list {
  height: 100%;
  overflow: hidden;
}
</style>
