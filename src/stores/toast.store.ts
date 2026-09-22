import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  variant: ToastVariant
  /** Already-localised title. Stores hold text, not message keys. */
  title: string
  description?: string
  /** Shown in small type so a failure can be reported to an operator. */
  traceId?: string | null
  timeout: number
}

let nextId = 1

/**
 * The global toast queue.
 *
 * Callers pass localised strings rather than i18n keys: this keeps the store
 * free of any dependency on the i18n instance, and lets a caller interpolate
 * values into a message before queueing it.
 */
export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function push(toast: Omit<Toast, 'id' | 'timeout'> & { timeout?: number }): number {
    const id = nextId++
    // Errors linger: they often carry a trace id someone needs to write down.
    const timeout = toast.timeout ?? (toast.variant === 'error' ? 8000 : 4500)

    toasts.value = [...toasts.value, { ...toast, id, timeout }]

    if (timeout > 0) {
      window.setTimeout(() => dismiss(id), timeout)
    }
    return id
  }

  const success = (title: string, description?: string) =>
    push({ variant: 'success', title, description })

  const error = (title: string, description?: string, traceId?: string | null) =>
    push({ variant: 'error', title, description, traceId })

  const warning = (title: string, description?: string) =>
    push({ variant: 'warning', title, description })

  const info = (title: string, description?: string) =>
    push({ variant: 'info', title, description })

  function clear(): void {
    toasts.value = []
  }

  return { toasts, push, success, error, warning, info, dismiss, clear }
})
