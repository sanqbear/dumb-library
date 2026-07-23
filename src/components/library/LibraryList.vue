<script setup lang="ts">
import { h, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NDataTable, NButton, NIcon, NSpace, NPopover, NTag, useMessage, useDialog } from 'naive-ui'
import { Play as PlayIcon, Create as EditIcon, Trash as DeleteIcon } from '@vicons/ionicons5'
import type { DataTableColumns } from 'naive-ui'
import { useLibraryStore } from '../../stores/libraryStore'
import type { Program } from '../../types'
import { PROVIDERS, libImageUrl } from '../../types'
import { useDeveloperName } from '../../composables/useDeveloperName'
import { useTagName } from '../../composables/useTagName'

const { t } = useI18n()
const router = useRouter()
const libraryStore = useLibraryStore()
const { resolveDeveloperName } = useDeveloperName()
const { resolveTagName } = useTagName()
const message = useMessage()
const dialog = useDialog()

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
  router.push({ name: 'edit', params: { id: program.id } })
}

const handleRowClick = (program: Program) => {
  router.push({ name: 'detail', params: { id: program.id } })
}

// Cast through unknown — naive-ui's CreateRowProps narrows to HTMLAttributes,
// which (depending on @vue/runtime-dom version) doesn't always include the
// data-* index signature. The attribute lands on the <tr> regardless.
const rowProps = (row: Program) =>
  ({
    'data-program-id': row.id,
    style: 'cursor: pointer;',
    onClick: () => handleRowClick(row)
  } as unknown as Record<string, string>)

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
      if (!src) {
        return h('div', {
          style: {
            width: '32px',
            height: '32px',
            backgroundColor: '#3f3f46',
            borderRadius: '4px'
          }
        })
      }
      // Plain <img> (no NImage lightbox) so a click only navigates the row; the
      // large preview is shown on hover instead, avoiding the two overlapping
      // actions (navigate + zoom) firing together.
      const thumb = h('img', {
        src,
        style: 'width: 32px; height: 32px; object-fit: cover; border-radius: 4px; display: block;'
      })
      return h(NPopover, { trigger: 'hover', placement: 'right', delay: 120 }, {
        trigger: () => thumb,
        default: () => h('img', {
          src,
          style: 'display: block; max-width: 300px; max-height: 300px; object-fit: contain; border-radius: 6px;'
        })
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
    title: t('listView.columnDeveloper'),
    key: 'developer',
    width: 160,
    ellipsis: { tooltip: true },
    render(row) {
      return resolveDeveloperName(row.developerId) || '-'
    }
  },
  {
    title: t('listView.columnTags'),
    key: 'tags',
    width: 200,
    render(row) {
      const tags = row.tags
      if (tags.length === 0) return '-'
      const shown = tags.slice(0, 3)
      const extra = tags.length - shown.length
      // Single-line row: nowrap + clip so long/many tags never grow the row.
      const nodes = shown.map(tag =>
        h(NTag, { size: 'small', style: 'flex: 0 0 auto;' }, { default: () => resolveTagName(tag) })
      )
      if (extra > 0) {
        nodes.push(
          h(NTag, { size: 'small', bordered: false, style: 'flex: 0 0 auto;' }, { default: () => `+${extra}` })
        )
      }
      return h('div', { style: 'display: flex; gap: 4px; overflow: hidden;' }, nodes)
    }
  },
  {
    title: t('listView.columnActions'),
    key: 'actions',
    width: 180,
    fixed: 'right',
    render(row) {
      // stop propagation so action clicks don't also trigger row navigation
      const stop = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn() }
      return h(NSpace, { size: 'small', wrap: false, align: 'center' }, {
        default: () => [
          h(NButton, {
            type: 'primary',
            quaternary: true,
            circle: true,
            onClick: stop(() => handleLaunch(row))
          }, {
            icon: () => h(NIcon, { component: PlayIcon })
          }),
          h(NButton, {
            quaternary: true,
            circle: true,
            onClick: stop(() => handleEdit(row))
          }, {
            icon: () => h(NIcon, { component: EditIcon })
          }),
          h(NButton, {
            type: 'error',
            quaternary: true,
            circle: true,
            onClick: stop(() => handleDelete(row))
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
      class="list-table"
      :columns="columns"
      :data="libraryStore.filteredPrograms"
      :row-key="(row: Program) => row.id"
      :row-props="rowProps"
      :row-class-name="(row: Program) => libraryStore.highlightedProgramId === row.id ? 'is-highlighted' : ''"
      :bordered="false"
      striped
      flex-height
      virtual-scroll
      :min-row-height="48"
    />
  </div>
</template>

<style scoped>
.library-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Fill the column and let NDataTable's flex-height drive the body scroll, so the
   table is the only scroller (no nested/duplicate outer scrollbar). */
.list-table {
  flex: 1;
  min-height: 0;
}

/* Full-bleed table — square corners so it reads as a list, not a floating card. */
.list-table :deep(.n-data-table-wrapper),
.list-table :deep(.n-data-table) {
  border-radius: 0;
}

/* Background tint on highlighted row cells — no border/padding change,
   so the table layout stays identical when the highlight toggles. */
.library-list :deep(tr.is-highlighted td) {
  background-color: rgba(171, 74, 186, 0.18) !important;
  transition: background-color 0.25s ease;
}

.light-theme .library-list :deep(tr.is-highlighted td) {
  background-color: rgba(171, 74, 186, 0.14) !important;
}
</style>
