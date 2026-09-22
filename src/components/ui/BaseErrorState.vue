<script setup lang="ts">
import { computed } from 'vue'
import { CloudOff, RefreshCw, ShieldOff, TriangleAlert } from 'lucide-vue-next'
import BaseButton from './BaseButton.vue'
import type { NormalisedError } from '@/types/api'
import { useApiError } from '@/composables/useApiError'

const props = withDefaults(
  defineProps<{
    error: NormalisedError | null
    compact?: boolean
  }>(),
  { compact: false },
)

const emit = defineEmits<{ retry: [] }>()

const { messageFor } = useApiError()

/**
 * A failure is presented by what the user can do about it: a permission problem
 * is final and offers no retry, an unreachable server suggests checking the API,
 * and everything else is worth retrying.
 */
const kind = computed<'forbidden' | 'offline' | 'generic'>(() => {
  if (props.error?.status === 403) return 'forbidden'
  if (props.error?.code === 'NETWORK_ERROR' || props.error?.code === 'TIMEOUT') return 'offline'
  return 'generic'
})

const titleKey = computed(() => {
  switch (kind.value) {
    case 'forbidden':
      return 'states.forbiddenTitle'
    case 'offline':
      return 'states.offlineTitle'
    default:
      return 'states.errorTitle'
  }
})

const bodyText = computed(() => {
  if (!props.error) return undefined
  return messageFor(props.error)
})
</script>

<template>
  <div
    class="flex flex-col items-center justify-center px-6 text-center"
    :class="compact ? 'py-10' : 'py-16'"
  >
    <div
      class="mb-4 flex size-12 items-center justify-center rounded-full"
      :class="kind === 'forbidden' ? 'bg-warning-50 dark:bg-warning-500/10' : 'bg-danger-50 dark:bg-danger-500/10'"
      aria-hidden="true"
    >
      <ShieldOff v-if="kind === 'forbidden'" class="size-6 text-warning-600" />
      <CloudOff v-else-if="kind === 'offline'" class="size-6 text-danger-600" />
      <TriangleAlert v-else class="size-6 text-danger-600" />
    </div>

    <h3 class="text-sm font-semibold text-content">{{ $t(titleKey) }}</h3>
    <p class="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-content-muted">
      {{ kind === 'forbidden' ? $t('states.forbiddenBody') : bodyText || $t('states.errorBody') }}
    </p>
    <p v-if="error?.traceId" class="mt-2 font-mono text-xs text-content-subtle">
      {{ $t('errors.traceId', { id: error.traceId }) }}
    </p>

    <BaseButton v-if="kind !== 'forbidden'" variant="secondary" class="mt-5" @click="emit('retry')">
      <template #icon><RefreshCw class="size-4" /></template>
      {{ $t('common.retry') }}
    </BaseButton>
  </div>
</template>
