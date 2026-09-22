<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Copy } from 'lucide-vue-next'
import { useToastStore } from '@/stores/toast.store'

const props = withDefaults(
  defineProps<{ value: string; label?: string; size?: 'sm' | 'md' }>(),
  { size: 'sm' },
)

const { t } = useI18n()
const toast = useToastStore()
const copied = ref(false)

async function copy(): Promise<void> {
  try {
    // `navigator.clipboard` needs a secure context; the fallback keeps copy
    // working when the dashboard is served over plain HTTP on a LAN.
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(props.value)
    } else {
      const scratch = document.createElement('textarea')
      scratch.value = props.value
      scratch.setAttribute('readonly', '')
      scratch.style.position = 'fixed'
      scratch.style.opacity = '0'
      document.body.appendChild(scratch)
      scratch.select()
      document.execCommand('copy')
      document.body.removeChild(scratch)
    }

    copied.value = true
    window.setTimeout(() => (copied.value = false), 1600)
  } catch {
    toast.error(t('common.copyFailed'))
  }
}
</script>

<template>
  <button
    type="button"
    class="inline-flex shrink-0 items-center justify-center rounded-md text-content-subtle
           transition hover:bg-surface-muted hover:text-content"
    :class="size === 'sm' ? 'size-6' : 'size-8'"
    :aria-label="label ?? $t('common.copy')"
    :title="copied ? $t('common.copied') : (label ?? $t('common.copy'))"
    @click.stop="copy"
  >
    <Check v-if="copied" class="size-3.5 text-success-600" aria-hidden="true" />
    <Copy v-else class="size-3.5" aria-hidden="true" />
  </button>
</template>
