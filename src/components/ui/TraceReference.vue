<script setup lang="ts">
import { computed } from 'vue'
import CopyButton from './CopyButton.vue'

/**
 * A failed request's trace id, as an operator quotes it to the backend team.
 *
 * Shortened on screen — the full 32-character id would dominate a toast — but the
 * copy button and tooltip carry the whole value, which is what a bug report needs.
 */
const props = defineProps<{ traceId: string }>()

const short = computed(() =>
  props.traceId.length > 12 ? `${props.traceId.slice(0, 8)}…` : props.traceId,
)
</script>

<template>
  <span class="inline-flex items-center gap-1 font-mono text-content-subtle" :title="traceId">
    <span dir="ltr">{{ $t('errors.traceId', { id: short }) }}</span>
    <CopyButton :value="traceId" :label="$t('errors.copyTraceId')" />
  </span>
</template>
