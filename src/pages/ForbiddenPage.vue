<script setup lang="ts">
import { ShieldOff } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'

/**
 * Shown when the router refuses a page for want of a permission.
 *
 * This is a courtesy, not the boundary: the API refuses the same calls on its
 * own, so reaching this page means the UI caught it first.
 */
</script>

<template>
  <div class="mx-auto max-w-lg py-8">
    <BaseCard>
      <div class="flex flex-col items-center px-2 py-6 text-center">
        <div
          class="mb-4 flex size-14 items-center justify-center rounded-full bg-warning-50 dark:bg-warning-500/10"
          aria-hidden="true"
        >
          <ShieldOff class="size-7 text-warning-600" />
        </div>

        <h1 class="text-lg font-semibold text-content">{{ $t('states.forbiddenTitle') }}</h1>
        <p class="mt-2 max-w-sm text-sm leading-relaxed text-content-muted">
          {{ $t('states.forbiddenBody') }}
        </p>

        <BaseButton variant="primary" class="mt-6" @click="$router.push({ name: 'dashboard' })">
          {{ $t('states.goToDashboard') }}
        </BaseButton>
      </div>
    </BaseCard>
  </div>
</template>
