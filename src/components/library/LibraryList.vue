<script setup lang="ts">
import { h, ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NDataTable, NButton, NIcon, NSpace, NImage, NTag, useMessage, useDialog } from 'naive-ui'
import { Play as PlayIcon, Create as EditIcon, Trash as DeleteIcon } from '@vicons/ionicons5'
import type { DataTableColumns } from 'naive-ui'
import { useLibraryStore } from '../../stores/libraryStore'
import type { Program } from '../../types'
import { PROVIDERS, libImageUrl } from '../../types'
import EditProgramDialog from '../dialogs/EditProgramDialog.vue'

const { t } = useI18n()
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
  if (program.thumbnailPath) return libImageUrl(program.thumbnailPath, program.updatedAt)
  if (program.iconPath) return libImageUrl(program.iconPath, program.updatedAt)
  return ''
}

const handleLaunch = async (program: Program) => {
  try {
    await libraryStore.launchProgram(program)
    message.success(t('card.launchSuccess', { title: program.title }))
  } catch (error) {
    message.error(t('card.launchFailed'))
  }
}

const handleEdit = (program: Program) => {
  editingProgram.value = program
  showEditDialog.value = true
}

const handleDelete = (program: Program) => {
  dialog.warning({
    title: t('editDialog.deleteConfirmTitle'),
    content: t('editDialog.deleteConfirmMessage', { title: program.title }),
    positiveText: t('common.delete'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const success = await libraryStore.deleteProgram(program.id)
      if (success) {
        message.success(t('editDialog.deleted'))
      } else {
        message.error(t('editDialog.deleteFailed'))
      }
    }
  })
}

// Columns are computed so naive-ui regenerates them when the locale changes.
const columns = computed<DataTableColumns<Program>>(() => [
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
    title: t('listView.columnTitle'),
    key: 'title',
    ellipsis: { tooltip: true }
  },
  {
    title: t('listView.columnProvider'),
    key: 'category',
    width: 140,
    render(row) {
      return h(NTag, { size: 'small', type: 'info' }, { default: () => t(PROVIDERS[row.category].labelKey) })
    }
  },
  {
    title: t('listView.columnTags'),
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
    title: t('listView.columnActions'),
    key: 'actions',
    width: 180,
    fixed: 'right',
    render(row) {
      return h(NSpace, { size: 'small', wrap: false, align: 'center' }, {
        default: () => [
          h(NButton, {
            type: 'primary',
            quaternary: true,
            circle: true,
            onClick: () => handleLaunch(row)
          }, {
            icon: () => h(NIcon, { component: PlayIcon })
          }),
          h(NButton, {
            quaternary: true,
            circle: true,
            onClick: () => handleEdit(row)
          }, {
            icon: () => h(NIcon, { component: EditIcon })
          }),
          h(NButton, {
            type: 'error',
            quaternary: true,
            circle: true,
            onClick: () => handleDelete(row)
          }, {
            icon: () => h(NIcon, { component: DeleteIcon })
          })
        ]
      })
    }
  }
])
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
