<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import ListToolbar from '@/components/ui/ListToolbar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { createPointsRule, listPointsRules, updatePointsRule } from '@/api/pointsRules.api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import type { PointsRule, UpdatePointsRuleRequest } from '@/types/models'

/**
 * Points rules: named amounts of points, such as "Referral bonus — 500 points".
 *
 * The server returns every rule in one unpaged list, so search and the status
 * filter run in the browser. A save replaces the one row it changed with the rule
 * the server returns, rather than reloading the list.
 *
 * There is no delete: a rule is retired by deactivating it.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const { can } = usePermissions()
const { messageFor, fieldErrorsOf } = useApiError()

const TITLE_MAX = 128
const DESCRIPTION_MAX = 512

const rules = useAsyncResource(() => listPointsRules(), {
  errorTitleKey: 'errors.loadPointsRulesFailed',
  toastOnError: false,
})

/** Swaps in the server's copy of one rule, keeping the list's order. */
function replaceRule(rule: PointsRule): void {
  rules.data.value = (rules.data.value ?? []).map((item) => (item.id === rule.id ? rule : item))
}

// ── Search and filter ─────────────────────────────────────────────────────────

const search = ref('')
const statusFilter = ref<'active' | 'inactive' | null>(null)

const statusOptions = computed<SelectOption[]>(() => [
  { value: 'active', label: t('common.active') },
  { value: 'inactive', label: t('common.inactive') },
])

const visible = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return (rules.data.value ?? []).filter((rule) => {
    if (statusFilter.value === 'active' && !rule.isActive) return false
    if (statusFilter.value === 'inactive' && rule.isActive) return false
    if (!term) return true
    return (
      (rule.title ?? '').toLocaleLowerCase().includes(term) ||
      rule.description.toLocaleLowerCase().includes(term)
    )
  })
})

const hasFilters = computed(() => search.value.length > 0 || statusFilter.value !== null)

function clearFilters(): void {
  search.value = ''
  statusFilter.value = null
}

const columns = computed<TableColumn[]>(() => [
  { key: 'title', label: t('pointsRules.ruleTitle') },
  { key: 'description', label: t('common.description'), hideBelow: 'md' },
  { key: 'points', label: t('pointsRules.points'), align: 'end' },
  { key: 'isActive', label: t('common.status') },
  { key: 'updatedAt', label: t('pointsRules.lastUpdated'), hideBelow: 'lg' },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

// ── Create / edit ─────────────────────────────────────────────────────────────

const modalOpen = ref(false)
const editing = ref<PointsRule | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

const form = ref({ title: '', description: '', points: '0', isActive: true })

const FORM_FIELDS = new Set(['title', 'description', 'points', 'isActive'])

function resetErrors(): void {
  formError.value = null
  fieldErrors.value = {}
}

function openCreate(): void {
  editing.value = null
  form.value = { title: '', description: '', points: '0', isActive: true }
  resetErrors()
  modalOpen.value = true
}

function openEdit(rule: PointsRule): void {
  editing.value = rule
  form.value = {
    title: rule.title ?? '',
    description: rule.description,
    points: String(rule.points),
    isActive: rule.isActive,
  }
  resetErrors()
  modalOpen.value = true
}

/** The server's rules, checked first so an obvious mistake costs no round trip. */
function validate(): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  const description = form.value.description.trim()
  const points = Number(form.value.points)

  if (form.value.title.trim().length > TITLE_MAX) {
    errors.title = [t('pointsRules.validation.titleTooLong', { max: TITLE_MAX })]
  }
  if (!description) {
    errors.description = [t('pointsRules.validation.descriptionRequired')]
  } else if (description.length > DESCRIPTION_MAX) {
    errors.description = [t('pointsRules.validation.descriptionTooLong', { max: DESCRIPTION_MAX })]
  }
  if (form.value.points.trim() === '' || !Number.isInteger(points) || points < 0) {
    errors.points = [t('pointsRules.validation.pointsInvalid')]
  }
  return errors
}

/**
 * Only what differs from the loaded rule, since the endpoint is sparse. A cleared
 * title is sent as `''`, which is how the server is told to remove it.
 */
function changedFields(original: PointsRule): UpdatePointsRuleRequest {
  const patch: UpdatePointsRuleRequest = {}
  const title = form.value.title.trim()
  const description = form.value.description.trim()
  const points = Number(form.value.points)

  if (title !== (original.title ?? '')) patch.title = title
  if (description !== original.description) patch.description = description
  if (points !== original.points) patch.points = points
  if (form.value.isActive !== original.isActive) patch.isActive = form.value.isActive
  return patch
}

async function save(): Promise<void> {
  if (saving.value) return

  resetErrors()
  const local = validate()
  if (Object.keys(local).length) {
    fieldErrors.value = local
    return
  }

  saving.value = true
  try {
    if (editing.value) {
      const patch = changedFields(editing.value)
      if (Object.keys(patch).length) {
        replaceRule(await updatePointsRule(editing.value.id, patch))
        toast.success(t('pointsRules.updated'))
      }
    } else {
      const created = await createPointsRule({
        title: form.value.title.trim() || null,
        description: form.value.description.trim(),
        points: Number(form.value.points),
        isActive: form.value.isActive,
      })
      // Placed as the server would list it — by title, untitled last — so the new
      // row appears where a reload would put it.
      rules.data.value = sortRules([...(rules.data.value ?? []), created])
      toast.success(t('pointsRules.created'))
    }
    modalOpen.value = false
  } catch (error) {
    const errors = fieldErrorsOf(error)
    // Keys that are not form fields — `$` for malformed JSON, `request` — have no
    // control to sit under, so their messages join the general form error.
    const general = Object.entries(errors)
      .filter(([key]) => !FORM_FIELDS.has(key))
      .flatMap(([, messages]) => messages)

    fieldErrors.value = errors
    formError.value = [messageFor(error), ...general].join(' ')

    if ((error as { status?: number }).status === 404) {
      modalOpen.value = false
      toast.error(t('pointsRules.notFound'))
      await rules.refresh()
    }
  } finally {
    saving.value = false
  }
}

function sortRules(list: PointsRule[]): PointsRule[] {
  return list.sort((a, b) => {
    if (a.title === null || b.title === null) {
      return a.title === b.title ? 0 : a.title === null ? 1 : -1
    }
    return a.title.localeCompare(b.title)
  })
}

// ── Active toggle ─────────────────────────────────────────────────────────────

const toggling = ref(new Set<string>())

async function toggleActive(rule: PointsRule): Promise<void> {
  if (toggling.value.has(rule.id)) return
  toggling.value.add(rule.id)
  try {
    replaceRule(await updatePointsRule(rule.id, { isActive: !rule.isActive }))
    toast.success(t('pointsRules.updated'))
  } catch (error) {
    toast.error(t('errors.saveFailed'), messageFor(error))
    if ((error as { status?: number }).status === 404) await rules.refresh()
  } finally {
    toggling.value.delete(rule.id)
  }
}
</script>

<template>
  <div>
    <PageHeader :title="$t('pointsRules.title')" :subtitle="$t('pointsRules.subtitle')">
      <template #actions>
        <BaseButton v-if="can(P.PointsRulesCreate)" variant="primary" @click="openCreate">
          <template #icon><Plus class="size-4" /></template>
          {{ $t('pointsRules.create') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseCard flush>
      <ListToolbar
        v-model:search="search"
        :search-placeholder="$t('pointsRules.searchPlaceholder')"
        :has-filters="hasFilters"
        :result-count="rules.data.value && hasFilters ? visible.length : null"
        @clear="clearFilters"
      >
        <template #filters>
          <div class="w-full sm:w-40">
            <BaseSelect
              v-model="statusFilter"
              :options="statusOptions"
              :placeholder="$t('pointsRules.allStatuses')"
            />
          </div>
        </template>
      </ListToolbar>

      <BaseTable
        :columns="columns"
        :rows="visible"
        row-key="id"
        :loading="rules.loading.value"
        :refreshing="rules.refreshing.value"
        :error="rules.error.value"
        :empty-title="hasFilters ? $t('table.noResults') : $t('pointsRules.empty')"
        :empty-body="hasFilters ? $t('states.emptyBody') : $t('pointsRules.emptyHint')"
        @retry="rules.refresh()"
      >
        <template #cell:title="{ row }">
          <span v-if="row.title" class="font-medium">{{ row.title }}</span>
          <span v-else class="text-content-subtle">—</span>
        </template>

        <template #cell:description="{ row }">
          <span class="line-clamp-1 max-w-md text-content-muted" :title="row.description">
            {{ row.description }}
          </span>
        </template>

        <template #cell:points="{ row }">
          <span class="font-semibold tabular-nums text-success-700 dark:text-success-500">
            +{{ fmt.points(row.points) }}
          </span>
        </template>

        <template #cell:isActive="{ row }">
          <StatusBadge :active="row.isActive" />
        </template>

        <template #cell:updatedAt="{ row }">
          <span class="whitespace-nowrap text-content-muted">
            {{ fmt.dateTime(row.updatedAt ?? row.createdAt) }}
          </span>
        </template>

        <template #cell:actions="{ row }">
          <div v-if="can(P.PointsRulesUpdate)" class="flex items-center justify-end gap-1.5">
            <BaseButton
              variant="ghost"
              size="sm"
              :loading="toggling.has(row.id)"
              @click="toggleActive(row)"
            >
              {{ row.isActive ? $t('common.deactivate') : $t('common.activate') }}
            </BaseButton>
            <BaseButton variant="secondary" size="sm" @click="openEdit(row)">
              {{ $t('common.edit') }}
            </BaseButton>
          </div>
        </template>

        <template v-if="!hasFilters" #empty-action>
          <BaseButton v-if="can(P.PointsRulesCreate)" variant="primary" @click="openCreate">
            <template #icon><Plus class="size-4" /></template>
            {{ $t('pointsRules.create') }}
          </BaseButton>
        </template>
      </BaseTable>

      <template #footer>
        <p class="text-xs text-content-subtle">{{ $t('pointsRules.noDeleteNote') }}</p>
      </template>
    </BaseCard>

    <BaseModal
      :open="modalOpen"
      :title="editing ? $t('pointsRules.editTitle') : $t('pointsRules.createTitle')"
      @close="modalOpen = false"
    >
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>

        <BaseInput
          v-model="form.title"
          :label="$t('pointsRules.ruleTitle')"
          :hint="$t('pointsRules.charactersLeft', { count: TITLE_MAX - form.title.length })"
          :errors="fieldErrors.title"
          :maxlength="TITLE_MAX"
          :placeholder="$t('pointsRules.titlePlaceholder')"
        />
        <BaseTextarea
          v-model="form.description"
          :label="$t('common.description')"
          :errors="fieldErrors.description"
          :maxlength="DESCRIPTION_MAX"
          required
        />
        <BaseInput
          v-model="form.points"
          type="number"
          inputmode="numeric"
          min="0"
          step="1"
          :label="$t('pointsRules.points')"
          :errors="fieldErrors.points"
          dir="ltr"
          required
        />
        <BaseToggle v-model="form.isActive" :label="$t('common.active')" />
      </form>

      <template #footer>
        <BaseButton variant="secondary" :disabled="saving" @click="modalOpen = false">
          {{ $t('common.cancel') }}
        </BaseButton>
        <BaseButton variant="primary" :loading="saving" @click="save">
          {{ editing ? $t('common.saveChanges') : $t('common.create') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
