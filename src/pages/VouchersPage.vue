<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BadgeCheck, ScanLine, Search, Ticket } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'
import BaseTabs, { type TabItem } from '@/components/ui/BaseTabs.vue'
import VouchersTable from '@/components/tables/VouchersTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { consumeVoucher, validateVoucher } from '@/api/vouchers.api'
import { listMerchants } from '@/api/catalog.api'
import { listBranches } from '@/api/branches.api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useConfirm } from '@/composables/useConfirm'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import type { ConsumeVoucherResponse, ValidateVoucherResponse } from '@/types/models'

/**
 * Vouchers.
 *
 * The API offers no global voucher list, so this page combines the two things it
 * does offer: the merchant-facing validate/consume pair, and a per-member
 * listing by user id. Both are labelled so the limitation is visible rather
 * than looking like a missing feature.
 *
 * The form follows the order the counter works in: choose the merchant, then the
 * branch standing at, and only then enter the code. `merchantId` is asked first
 * because an administrator carries no merchant scope of their own and must say
 * which one they are acting for; the branch list then follows from it.
 *
 * The branch matters beyond bookkeeping: a voucher issued against a branch carries
 * that branch's own discount and may only be honoured there, so consuming one
 * without naming the branch is refused by the API.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const { confirm } = useConfirm()
const { can } = usePermissions()
const { messageFor } = useApiError()

const tabs = computed<TabItem[]>(() => {
  const items: TabItem[] = []
  if (can(P.VouchersValidate) || can(P.VouchersConsume)) {
    items.push({ value: 'validate', label: t('vouchers.validateTitle') })
  }
  if (can(P.UserVouchersRead)) {
    items.push({ value: 'member', label: t('vouchers.memberVouchers') })
  }
  return items
})

const activeTab = ref(tabs.value[0]?.value ?? 'validate')

const merchants = can(P.MerchantsRead)
  ? useAsyncResource(() => listMerchants(), { toastOnError: false })
  : null

const merchantOptions = computed<SelectOption[]>(
  () => merchants?.data.value?.map((item) => ({ value: item.id, label: item.name })) ?? [],
)

const branches = can(P.BranchesRead)
  ? useAsyncResource(() => listBranches(), { toastOnError: false })
  : null

/** Branches of the chosen merchant, with their city so two alike names stay apart. */
const branchOptions = computed<SelectOption[]>(() =>
  (branches?.data.value ?? [])
    .filter((branch) => branch.merchantId === merchantId.value)
    .map((branch) => ({
      value: branch.id,
      label: branch.cityName ? `${branch.name} — ${branch.cityName}` : branch.name,
    })),
)

// ── Validate / consume ────────────────────────────────────────────────────────

const code = ref('')
const merchantId = ref<string | null>(null)
const branchId = ref<string | null>(null)
const orderId = ref('')

// A branch of the previous merchant is not a valid place to present the voucher.
watch(merchantId, () => {
  branchId.value = null
})
const validating = ref(false)
const consuming = ref(false)
const validation = ref<ValidateVoucherResponse | null>(null)
const consumption = ref<ConsumeVoucherResponse | null>(null)
const actionError = ref<string | null>(null)

const canValidate = computed(() => code.value.trim().length > 0 && !validating.value)

async function runValidate(): Promise<void> {
  if (validating.value) return

  validating.value = true
  actionError.value = null
  validation.value = null
  consumption.value = null

  try {
    validation.value = await validateVoucher({
      voucherCode: code.value.trim(),
      merchantId: merchantId.value,
      branchId: branchId.value,
    })
  } catch (error) {
    actionError.value = messageFor(error)
  } finally {
    validating.value = false
  }
}

async function runConsume(): Promise<void> {
  if (consuming.value) return

  // Consuming is irreversible, so it is always confirmed first.
  const confirmed = await confirm({
    title: t('vouchers.consumeConfirmTitle'),
    body: t('vouchers.consumeConfirmBody'),
    confirmLabel: t('vouchers.consume'),
    destructive: true,
  })
  if (!confirmed) return

  consuming.value = true
  actionError.value = null

  try {
    consumption.value = await consumeVoucher({
      voucherCode: code.value.trim(),
      orderId: orderId.value.trim() || null,
      merchantId: merchantId.value,
      branchId: branchId.value,
    })
    validation.value = null
    toast.success(t('vouchers.consumed'))
  } catch (error) {
    actionError.value = messageFor(error)
  } finally {
    consuming.value = false
  }
}

function resetAction(): void {
  code.value = ''
  orderId.value = ''
  validation.value = null
  consumption.value = null
  actionError.value = null
}

// ── Member lookup ─────────────────────────────────────────────────────────────

const userIdInput = ref('')
const activeUserId = ref<string | null>(null)
const userIdError = ref(false)

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function lookupMember(): void {
  const candidate = userIdInput.value.trim()
  if (!GUID_PATTERN.test(candidate)) {
    userIdError.value = true
    activeUserId.value = null
    return
  }
  userIdError.value = false
  activeUserId.value = candidate
}
</script>

<template>
  <div>
    <PageHeader :title="$t('vouchers.title')" :subtitle="$t('vouchers.subtitle')" />

    <BaseAlert variant="info" class="mb-4">{{ $t('vouchers.noListNote') }}</BaseAlert>

    <BaseTabs v-if="tabs.length > 1" v-model="activeTab" :tabs="tabs" class="mb-4" />

    <!-- Validate / consume -->
    <div v-if="activeTab === 'validate'" class="grid gap-5 lg:grid-cols-2">
      <BaseCard :title="$t('vouchers.validateTitle')" :subtitle="$t('vouchers.validateHint')">
        <form class="space-y-4" novalidate @submit.prevent="runValidate">
          <BaseAlert v-if="actionError" variant="error">{{ actionError }}</BaseAlert>

          <!--
            Merchant, then branch, then the code — the order the counter works in.
            The branch is not bookkeeping: a voucher issued against one carries that
            branch's discount and may only be honoured there.
          -->
          <BaseSelect
            v-model="merchantId"
            :options="merchantOptions"
            :label="$t('vouchers.merchantContext')"
            :hint="$t('vouchers.merchantContextHint')"
            :placeholder="$t('vouchers.selectMerchant')"
          />

          <BaseSelect
            v-model="branchId"
            :options="branchOptions"
            :label="$t('vouchers.branch')"
            :hint="$t('vouchers.branchHint')"
            :placeholder="
              merchantId ? $t('vouchers.selectBranch') : $t('vouchers.selectMerchantFirst')
            "
            :disabled="!merchantId"
          />

          <BaseInput
            v-model="code"
            :label="$t('vouchers.voucherCode')"
            :placeholder="$t('vouchers.voucherCodePlaceholder')"
            dir="ltr"
            monospace
            required
          />

          <BaseInput
            v-if="can(P.VouchersConsume)"
            v-model="orderId"
            :label="$t('vouchers.orderId')"
            :hint="$t('vouchers.orderIdHint')"
            :maxlength="128"
            dir="ltr"
          />

          <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <BaseButton variant="secondary" :disabled="validating || consuming" @click="resetAction">
              {{ $t('common.reset') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.VouchersValidate)"
              type="submit"
              variant="primary"
              :loading="validating"
              :disabled="!canValidate"
            >
              <template #icon><ScanLine class="size-4" /></template>
              {{ validating ? $t('vouchers.validating') : $t('vouchers.validate') }}
            </BaseButton>
          </div>
        </form>
      </BaseCard>

      <!-- Result -->
      <div class="space-y-4">
        <BaseCard v-if="validation" :title="$t('vouchers.detailTitle')">
          <BaseAlert :variant="validation.valid ? 'success' : 'error'" class="mb-4">
            {{ validation.valid ? $t('vouchers.valid') : $t('vouchers.invalid') }}
          </BaseAlert>

          <dl class="space-y-2.5 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-content-muted">{{ $t('vouchers.voucherCode') }}</dt>
              <dd class="truncate font-mono text-xs" dir="ltr">{{ validation.voucherCode }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-content-muted">{{ $t('vouchers.offer') }}</dt>
              <dd class="min-w-0 truncate font-medium">{{ validation.offer.title }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-content-muted">{{ $t('common.status') }}</dt>
              <dd>
                <BaseBadge :variant="validation.valid ? 'success' : 'danger'" dot>
                  {{ $t(`vouchers.statuses.${validation.status}`) }}
                </BaseBadge>
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-content-muted">{{ $t('vouchers.discount') }}</dt>
              <dd class="font-semibold tabular-nums">
                {{ fmt.percent(validation.discountPercentage) }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-content-muted">{{ $t('vouchers.expiresAt') }}</dt>
              <dd>{{ fmt.dateTime(validation.expiresAt) }}</dd>
            </div>
          </dl>

          <template v-if="validation.valid && can(P.VouchersConsume)" #footer>
            <BaseButton variant="accent" block :loading="consuming" @click="runConsume">
              <template #icon><BadgeCheck class="size-4" /></template>
              {{ consuming ? $t('vouchers.consuming') : $t('vouchers.consume') }}
            </BaseButton>
          </template>
        </BaseCard>

        <BaseCard v-else-if="consumption" :title="$t('vouchers.consumed')">
          <dl class="space-y-2.5 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-content-muted">{{ $t('vouchers.voucherCode') }}</dt>
              <dd class="truncate font-mono text-xs" dir="ltr">{{ consumption.voucherCode }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-content-muted">{{ $t('vouchers.offer') }}</dt>
              <dd class="min-w-0 truncate font-medium">{{ consumption.offer.title }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-content-muted">{{ $t('common.status') }}</dt>
              <dd>
                <BaseBadge variant="info" dot>
                  {{ $t(`vouchers.statuses.${consumption.status}`) }}
                </BaseBadge>
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-content-muted">{{ $t('vouchers.usedAt') }}</dt>
              <dd>{{ fmt.dateTime(consumption.usedAt) }}</dd>
            </div>
            <div v-if="consumption.orderId" class="flex items-center justify-between gap-3">
              <dt class="text-content-muted">{{ $t('vouchers.orderId') }}</dt>
              <dd class="truncate font-mono text-xs" dir="ltr">{{ consumption.orderId }}</dd>
            </div>
          </dl>

          <template #footer>
            <BaseButton variant="secondary" size="sm" block @click="resetAction">
              {{ $t('common.reset') }}
            </BaseButton>
          </template>
        </BaseCard>

        <BaseCard v-else flush>
          <BaseEmptyState :title="$t('vouchers.validateTitle')" :body="$t('vouchers.validateHint')" compact>
            <template #icon><Ticket class="size-6 text-content-subtle" /></template>
          </BaseEmptyState>
        </BaseCard>
      </div>
    </div>

    <!-- Member vouchers -->
    <div v-else-if="activeTab === 'member'">
      <BaseCard class="mb-4">
        <form class="flex flex-col gap-3 sm:flex-row sm:items-start" @submit.prevent="lookupMember">
          <div class="flex-1">
            <BaseInput
              v-model="userIdInput"
              :label="$t('transactions.selectUser')"
              :hint="$t('vouchers.memberVouchersHint')"
              :errors="userIdError ? [$t('validation.guid')] : undefined"
              placeholder="3fa85f64-5717-4562-b3fc-2c963f66afa6"
              dir="ltr"
              monospace
            />
          </div>
          <BaseButton
            type="submit"
            variant="primary"
            class="sm:mt-[1.6rem]"
            :disabled="userIdInput.trim().length === 0"
          >
            <template #icon><Search class="size-4" /></template>
            {{ $t('common.search') }}
          </BaseButton>
        </form>
      </BaseCard>

      <BaseCard flush>
        <VouchersTable v-if="activeUserId" :key="activeUserId" :user-id="activeUserId" />
        <BaseEmptyState
          v-else
          :title="$t('vouchers.memberVouchers')"
          :body="$t('vouchers.memberVouchersHint')"
          branded
        />
      </BaseCard>
    </div>
  </div>
</template>
