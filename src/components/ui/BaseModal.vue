<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { X } from 'lucide-vue-next'
import BaseButton from './BaseButton.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    description?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    /** Blocks closing by backdrop or Escape, for a step that must be answered. */
    persistent?: boolean
  }>(),
  { size: 'md', persistent: false },
)

const emit = defineEmits<{ close: [] }>()

const id = useId()
const titleId = computed(() => `${id}-title`)
const descriptionId = computed(() => `${id}-description`)
const panel = ref<HTMLElement | null>(null)

const sizeClasses = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
} as const

function requestClose(): void {
  if (!props.persistent) emit('close')
}

/**
 * Keeps Tab inside the panel while it is open.
 *
 * A dialog that lets focus escape to the page behind it is unusable with a
 * keyboard or a screen reader, and the browser gives no help here for a
 * non-`<dialog>` overlay.
 */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation()
    requestClose()
    return
  }

  if (event.key !== 'Tab' || !panel.value) return

  const focusable = panel.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (focusable.length === 0) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

let previouslyFocused: HTMLElement | null = null

function lockScroll(locked: boolean): void {
  document.body.style.overflow = locked ? 'hidden' : ''
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      previouslyFocused = document.activeElement as HTMLElement | null
      lockScroll(true)
      await nextTick()
      // Focus the panel itself rather than its first control: announcing the
      // dialog's name before its fields is what a screen-reader user expects.
      panel.value?.focus()
    } else {
      lockScroll(false)
      previouslyFocused?.focus()
      previouslyFocused = null
    }
  },
)

onBeforeUnmount(() => lockScroll(false))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50 overflow-y-auto" @keydown="onKeydown">
        <div
          class="fixed inset-0 bg-primary-950/50 backdrop-blur-sm"
          aria-hidden="true"
          @click="requestClose"
        />

        <!-- Bottom-sheet on phones, centred panel from `sm` up. -->
        <div class="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95"
            leave-active-class="transition duration-100 ease-in"
            leave-to-class="translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95"
          >
            <div
              v-if="open"
              ref="panel"
              role="dialog"
              aria-modal="true"
              :aria-labelledby="title ? titleId : undefined"
              :aria-describedby="description ? descriptionId : undefined"
              tabindex="-1"
              class="relative w-full max-h-[92vh] overflow-hidden rounded-t-2xl bg-surface
                     shadow-overlay outline-none sm:rounded-card"
              :class="sizeClasses[size]"
            >
              <header
                v-if="title || $slots.header"
                class="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4"
              >
                <div class="min-w-0">
                  <slot name="header">
                    <h2 :id="titleId" class="text-base font-semibold text-content">{{ title }}</h2>
                    <p v-if="description" :id="descriptionId" class="mt-1 text-sm text-content-muted">
                      {{ description }}
                    </p>
                  </slot>
                </div>
                <BaseButton
                  v-if="!persistent"
                  variant="ghost"
                  size="sm"
                  icon-only
                  :label="$t('a11y.closeDialog')"
                  @click="emit('close')"
                >
                  <template #icon><X class="size-4" /></template>
                </BaseButton>
              </header>

              <div class="max-h-[calc(92vh-8rem)] overflow-y-auto px-5 py-4">
                <slot />
              </div>

              <footer
                v-if="$slots.footer"
                class="flex flex-col-reverse gap-2 border-t border-hairline bg-surface-muted
                       px-5 py-3.5 sm:flex-row sm:justify-end"
              >
                <slot name="footer" />
              </footer>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
