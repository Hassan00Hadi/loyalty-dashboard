<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, HelpCircle } from 'lucide-vue-next'
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'
import { useConfirm } from '@/composables/useConfirm'

/**
 * The host for `useConfirm()`. Mounted once in the dashboard layout, it renders
 * whichever confirmation any component has requested.
 *
 * This replaces `window.confirm`, which cannot be localised, themed or mirrored
 * for RTL.
 */
const { pending, accept, reject } = useConfirm()

const isOpen = computed(() => pending.value !== null)
const destructive = computed(() => pending.value?.destructive === true)
</script>

<template>
  <BaseModal :open="isOpen" size="sm" @close="reject">
    <div class="flex gap-4">
      <div
        class="flex size-10 shrink-0 items-center justify-center rounded-full"
        :class="destructive ? 'bg-danger-50 dark:bg-danger-500/10' : 'bg-info-50 dark:bg-info-500/10'"
      >
        <AlertTriangle v-if="destructive" class="size-5 text-danger-600" aria-hidden="true" />
        <HelpCircle v-else class="size-5 text-info-600" aria-hidden="true" />
      </div>

      <div class="min-w-0 pt-1">
        <h2 class="text-base font-semibold text-content">
          {{ pending?.title ?? $t('confirm.title') }}
        </h2>
        <p v-if="pending?.body" class="mt-1.5 text-sm leading-relaxed text-content-muted">
          {{ pending.body }}
        </p>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="reject">
        {{ pending?.cancelLabel ?? $t('confirm.cancel') }}
      </BaseButton>
      <BaseButton :variant="destructive ? 'danger' : 'primary'" @click="accept">
        {{ pending?.confirmLabel ?? $t('confirm.confirm') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
