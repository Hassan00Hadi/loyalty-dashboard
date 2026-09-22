<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseToggle from '@/components/ui/BaseToggle.vue'
import ListToolbar from '@/components/ui/ListToolbar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseTable, { type TableColumn } from '@/components/tables/BaseTable.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import ImageUploadField from '@/components/forms/ImageUploadField.vue'
import {
  createCategoryWithIcon,
  listCategories,
  updateCategory,
  updateCategoryWithIcon,
} from '@/api/catalog.api'
import { useApiError } from '@/composables/useApiError'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useFormat } from '@/composables/useFormat'
import { usePermissions } from '@/composables/usePermissions'
import { useToastStore } from '@/stores/toast.store'
import { P } from '@/utils/permissions'
import { resolveAssetUrl } from '@/utils/assets'
import type { AdminCategory } from '@/types/models'

/**
 * Categories.
 *
 * The list endpoint is unpaged, so filtering happens in memory here rather than
 * being pushed to the server — there is no query parameter for it to use.
 * The API offers no DELETE, so retiring a category means deactivating it; the
 * page says so instead of offering an action that would fail.
 */
const { t } = useI18n()
const toast = useToastStore()
const fmt = useFormat()
const { can } = usePermissions()
const { messageFor, fieldErrorsOf } = useApiError()

const resource = useAsyncResource(() => listCategories(), {
  errorTitleKey: 'errors.loadCategoriesFailed',
  toastOnError: false,
})

const search = ref('')

/**
 * Categories whose icon the browser could not load.
 *
 * An image is fetched by the browser directly, with no `Authorization` header,
 * so a URL can fail for reasons this page cannot see — a deleted attachment
 * (404) or an unauthenticated read (401). Those rows fall back to no icon
 * rather than showing a broken image.
 */
const failedIcons = reactive(new Set<string>())

const filtered = computed(() => {
  const all = resource.data.value ?? []
  const term = search.value.trim().toLowerCase()
  if (!term) return all
  return all.filter((category) => category.name.toLowerCase().includes(term))
})

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('categories.category') },
  { key: 'merchantCount', label: t('categories.merchantCount'), align: 'end', hideBelow: 'sm' },
  { key: 'isActive', label: t('common.status') },
  { key: 'createdAt', label: t('common.createdAt'), hideBelow: 'lg' },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

// ── Create / edit ─────────────────────────────────────────────────────────────

const modalOpen = ref(false)
const editing = ref<AdminCategory | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})

/**
 * The form as the user fills it in.
 *
 * The icon is the chosen `File` itself, not an attachment id: it is sent with
 * the category in one multipart request, and the backend creates and owns the
 * attachment. `clearIcon` records that a saved icon was removed, which a null
 * file alone cannot express — that just means "unchanged".
 */
const form = ref({
  name: '',
  iconFile: null as File | null,
  clearIcon: false,
  isActive: true,
})

function openCreate(): void {
  editing.value = null
  form.value = { name: '', iconFile: null, clearIcon: false, isActive: true }
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEdit(category: AdminCategory): void {
  editing.value = category
  form.value = {
    name: category.name,
    // No file chosen yet: the saved icon is shown from `iconUrl` and kept unless
    // the user picks a replacement or removes it.
    iconFile: null,
    clearIcon: false,
    isActive: category.isActive,
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
    // One request, image included.
    const payload = {
      name: form.value.name.trim(),
      iconFile: form.value.iconFile,
      isActive: form.value.isActive,
    }

    if (editing.value) {
      await updateCategoryWithIcon(editing.value.id, {
        ...payload,
        // Only meaningful when no replacement was chosen; the server ignores it
        // otherwise.
        clearIcon: form.value.clearIcon && !form.value.iconFile,
      })
      toast.success(t('categories.updated'))
    } else {
      await createCategoryWithIcon(payload)
      toast.success(t('categories.created'))
    }

    modalOpen.value = false
    await resource.refresh()
  } catch (error) {
    fieldErrors.value = fieldErrorsOf(error)
    formError.value = messageFor(error)
  } finally {
    saving.value = false
  }
}

/** Status is toggled straight from the row: it is the only lifecycle action. */
async function toggleActive(category: AdminCategory): Promise<void> {
  try {
    await updateCategory(category.id, { isActive: !category.isActive })
    toast.success(t('categories.updated'))
    await resource.refresh()
  } catch (error) {
    toast.error(t('errors.saveFailed'), messageFor(error))
  }
}
</script>

<template>
  <div>
    <PageHeader :title="$t('categories.title')" :subtitle="$t('categories.subtitle')">
      <template #actions>
        <BaseButton v-if="can(P.CategoriesCreate)" variant="primary" @click="openCreate">
          <template #icon><Plus class="size-4" /></template>
          {{ $t('categories.create') }}
        </BaseButton>
      </template>
    </PageHeader>

    <BaseCard flush>
      <ListToolbar
        v-model:search="search"
        :search-placeholder="$t('common.searchPlaceholder')"
        :has-filters="search.length > 0"
        :result-count="resource.loaded.value ? filtered.length : null"
        @clear="search = ''"
      />

      <BaseTable
        :columns="columns"
        :rows="filtered"
        row-key="id"
        :loading="resource.loading.value"
        :refreshing="resource.refreshing.value"
        :error="resource.error.value"
        :empty-title="$t('categories.empty')"
        :empty-body="$t('categories.emptyHint')"
        @retry="resource.refresh()"
      >
        <template #cell:name="{ row }">
          <div class="flex items-center gap-2.5">
            <!--
              `v-if` on the URL keeps the no-icon row unchanged: no placeholder
              is shown when a category simply has no icon. `@error` covers the
              case where the URL exists but the browser cannot load it.
            -->
            <img
              v-if="row.iconUrl && !failedIcons.has(row.id)"
              :src="resolveAssetUrl(row.iconUrl)!"
              :alt="''"
              class="size-7 shrink-0 rounded-lg object-cover"
              loading="lazy"
              @error="failedIcons.add(row.id)"
            />
            <span class="font-medium">{{ row.name }}</span>
          </div>
        </template>

        <template #cell:merchantCount="{ row }">
          <span class="tabular-nums">{{ fmt.number(row.merchantCount) }}</span>
        </template>

        <template #cell:isActive="{ row }">
          <StatusBadge :active="row.isActive" />
        </template>

        <template #cell:createdAt="{ row }">
          <span class="text-content-muted">{{ fmt.date(row.createdAt) }}</span>
        </template>

        <template #cell:actions="{ row }">
          <div class="flex items-center justify-end gap-1.5">
            <BaseButton
              v-if="can(P.CategoriesUpdate)"
              variant="ghost"
              size="sm"
              @click="toggleActive(row)"
            >
              {{ row.isActive ? $t('common.deactivate') : $t('common.activate') }}
            </BaseButton>
            <BaseButton
              v-if="can(P.CategoriesUpdate)"
              variant="secondary"
              size="sm"
              @click="openEdit(row)"
            >
              {{ $t('common.edit') }}
            </BaseButton>
          </div>
        </template>

        <template #empty-action>
          <BaseButton v-if="can(P.CategoriesCreate)" variant="primary" @click="openCreate">
            <template #icon><Plus class="size-4" /></template>
            {{ $t('categories.create') }}
          </BaseButton>
        </template>
      </BaseTable>

      <template #footer>
        <p class="text-xs text-content-subtle">{{ $t('categories.noDeleteNote') }}</p>
      </template>
    </BaseCard>

    <BaseModal
      :open="modalOpen"
      :title="editing ? $t('categories.editTitle') : $t('categories.createTitle')"
      @close="modalOpen = false"
    >
      <form class="space-y-4" novalidate @submit.prevent="save">
        <BaseAlert v-if="formError" variant="error">{{ formError }}</BaseAlert>

        <BaseInput
          v-model="form.name"
          :label="$t('common.name')"
          :errors="fieldErrors.name"
          :maxlength="128"
          required
        />
        <!--
          Choosing a file makes no request: it is held here and sent with the
          category when the form is saved.
        -->
        <ImageUploadField
          v-model="form.iconFile"
          v-model:cleared="form.clearIcon"
          :existing-url="editing?.iconUrl ?? null"
          :label="$t('categories.icon')"
          :hint="$t('categories.iconHint')"
          :upload-label="$t('common.uploadIcon')"
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
        <!-- `loading` also disables, which is what prevents a double submit. -->
        <BaseButton variant="primary" :loading="saving" @click="save">
          {{ saving ? $t('common.saving') : editing ? $t('common.saveChanges') : $t('common.create') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
