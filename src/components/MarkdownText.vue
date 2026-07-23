<script setup lang="ts">
import { computed, h, type FunctionalComponent, type VNodeChild } from 'vue'
import { parseMarkdown, type BlockNode, type InlineNode } from '../utils/markdown'

const props = defineProps<{ source: string }>()

// Links are never navigated in-place: the host decides what to do with them
// (this app hands http(s) URLs to the system browser).
const emit = defineEmits<{ link: [href: string] }>()

const blocks = computed(() => parseMarkdown(props.source))

const renderInline = (nodes: InlineNode[]): VNodeChild[] =>
  nodes.map((node): VNodeChild => {
    switch (node.type) {
      case 'text':
        return node.value
      case 'break':
        return h('br')
      case 'code':
        return h('code', node.value)
      case 'strong':
        return h('strong', renderInline(node.children))
      case 'em':
        return h('em', renderInline(node.children))
      case 'del':
        return h('del', renderInline(node.children))
      case 'link':
        return h(
          'a',
          {
            href: node.href,
            onClick: (e: MouseEvent) => {
              e.preventDefault()
              emit('link', node.href)
            }
          },
          renderInline(node.children)
        )
    }
  })

const renderBlocks = (nodes: BlockNode[]): VNodeChild[] =>
  nodes.map((node): VNodeChild => {
    switch (node.type) {
      case 'paragraph':
        return h('p', renderInline(node.children))
      case 'heading':
        return h(`h${node.level}`, renderInline(node.children))
      case 'codeBlock':
        return h('pre', h('code', node.value))
      case 'blockquote':
        return h('blockquote', renderBlocks(node.children))
      case 'thematicBreak':
        return h('hr')
      case 'list':
        return h(
          node.ordered ? 'ol' : 'ul',
          { start: node.ordered && node.start !== 1 ? node.start : undefined },
          node.items.map(renderItem)
        )
    }
  })

const renderItem = (item: BlockNode[]): VNodeChild => {
  // A single-paragraph item renders inline so tight lists stay tight.
  const only = item.length === 1 ? item[0] : null
  return h('li', only?.type === 'paragraph' ? renderInline(only.children) : renderBlocks(item))
}

const MarkdownBody: FunctionalComponent = () => renderBlocks(blocks.value)
</script>

<template>
  <div class="markdown-body"><MarkdownBody /></div>
</template>

<!-- Not scoped: the content is built with `h()`, which the SFC compiler cannot
     tag with the scope id. Every rule is nested under `.markdown-body`. -->
<style>
.markdown-body > :first-child {
  margin-top: 0;
}

.markdown-body > :last-child {
  margin-bottom: 0;
}

.markdown-body p {
  margin: 0 0 0.6em;
  word-break: break-word;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin: 1em 0 0.5em;
  font-weight: 600;
  line-height: 1.35;
}

.markdown-body h1 {
  font-size: 1.35em;
}

.markdown-body h2 {
  font-size: 1.2em;
}

.markdown-body h3 {
  font-size: 1.08em;
}

.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  font-size: 1em;
}

.markdown-body ul,
.markdown-body ol {
  margin: 0 0 0.6em;
  padding-left: 1.5em;
}

.markdown-body li {
  margin: 0.15em 0;
}

.markdown-body li > ul,
.markdown-body li > ol {
  margin: 0.15em 0 0;
}

.markdown-body blockquote {
  margin: 0 0 0.6em;
  padding: 0.1em 0 0.1em 0.9em;
  border-left: 3px solid var(--border);
  color: var(--text-2);
}

.markdown-body code {
  padding: 0.1em 0.35em;
  border-radius: var(--r-sm);
  background-color: var(--surface-2);
  font-family: var(--font-mono);
  font-size: 0.9em;
  word-break: break-all;
}

.markdown-body pre {
  margin: 0 0 0.6em;
  padding: 10px 12px;
  border-radius: var(--r-md);
  background-color: var(--surface-2);
  overflow-x: auto;
}

.markdown-body pre code {
  padding: 0;
  background: none;
  word-break: normal;
  white-space: pre;
}

.markdown-body hr {
  margin: 0.9em 0;
  border: none;
  border-top: 1px solid var(--line);
}

.markdown-body a {
  color: var(--plum-soft);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  word-break: break-all;
}

.markdown-body a:hover {
  color: var(--plum-soft-hover);
}

</style>
