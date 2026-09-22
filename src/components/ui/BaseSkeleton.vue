<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Tailwind height class, e.g. `h-4`. */
    height?: string
    width?: string
    rounded?: string
    /** Renders this many stacked bars, for a paragraph or list placeholder. */
    lines?: number
  }>(),
  { height: 'h-4', width: 'w-full', rounded: 'rounded', lines: 1 },
)
</script>

<template>
  <!--
    Marked `aria-hidden` with a polite live-region label on the wrapper: a
    screen reader should hear "loading" once, not a description of every bar.
  -->
  <div v-if="lines === 1" class="skeleton-shimmer" :class="[height, width, rounded]" aria-hidden="true" />
  <div v-else class="space-y-2" aria-hidden="true">
    <div
      v-for="line in lines"
      :key="line"
      class="skeleton-shimmer"
      :class="[height, rounded, line === lines && lines > 1 ? 'w-2/3' : width]"
    />
  </div>
</template>
