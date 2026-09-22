<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ExternalLink, MapPin, Plus } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import EntityAvatar from '@/components/ui/EntityAvatar.vue'
import ListToolbar from '@/components/ui/ListToolbar.vue'
import MapPicker from '@/components/ui/MapPicker.vue'
import ImageUploadField from '@/components/forms/ImageUploadField.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import {
  createBranch,
  createBranchWithImages,
  deleteBranch,
  listBranches,
  patchBranch,
  patchBranchWithImages,
} from '@/api/branches.api'
import { listMerchants } from '@/api/catalog.api'
import { listCities } from '@/api/cities.api'
import { MAX_PAGE_SIZE } from '@/types/api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useConfirm } from '@/composables/useConfirm'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import type { MerchantBranch } from '@/types/models'

/**
 * Merchant branches — the only catalogue resource with a real DELETE, so this
 * is the one page that offers a destructive action, behind a confirmation.
 *
 * Latitude and longitude are strings on the API, not numbers, and are kept as
 * strings here so a value is round-tripped exactly as stored.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const route = useRoute()
const { confirm } = useConfirm()
const { can } = usePermissions()
const { messageFor, fieldErrorsOf } = useApiError()

const branches = useAsyncResource(() => listBranches(), {
  errorTitleKey: 'errors.loadBranchesFailed',
  toastOnError: false,
})

const merchants = can(P.MerchantsRead)
  ? useAsyncResource(() => listMerchants(), { toastOnError: false })
  : null

const search = ref('')
const merchantFilter = ref<string | null>(null)

// Arriving from the merchants page pre-selects that merchant.
onMounted(() => {
  const incoming = route.query.merchantId
  if (typeof incoming === 'string') merchantFilter.value = incoming
})

const merchantOptions = computed<SelectOption[]>(
  () => merchants?.data.value?.map((item) => ({ value: item.id, label: item.name })) ?? [],
)

const merchantNames = computed(() => {
  const map = new Map<string, string>()
  for (const merchant of merchants?.data.value ?? []) map.set(merchant.id, merchant.name)
  return map
})

// A city row is shared by the whole platform — several merchants having a branch in
// Baghdad is the normal case, and the point of one shared row. What is *not* shared is
// which of them a given merchant trades in.
const cities = can(P.CitiesRead)
  ? useAsyncResource(() => listCities({ page: 1, pageSize: MAX_PAGE_SIZE, isActive: true }), {
      toastOnError: false,
    })
  : null

/** Every city by id, for naming a merchant's cities and grouping rows. */
const cityNames = computed(() => {
  const map = new Map<string, string>()
  for (const city of cities?.data.value?.items ?? []) map.set(city.id, city.name)
  return map
})

const filtered = computed(() => {
  let all = branches.data.value ?? []

  if (merchantFilter.value) {
    all = all.filter((branch) => branch.merchantId === merchantFilter.value)
  }

  const term = search.value.trim().toLowerCase()
  if (term) {
    all = all.filter(
      (branch) =>
        branch.name.toLowerCase().includes(term) ||
        (branch.address?.toLowerCase().includes(term) ?? false),
    )
  }

  return all
})

/**
 * The filtered branches grouped under their city, as the merchant flow presents
 * them: Basra → Branch A, Branch B; Wasit → Branch C.
 *
 * Grouping is presentation only — each branch's city is the one the backend
 * stored on it, never inferred. Branches with no city are collected last under
 * their own heading rather than being dropped.
 */
const groupedByCity = computed(() => {
  const groups = new Map<string, { cityId: string | null; name: string; rows: MerchantBranch[] }>()

  for (const branch of filtered.value) {
    const key = branch.cityId ?? ''
    const existing = groups.get(key)
    if (existing) {
      existing.rows.push(branch)
      continue
    }
    groups.set(key, {
      cityId: branch.cityId,
      name: branch.cityName ?? cityNames.value.get(branch.cityId ?? '') ?? t('branches.noCity'),
      rows: [branch],
    })
  }

  // Named cities first, alphabetically; the "no city" bucket last.
  return [...groups.values()].sort((a, b) => {
    if (a.cityId === null) return 1
    if (b.cityId === null) return -1
    return a.name.localeCompare(b.name)
  })
})

/** The grouped view is only meaningful for one merchant's branches. */
const groupedView = ref(false)
const canGroup = computed(() => merchantFilter.value !== null)

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('branches.branch') },
  { key: 'merchantId', label: t('branches.belongsTo'), hideBelow: 'md' },
  { key: 'cityName', label: t('branches.city'), hideBelow: 'md' },
  { key: 'address', label: t('branches.address'), hideBelow: 'lg' },
  { key: 'coordinates', label: t('branches.coordinates'), hideBelow: 'xl' },
  { key: 'isActive', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

// ── Create / edit ─────────────────────────────────────────────────────────────

const modalOpen = ref(false)
const editing = ref<MerchantBranch | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

/**
 * The images are the chosen `File`s themselves, not attachment ids: they are sent
 * with the branch in one multipart request and the backend creates and owns the
 * attachments. Each `clear*` records that a saved image was removed, which a null
 * file alone cannot express — that just means "unchanged".
 */
const emptyForm = () => ({
  merchantId: merchantFilter.value,
  cityId: null as string | null,
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  phoneNumber: '',
  backgroundFile: null as File | null,
  clearBackground: false,
  iconFile: null as File | null,
  clearIcon: false,
  isActive: true,
})

const form = ref(emptyForm())

/** The merchant a branch is being created or edited under. */
const formMerchant = computed(
  () => merchants?.data.value?.find((item) => item.id === form.value.merchantId) ?? null,
)

/**
 * Only the chosen merchant's own cities.
 *
 * A branch may only operate where its merchant does, so offering every city
 * would invite a choice the backend then rejects. The merchant's `cities` array
 * is the backend's own answer to "where does this merchant trade", which is why
 * it is read rather than derived from the branch list.
 *
 * With no merchant chosen there is nothing to narrow by, so the list is empty
 * and the hint says what to do instead.
 */
const formCityOptions = computed<SelectOption[]>(() => {
  const merchant = formMerchant.value
  if (!merchant) return []

  const allowed = new Set(merchant.cities.map((city) => city.id))
  return (cities?.data.value?.items ?? [])
    .filter((city) => allowed.has(city.id))
    .map((city) => ({ value: city.id, label: city.name }))
})

/** The hint under the city field, which changes with what is selectable. */
const cityFieldHint = computed(() => {
  if (!form.value.merchantId) return t('offers.selectMerchantFirst')
  return formCityOptions.value.length
    ? t('branches.onlyMerchantCities')
    : t('branches.noMerchantCities')
})

/**
 * Changing the merchant drops a city that the new one does not trade in.
 *
 * A city left over from the previous merchant would be rejected on save; clearing
 * it only when it is actually invalid keeps a still-legal choice intact.
 */
watch(
  () => form.value.merchantId,
  () => {
    if (!form.value.cityId) return
    const stillValid = formCityOptions.value.some((option) => option.value === form.value.cityId)
    if (!stillValid) form.value.cityId = null
  },
)

function openCreate(): void {
  editing.value = null
  form.value = emptyForm()
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEdit(branch: MerchantBranch): void {
  editing.value = branch
  form.value = {
    merchantId: branch.merchantId,
    cityId: branch.cityId,
    name: branch.name,
    address: branch.address ?? '',
    latitude: branch.latitude,
    longitude: branch.longitude,
    phoneNumber: branch.phoneNumber ?? '',
    // No file chosen yet: each saved image is shown from its own `*Url` and kept
    // unless the user picks a replacement or removes it.
    backgroundFile: null,
    clearBackground: false,
    iconFile: null,
    clearIcon: false,
    isActive: branch.isActive,
  }
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

async function save(): Promise<void> {
  if (saving.value) return

  saving.value = true
  formError.value = null
  fieldErrors.value = {}

  try {
    // The fields both the JSON and the multipart surface need, shaped once.
    const common = {
      cityId: form.value.cityId,
      name: form.value.name.trim(),
      address: form.value.address.trim() || null,
      latitude: form.value.latitude.trim(),
      longitude: form.value.longitude.trim(),
      phoneNumber: form.value.phoneNumber.trim() || null,
      isActive: form.value.isActive,
    }

    // A clear only counts when no replacement was chosen for that image: picking
    // a new file supersedes the removal.
    const clearBackground = form.value.clearBackground && !form.value.backgroundFile
    const clearIcon = form.value.clearIcon && !form.value.iconFile

    // The multipart endpoints exist to carry files, so they are used only when
    // an image actually changed. An edit that touches nothing but, say, the phone
    // number stays on the JSON surface and never mentions the images at all —
    // which is what keeps a saved background from being dropped by an unrelated
    // edit.
    const touchesImages = Boolean(
      form.value.backgroundFile || form.value.iconFile || clearBackground || clearIcon,
    )

    if (editing.value) {
      if (touchesImages) {
        await patchBranchWithImages(editing.value.id, {
          ...common,
          merchantId: form.value.merchantId ?? '',
          backgroundFile: form.value.backgroundFile,
          iconFile: form.value.iconFile,
          clearBackground,
          clearIcon,
        })
      } else {
        // PATCH, so only the edited fields travel. Clearing the city needs the explicit
        // flag: a null cityId here would read as "leave it alone", not "remove it".
        await patchBranch(editing.value.id, {
          ...common,
          merchantId: form.value.merchantId,
          clearCity: form.value.cityId === null,
        })
      }
      toast.success(t('branches.updated'))
    } else {
      if (touchesImages) {
        await createBranchWithImages({
          ...common,
          merchantId: form.value.merchantId ?? '',
          backgroundFile: form.value.backgroundFile,
          iconFile: form.value.iconFile,
        })
      } else {
        await createBranch({ ...common, merchantId: form.value.merchantId ?? '' })
      }
      toast.success(t('branches.created'))
    }

    modalOpen.value = false
    await branches.refresh()
  } catch (error) {
    fieldErrors.value = fieldErrorsOf(error)
    formError.value = messageFor(error)
  } finally {
    saving.value = false
  }
}

async function removeBranch(branch: MerchantBranch): Promise<void> {
  const confirmed = await confirm({
    title: t('branches.deleteConfirmTitle'),
    body: t('branches.deleteConfirmBody', { name: branch.name }),
    confirmLabel: t('confirm.deleteConfirm'),
    destructive: true,
  })
  if (!confirmed) return

  try {
    await deleteBranch(branch.id)
    toast.success(t('branches.deleted'))
    await branches.refresh()
  } catch (error) {
    toast.error(t('errors.deleteFailed'), messageFor(error))
  }
}

function mapsUrl(branch: MerchantBranch): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${branch.latitude},${branch.longitude}`,
  )}`
}
</script>

<template>
  <div>
    <PageHeader :title="$t('branches.title')" :subtitle="$t('branches.subtitle')">
      <template #actions>
        <BaseButton v-if="can(P.BranchesCreate)" variant="primary" @click="openCreate">
          <template #icon><Plus class="size-4" /></template>
          {{ $t('branches.create') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseCard flush>
      <ListToolbar
        v-model:search="search"
        :has-filters="search.length > 0 || merchantFilter !== null"
        :result-count="branches.loaded.value ? filtered.length : null"
        @clear="
          () => {
            search = ''
            merchantFilter = null
          }
        "
      >
        <template v-if="merchantOptions.length" #filters>
          <div class="w-full sm:w-48">
            <BaseSelect
              v-model="merchantFilter"
              :options="merchantOptions"
              :placeholder="$t('branches.allMerchants')"
            />
          </div>
        </template>

        <!--
          Grouping by city only reads well for a single merchant, so the toggle
          appears once one is selected.
        -->
        <template v-if="canGroup" #actions>
          <BaseButton
            variant="secondary"
            size="md"
            @click="groupedView = !groupedView"
          >
            {{ groupedView ? $t('branches.title') : $t('branches.groupedByCity') }}
          </BaseButton>
        </template>
      </ListToolbar>

      <!--
        The city-grouped view: each of the merchant's cities, with its branches
        beneath it, mirroring the order branches are created in.
      -->
      <div v-if="groupedView && canGroup" class="divide-y divide-hairline">
        <section v-for="group in groupedByCity" :key="group.cityId ?? 'none'" class="px-4 py-3">
          <h3 class="flex items-center gap-2 text-sm font-semibold text-content">
            <MapPin class="size-4 shrink-0 text-content-subtle" aria-hidden="true" />
            {{ group.name }}
            <span class="text-xs font-normal text-content-subtle">
              {{ fmt.number(group.rows.length) }}
            </span>
          </h3>

          <ul class="mt-2 space-y-1.5">
            <li
              v-for="branch in group.rows"
              :key="branch.id"
              class="flex items-start justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2"
            >
              <div class="flex min-w-0 items-center gap-2.5">
                <EntityAvatar :src="branch.iconUrl" :name="branch.name" size="size-7" />
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-content">{{ branch.name }}</p>
                  <p class="truncate text-xs text-content-muted">
                    {{ $t('branches.location') }}:
                    {{ branch.address || `${branch.latitude}, ${branch.longitude}` }}
                  </p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1.5">
                <StatusBadge :active="branch.isActive" />
                <BaseButton
                  v-if="can(P.BranchesUpdate)"
                  variant="ghost"
                  size="sm"
                  @click="openEdit(branch)"
                >
                  {{ $t('common.edit') }}
                </BaseButton>
              </div>
            </li>
          </ul>
        </section>

        <p v-if="!groupedByCity.length" class="px-4 py-6 text-center text-sm text-content-subtle">
          {{ $t('branches.empty') }}
        </p>
      </div>

      <BaseTable
        v-else
        :columns="columns"
        :rows="filtered"
        row-key="id"
        :loading="branches.loading.value"
        :refreshing="branches.refreshing.value"
        :error="branches.error.value"
        :empty-title="$t('branches.empty')"
        :empty-body="$t('branches.emptyHint')"
        @retry="branches.refresh()"
      >
        <!--
          The icon stands in for the branch the way the logo does for a merchant.
          EntityAvatar falls back to the initial when there is none, so a branch
          without one still lines up with the rest of the column.
        -->
        <template #cell:name="{ row }">
          <div class="flex min-w-0 items-center gap-2.5">
            <EntityAvatar :src="row.iconUrl" :name="row.name" />
            <div class="min-w-0">
              <p class="truncate font-medium">{{ row.name }}</p>
              <p v-if="row.phoneNumber" class="truncate text-xs text-content-muted" dir="ltr">
                {{ row.phoneNumber }}
              </p>
            </div>
          </div>
        </template>

        <template #cell:merchantId="{ row }">
          <span class="text-content-muted">
            {{ merchantNames.get(row.merchantId) ?? fmt.shortId(row.merchantId) }}
          </span>
        </template>

        <template #cell:cityName="{ row }">
          <span class="text-content-muted">{{ row.cityName ?? '—' }}</span>
        </template>

        <template #cell:address="{ row }">
          <span class="text-content-muted">{{ row.address ?? '—' }}</span>
        </template>

        <template #cell:coordinates="{ row }">
          <a
            :href="mapsUrl(row)"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 font-mono text-xs text-primary-600
                   hover:underline dark:text-primary-400"
            dir="ltr"
            :title="$t('branches.openInMaps')"
          >
            {{ row.latitude }}, {{ row.longitude }}
            <ExternalLink class="size-3" aria-hidden="true" />
          </a>
        </template>

        <template #cell:isActive="{ row }">
          <StatusBadge :active="row.isActive" />
        </template>

        <template #cell:actions="{ row }">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton
              v-if="can(P.BranchesUpdate)"
              variant="secondary"
              size="sm"
              @click="openEdit(row)"
            >
              {{ $t('common.edit') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.BranchesDelete)"
              variant="ghost"
              size="sm"
              class="text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10"
              @click="removeBranch(row)"
            >
              {{ $t('common.delete') }}
            </BaseButton>
          </div>
        </template>

        <template #empty-action>
          <BaseButton v-if="can(P.BranchesCreate)" variant="primary" @click="openCreate">
            <template #icon><Plus class="size-4" /></template>
            {{ $t('branches.create') }}
          </BaseButton>
        </template>
      </BaseTable>
    </BaseCard>

    <BaseModal
      :open="modalOpen"
      :title="editing ? $t('branches.editTitle') : $t('branches.createTitle')"
      @close="modalOpen = false"
    >
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>

        <BaseSelect
          v-model="form.merchantId"
          :options="merchantOptions"
          :label="$t('branches.filterByMerchant')"
          :placeholder="$t('branches.allMerchants')"
          :errors="fieldErrors.merchantId"
          required
        />
        <!--
          Where this branch operates, narrowed to the merchant's own cities.
          Optional: a branch with no city is valid, and city-restricted offers
          simply never apply there. The backend validates the pairing regardless.
        -->
        <BaseSelect
          v-model="form.cityId"
          :options="formCityOptions"
          :label="$t('branches.city')"
          :placeholder="$t('branches.noCity')"
          :hint="cityFieldHint"
          :errors="fieldErrors.cityId"
          :disabled="!form.merchantId"
        />
        <BaseInput
          v-model="form.name"
          :label="$t('common.name')"
          :errors="fieldErrors.name"
          :maxlength="128"
          required
        />
        <BaseInput
          v-model="form.address"
          :label="$t('branches.address')"
          :errors="fieldErrors.address"
          :maxlength="256"
        />

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="form.latitude"
            :label="$t('branches.latitude')"
            :errors="fieldErrors.latitude"
            :maxlength="64"
            dir="ltr"
            placeholder="33.3152"
            required
          />
          <BaseInput
            v-model="form.longitude"
            :label="$t('branches.longitude')"
            :errors="fieldErrors.longitude"
            :maxlength="64"
            dir="ltr"
            placeholder="44.3661"
            required
          />
        </div>

        <!--
          The map writes back into the same two fields, so typing coordinates and
          dropping a pin are two views of one value rather than separate inputs.
        -->
        <MapPicker
          v-model:latitude="form.latitude"
          v-model:longitude="form.longitude"
          :label="$t('branches.location')"
        />

        <BaseInput
          v-model="form.phoneNumber"
          type="tel"
          inputmode="tel"
          :label="$t('branches.phoneNumber')"
          :errors="fieldErrors.phoneNumber"
          :maxlength="32"
          dir="ltr"
        />

        <!--
          Choosing a file makes no request: it is held here and sent with the
          branch when the form is saved. The two images are independent of each
          other, and an edit that touches neither leaves both alone.
        -->
        <ImageUploadField
          v-model="form.backgroundFile"
          v-model:cleared="form.clearBackground"
          :existing-url="editing?.backgroundUrl ?? null"
          :label="$t('branches.background')"
          :hint="$t('branches.backgroundHint')"
          :upload-label="$t('common.upload')"
          :errors="fieldErrors.background"
          :disabled="saving"
        />
        <ImageUploadField
          v-model="form.iconFile"
          v-model:cleared="form.clearIcon"
          :existing-url="editing?.iconUrl ?? null"
          :label="$t('branches.icon')"
          :hint="$t('branches.iconHint')"
          :upload-label="$t('common.upload')"
          :errors="fieldErrors.icon"
          :disabled="saving"
          compact
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
