import { ref } from 'vue'

export interface ConfirmOptions {
  title: string
  body?: string
  /** Label for the confirming action. Defaults to a localised "Confirm". */
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the action as destructive and focuses cancel by default. */
  destructive?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void
}

/**
 * A single, app-wide confirmation dialog.
 *
 * State lives at module scope so that `ConfirmHost`, mounted once near the root,
 * renders whatever any component asks for. `confirm()` returns a promise, which
 * lets a caller write a destructive action as straight-line code:
 *
 *     if (!(await confirm({ title, body, destructive: true }))) return
 *     await deleteThing()
 *
 * `window.confirm` is never used — it cannot be styled, localised or mirrored.
 */
const pending = ref<PendingConfirm | null>(null)

export function useConfirm() {
  function confirm(options: ConfirmOptions): Promise<boolean> {
    // A second request while one is open resolves the first as cancelled rather
    // than stacking dialogs.
    pending.value?.resolve(false)

    return new Promise<boolean>((resolve) => {
      pending.value = { ...options, resolve }
    })
  }

  function settle(confirmed: boolean): void {
    pending.value?.resolve(confirmed)
    pending.value = null
  }

  return {
    pending,
    confirm,
    accept: () => settle(true),
    reject: () => settle(false),
  }
}
