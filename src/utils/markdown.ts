/**
 * Minimal Markdown parser for reference memos.
 *
 * Deliberately small: memos are short notes, so this covers the block syntax
 * people actually type (headings, lists, blockquotes, fenced code, rules) plus
 * the usual inline marks — and nothing else. It returns an AST instead of an
 * HTML string so the renderer can build VNodes directly: no `v-html`, and
 * therefore no way for memo text to inject markup into the renderer process.
 *
 * Line breaks inside a paragraph are kept (GFM-style soft breaks), matching
 * how memos read while being edited in a plain textarea.
 */

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'break' }
  | { type: 'code'; value: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'em'; children: InlineNode[] }
  | { type: 'del'; children: InlineNode[] }
  | { type: 'link'; href: string; children: InlineNode[] }

export type BlockNode =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'heading'; level: number; children: InlineNode[] }
  | { type: 'codeBlock'; lang: string; value: string }
  | { type: 'blockquote'; children: BlockNode[] }
  | { type: 'list'; ordered: boolean; start: number; items: BlockNode[][] }
  | { type: 'thematicBreak' }

/**
 * One pass over every inline construct. Alternatives are ordered by priority:
 * escapes, code spans (literal, so they must win over emphasis), explicit
 * links, then the emphasis marks, then bare URLs.
 *
 * The `_` variants are guarded by `(?<!\w)` / `(?!\w)` so `snake_case_names`
 * survive intact — a real risk in memos full of file names.
 */
const INLINE_RE =
  /\\(?<esc>[\\`*_{}[\]()#+\-.!~>])|(?<fence>`+)(?<code>[\s\S]*?)\k<fence>|\[(?<linkText>[^\]]*)\]\(\s*<?(?<href>[^\s>)]*)>?[^)]*\)|\*\*(?=\S)(?<strong>[\s\S]*?\S)\*\*|(?<!\w)__(?=\S)(?<strongU>[\s\S]*?\S)__(?!\w)|~~(?=\S)(?<del>[\s\S]*?\S)~~|\*(?=\S)(?<em>[\s\S]*?\S)\*|(?<!\w)_(?=\S)(?<emU>[\s\S]*?\S)_(?!\w)|(?<auto>https?:\/\/[^\s<>]+)/g

// Trailing punctuation after a bare URL is nearly always sentence syntax.
const URL_TRAIL_RE = /[),.;:!?'"\]]+$/

/** Only schemes we are willing to hand to the system browser. */
const safeHref = (raw: string): string | null => {
  const href = raw.trim()
  return /^(?:https?:|mailto:)/i.test(href) ? href : null
}

const parseInline = (src: string): InlineNode[] => {
  const nodes: InlineNode[] = []

  const pushText = (value: string): void => {
    if (!value) return
    const lines = value.split('\n')
    lines.forEach((line, i) => {
      if (i > 0) nodes.push({ type: 'break' })
      // Trailing spaces before a newline are hard-break syntax, not content.
      const text = i < lines.length - 1 ? line.replace(/ +$/, '') : line
      if (text) nodes.push({ type: 'text', value: text })
    })
  }

  // Own regex instance per call: emphasis recurses into this function, and a
  // shared `lastIndex` on a /g regex would be clobbered by the inner scan.
  const re = new RegExp(INLINE_RE, INLINE_RE.flags)
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(src)) !== null) {
    const g = match.groups ?? {}
    const start = match.index
    let consumed = match[0].length

    let produced: InlineNode[] = []
    if (g.esc !== undefined) {
      produced = [{ type: 'text', value: g.esc }]
    } else if (g.code !== undefined) {
      // A single leading/trailing space is padding for spans containing backticks.
      produced = [{ type: 'code', value: g.code.replace(/^ (.*) $/, '$1') }]
    } else if (g.linkText !== undefined) {
      const href = safeHref(g.href ?? '')
      const children = parseInline(g.linkText)
      // Unsupported scheme: keep the label, drop the link.
      produced = href ? [{ type: 'link', href, children }] : children
    } else if (g.strong !== undefined || g.strongU !== undefined) {
      produced = [{ type: 'strong', children: parseInline(g.strong ?? g.strongU ?? '') }]
    } else if (g.del !== undefined) {
      produced = [{ type: 'del', children: parseInline(g.del) }]
    } else if (g.em !== undefined || g.emU !== undefined) {
      produced = [{ type: 'em', children: parseInline(g.em ?? g.emU ?? '') }]
    } else if (g.auto !== undefined) {
      const url = g.auto.replace(URL_TRAIL_RE, '')
      produced = [{ type: 'link', href: url, children: [{ type: 'text', value: url }] }]
      // Re-scan the punctuation we trimmed off so it renders as plain text.
      consumed = url.length
      re.lastIndex = start + consumed
    }

    pushText(src.slice(last, start))
    nodes.push(...produced)
    last = start + consumed
  }
  pushText(src.slice(last))

  return nodes
}

const FENCE_RE = /^ {0,3}(```|~~~)\s*([^\s`]*)\s*$/
const HEADING_RE = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const RULE_RE = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/
const QUOTE_RE = /^ {0,3}>[ \t]?(.*)$/
const BULLET_RE = /^( *)([-*+])( +)(.*)$/
const ORDERED_RE = /^( *)(\d{1,9})[.)]( +)(.*)$/

interface ListItemHead {
  indent: number
  ordered: boolean
  start: number
  text: string
  /** Column where the item's content begins — how far to dedent its body. */
  contentIndent: number
}

const matchListItem = (line: string): ListItemHead | null => {
  if (RULE_RE.test(line)) return null
  const bullet = BULLET_RE.exec(line)
  if (bullet) {
    const [, pad = '', marker = '', gap = '', text = ''] = bullet
    return {
      indent: pad.length,
      ordered: false,
      start: 1,
      text,
      contentIndent: pad.length + marker.length + gap.length
    }
  }
  const ordered = ORDERED_RE.exec(line)
  if (ordered) {
    const [, pad = '', digits = '', gap = '', text = ''] = ordered
    return {
      indent: pad.length,
      ordered: true,
      start: Number(digits),
      text,
      // +1 for the `.` or `)` that the pattern matches but does not capture.
      contentIndent: pad.length + digits.length + 1 + gap.length
    }
  }
  return null
}

const leadingSpaces = (line: string): number => line.length - line.trimStart().length

/** Strip up to `columns` leading spaces, never eating actual content. */
const dedent = (line: string, columns: number): string =>
  line.slice(Math.min(columns, leadingSpaces(line)))

/** Does this line open a new block, i.e. interrupt a running paragraph? */
const isBlockStart = (line: string): boolean =>
  FENCE_RE.test(line) ||
  HEADING_RE.test(line) ||
  RULE_RE.test(line) ||
  QUOTE_RE.test(line) ||
  matchListItem(line) !== null

const parseBlocks = (lines: string[]): BlockNode[] => {
  const blocks: BlockNode[] = []
  const at = (n: number): string => lines[n] ?? ''
  let i = 0

  while (i < lines.length) {
    const line = at(i)
    if (!line.trim()) {
      i++
      continue
    }

    const fence = FENCE_RE.exec(line)
    if (fence) {
      const marker = fence[1] ?? '```'
      const body: string[] = []
      i++
      while (i < lines.length && at(i).trim() !== marker) body.push(at(i++))
      if (i < lines.length) i++ // closing fence
      blocks.push({ type: 'codeBlock', lang: fence[2] ?? '', value: body.join('\n') })
      continue
    }

    if (RULE_RE.test(line)) {
      blocks.push({ type: 'thematicBreak' })
      i++
      continue
    }

    const heading = HEADING_RE.exec(line)
    if (heading) {
      blocks.push({
        type: 'heading',
        level: (heading[1] ?? '#').length,
        children: parseInline(heading[2] ?? '')
      })
      i++
      continue
    }

    if (QUOTE_RE.test(line)) {
      const body: string[] = []
      // Lines without `>` still belong to the quote until a blank line (lazy
      // continuation), which is how people usually wrap quoted text.
      while (i < lines.length && at(i).trim()) {
        const quoted = QUOTE_RE.exec(at(i))
        body.push(quoted ? (quoted[1] ?? '') : at(i).trim())
        i++
      }
      blocks.push({ type: 'blockquote', children: parseBlocks(body) })
      continue
    }

    const head = matchListItem(line)
    if (head) {
      const { ordered, indent, start } = head
      const items: BlockNode[][] = []
      while (i < lines.length) {
        if (!at(i).trim()) {
          // A blank line only stays inside the list if a sibling item follows.
          let next = i + 1
          while (next < lines.length && !at(next).trim()) next++
          const sibling = next < lines.length ? matchListItem(at(next)) : null
          if (!sibling || sibling.indent !== indent || sibling.ordered !== ordered) break
          i = next
          continue
        }
        const item = matchListItem(at(i))
        if (!item || item.indent !== indent || item.ordered !== ordered) break

        const content = [item.text]
        i++
        // Everything indented past the marker belongs to this item — that is
        // what turns an indented `-` run into a nested list on recursion.
        while (i < lines.length && at(i).trim()) {
          const nested = matchListItem(at(i))
          if (nested && nested.indent <= indent) break
          if (!nested && leadingSpaces(at(i)) <= indent && isBlockStart(at(i))) break
          content.push(dedent(at(i), item.contentIndent))
          i++
        }
        items.push(parseBlocks(content))
      }
      blocks.push({ type: 'list', ordered, start, items })
      continue
    }

    const paragraph: string[] = [line.trim()]
    i++
    while (i < lines.length && at(i).trim() && !isBlockStart(at(i))) paragraph.push(at(i++).trim())
    blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) })
  }

  return blocks
}

export const parseMarkdown = (source: string): BlockNode[] => {
  if (!source) return []
  return parseBlocks(source.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'))
}
