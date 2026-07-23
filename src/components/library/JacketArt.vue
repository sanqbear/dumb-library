<script setup lang="ts">
/**
 * The 2:3 jacket face of a program.
 *
 * With cover art it is simply the image. Without it, the title itself becomes
 * the jacket: set large on a field tinted deterministically from the title, so
 * an art-less entry reads as a deliberate cover rather than a missing one — a
 * hand-built library always has some.
 *
 * Sizing is in container units (`cqw`), so the same component works at grid
 * size and in the smaller recommendation strip without a prop to tell it which.
 */
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  title: string
  /** Cover image URL. Empty/undefined switches to the typographic jacket. */
  src?: string
}>()

// Cover lifecycle: fade in once decoded so covers don't pop while scrolling,
// and fall back to the typographic jacket if the file is missing or broken —
// a stored path can outlive its file.
const loaded = ref(false)
const failed = ref(false)

watch(
  () => props.src,
  () => {
    loaded.value = false
    failed.value = false
  }
)

const showImage = computed(() => !!props.src && !failed.value)

// Hangul, kana and Han set vertically, the way a spine reads. Latin stays
// horizontal — rotating it would be costume, not typography.
const VERTICAL_SCRIPT_RE = /[぀-ヿ㐀-鿿가-힯]/

const isVertical = computed(() => VERTICAL_SCRIPT_RE.test(props.title))

// Deterministic hue per title, so a program's jacket never changes under it.
const hue = computed(() => {
  let h = 0
  for (let i = 0; i < props.title.length; i++) {
    h = (h * 31 + props.title.charCodeAt(i)) % 360
  }
  return h
})

// Muted and dark on purpose: these sit in a wall of real cover art and must
// read as one of them, not as a colour swatch.
const fieldStyle = computed(() => ({
  '--jacket-from': `hsl(${hue.value} 30% 19%)`,
  '--jacket-to': `hsl(${(hue.value + 45) % 360} 26% 9%)`,
  '--jacket-size': `${titleSize.value}cqw`
}))

// Set to length, the way a cover designer would: a short title fills the jacket,
// a long one steps down so it still resolves in roughly one block of text
// instead of splintering into a stub second column.
const titleSize = computed(() => {
  const len = props.title.trim().length
  if (len <= 8) return 14
  if (len <= 12) return 10.5
  if (len <= 20) return 8
  return 6.5
})
</script>

<template>
  <div class="jacket-art">
    <img
      v-if="showImage"
      :src="src"
      class="jacket-img"
      :class="{ 'is-loaded': loaded }"
      loading="lazy"
      decoding="async"
      alt=""
      @load="loaded = true"
      @error="failed = true"
    />
    <div v-else class="jacket-type" :class="{ 'is-vertical': isVertical }" :style="fieldStyle">
      <span class="jacket-rule" />
      <span class="jacket-title">{{ title }}</span>
    </div>
  </div>
</template>

<style scoped>
.jacket-art {
  position: absolute;
  inset: 0;
  container-type: inline-size;
  background-color: var(--surface-2);
}

.jacket-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.jacket-img.is-loaded {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .jacket-img {
    transition: none;
  }
}

.jacket-type {
  width: 100%;
  height: 100%;
  padding: 7cqw;
  display: flex;
  gap: 4cqw;
  overflow: hidden;
  background: linear-gradient(155deg, var(--jacket-from), var(--jacket-to));
  /* Not var(--text): the field is dark in both themes because it stands in for
     cover art, so theme-following text would vanish in light. */
  color: var(--on-art);
}

.jacket-title {
  font-family: var(--font-display);
  font-size: var(--jacket-size);
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.005em;
  word-break: keep-all;
  overflow: hidden;
}

/* One accent mark, following the reading direction: a band down the spine for
   vertical settings, a rule under the first line for horizontal ones. */
.jacket-rule {
  flex: 0 0 auto;
  background-color: var(--plum);
  border-radius: 1px;
}

.jacket-type:not(.is-vertical) {
  flex-direction: column;
  justify-content: flex-end;
}

.jacket-type:not(.is-vertical) .jacket-rule {
  width: 26cqw;
  height: 2.5cqw;
  order: 2;
}

.jacket-type:not(.is-vertical) .jacket-title {
  order: 1;
}

.jacket-type.is-vertical {
  flex-direction: row-reverse;
  justify-content: flex-start;
}

.jacket-type.is-vertical .jacket-rule {
  width: 2.5cqw;
  height: 26cqw;
}

.jacket-type.is-vertical .jacket-title {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  max-height: 100%;
}
</style>
