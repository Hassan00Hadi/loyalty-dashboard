<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { X } from 'lucide-vue-next'
import BaseButton from './BaseButton.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    /**
     * Which edge the panel is anchored to. `start`/`end` are logical, so a
     * start-anchored drawer opens from the left in English and the right in
     * Arabic without any conditional logic at the call site.
     */
    side?: 'start' | 'end'
  }>(),
  { side: 'start' },
)

const emit = defineEmits<{ close: [] }>()

watch(
  () => props.open,
  (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-40 bg-primary-950/50 backdrop-blur-sm lg:hidden"
        aria-hidden="true"
        @click="emit('close')"
      />
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-200 ease-out"
      :enter-from-class="side === 'start' ? '-translate-x-full rtl:translate-x-full' : 'translate-x-full rtl:-translate-x-full'"
      leave-active-class="transition-transform duration-150 ease-in"
      :leave-to-class="side === 'start' ? '-translate-x-full rtl:translate-x-full' : 'translate-x-full rtl:-translate-x-full'"
    >
      <aside
        v-if="open"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        class="fixed inset-y-0 z-50 flex w-[17rem] max-w-[85vw] flex-col bg-surface shadow-overlay lg:hidden"
        :class="side === 'start' ? 'start-0' : 'end-0'"
        @keydown.esc="emit('close')"
      >
        <header class="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <slot name="header">
            <span class="text-sm font-semibold text-content">{{ title }}</span>
          </slot>
          <BaseButton
            variant="ghost"
            size="sm"
            icon-only
            :label="$t('nav.closeMenu')"
            @click="emit('close')"
          >
            <template #icon><X class="size-4" /></template>
          </BaseButton>
        </header>

        <div class="flex-1 overflow-y-auto">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="border-t border-hairline p-3">
          <slot name="footer" />
        </footer>
      </aside>
    </Transition>
  </Teleport>
</template>
