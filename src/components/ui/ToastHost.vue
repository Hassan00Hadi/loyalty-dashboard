<script setup lang="ts">
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-vue-next'
import { useToastStore, type ToastVariant } from '@/stores/toast.store'

/**
 * Renders the global toast queue. Mounted once, near the root.
 *
 * Anchored with `end-0`, so notifications appear top-right in English and
 * top-left in Arabic, matching where each language's eye finishes a line.
 */
const toast = useToastStore()

const icons: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
}

const accents: Record<ToastVariant, string> = {
  success: 'text-success-600 dark:text-success-500',
  error: 'text-danger-600 dark:text-danger-500',
  warning: 'text-warning-600 dark:text-warning-500',
  info: 'text-info-600 dark:text-info-500',
}
</script>

<template>
  <Teleport to="body">
    <!--
      `aria-live="polite"` on the container rather than each toast, so entries
      are announced as they are added without interrupting the user.
    -->
    <div
      class="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-4
             sm:inset-x-auto sm:end-0 sm:items-end"
      role="region"
      aria-live="polite"
      aria-atomic="false"
    >
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-2 sm:translate-y-0 sm:translate-x-4 sm:rtl:-translate-x-4"
        leave-active-class="transition duration-150 ease-in absolute"
        leave-to-class="opacity-0 scale-95"
        move-class="transition duration-150"
      >
        <div
          v-for="item in toast.toasts"
          :key="item.id"
          class="pointer-events-auto flex w-full max-w-sm gap-3 rounded-xl border border-hairline
                 bg-surface p-3.5 shadow-raised"
        >
          <component
            :is="icons[item.variant]"
            class="mt-0.5 size-5 shrink-0"
            :class="accents[item.variant]"
            aria-hidden="true"
          />

          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-content">{{ item.title }}</p>
            <p v-if="item.description" class="mt-0.5 text-sm leading-snug text-content-muted">
              {{ item.description }}
            </p>
            <p v-if="item.traceId" class="mt-1 font-mono text-[0.6875rem] text-content-subtle">
              {{ $t('errors.traceId', { id: item.traceId }) }}
            </p>
          </div>

          <button
            type="button"
            class="-m-1 shrink-0 self-start rounded p-1 text-content-subtle transition
                   hover:bg-surface-muted hover:text-content"
            :aria-label="$t('a11y.closeNotification')"
            @click="toast.dismiss(item.id)"
          >
            <X class="size-4" aria-hidden="true" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
