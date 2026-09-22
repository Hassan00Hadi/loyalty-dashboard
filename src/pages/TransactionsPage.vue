<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import TransactionsTable from '@/components/tables/TransactionsTable.vue'

/**
 * Point transactions.
 *
 * The API reads transactions per member — there is no system-wide transaction
 * list — so this page asks for a user id first and says why. Committing the id
 * on submit rather than on keystroke avoids a request per character.
 */
const input = ref('')
const activeUserId = ref<string | null>(null)
const error = ref<string | null>(null)

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const canSubmit = computed(() => input.value.trim().length > 0)

function submit(): void {
  const candidate = input.value.trim()
  if (!GUID_PATTERN.test(candidate)) {
    error.value = 'guid'
    activeUserId.value = null
    return
  }
  error.value = null
  activeUserId.value = candidate
}
</script>

<template>
  <div>
    <PageHeader :title="$t('transactions.title')" :subtitle="$t('transactions.subtitle')" />

    <BaseCard class="mb-4">
      <form class="flex flex-col gap-3 sm:flex-row sm:items-start" @submit.prevent="submit">
        <div class="flex-1">
          <BaseInput
            v-model="input"
            :label="$t('transactions.selectUser')"
            :hint="$t('transactions.selectUserHint')"
            :errors="error ? [$t('validation.guid')] : undefined"
            placeholder="3fa85f64-5717-4562-b3fc-2c963f66afa6"
            dir="ltr"
            monospace
          />
        </div>
        <BaseButton
          type="submit"
          variant="primary"
          class="sm:mt-[1.6rem]"
          :disabled="!canSubmit"
        >
          <template #icon><Search class="size-4" /></template>
          {{ $t('common.search') }}
        </BaseButton>
      </form>
    </BaseCard>

    <BaseAlert variant="info" class="mb-4">{{ $t('wallets.apiNote') }}</BaseAlert>

    <BaseCard v-if="activeUserId" flush>
      <!-- Keyed so switching member remounts with a fresh page cursor. -->
      <TransactionsTable :key="activeUserId" :user-id="activeUserId" />
    </BaseCard>

    <BaseCard v-else flush>
      <BaseEmptyState
        :title="$t('transactions.selectUserPrompt')"
        :body="$t('transactions.selectUserHint')"
        branded
      />
    </BaseCard>
  </div>
</template>
