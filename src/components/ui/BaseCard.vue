<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    /** Removes body padding, for a card whose content is a full-bleed table. */
    flush?: boolean
  }>(),
  { flush: false },
)
</script>

<template>
  <section class="card-base overflow-hidden">
    <header
      v-if="title || subtitle || $slots.header || $slots.actions"
      class="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3.5 sm:px-5"
    >
      <div class="min-w-0">
        <slot name="header">
          <h2 v-if="title" class="truncate text-sm font-semibold text-content">{{ title }}</h2>
          <p v-if="subtitle" class="mt-0.5 text-xs text-content-muted">{{ subtitle }}</p>
        </slot>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </header>

    <div :class="flush ? '' : 'px-4 py-4 sm:px-5'">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="border-t border-hairline bg-surface-muted px-4 py-3 sm:px-5">
      <slot name="footer" />
    </footer>
  </section>
</template>
