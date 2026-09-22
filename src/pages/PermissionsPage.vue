<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseErrorState from '@/components/ui/BaseErrorState.vue'
import BaseSkeleton from '@/components/ui/BaseSkeleton.vue'
import ListToolbar from '@/components/ui/ListToolbar.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { listPermissions } from '@/api/roles.api'
import { useAsyncResource } from '@/composables/useAsyncResource'

/**
 * The permission catalogue.
 *
 * Read-only by design: the backend declares these in code and reconciles the
 * database against that declaration, so there is no create or edit endpoint.
 * The page says as much and points to roles instead.
 */
const { t, te } = useI18n()

const permissions = useAsyncResource(() => listPermissions(), {
  errorTitleKey: 'errors.loadPermissionsFailed',
  toastOnError: false,
})

const search = ref('')

const groups = computed(() => {
  const term = search.value.trim().toLowerCase()
  const all = (permissions.data.value ?? []).filter(
    (permission) =>
      !term ||
      permission.name.toLowerCase().includes(term) ||
      permission.description.toLowerCase().includes(term),
  )

  const map = new Map<string, typeof all>()
  for (const permission of all) {
    const existing = map.get(permission.group)
    if (existing) existing.push(permission)
    else map.set(permission.group, [permission])
  }

  return [...map.entries()].map(([key, items]) => ({
    key,
    label: te(`permissions.groups.${key}`) ? t(`permissions.groups.${key}`) : key,
    items,
  }))
})

const totalShown = computed(() =>
  groups.value.reduce((sum, group) => sum + group.items.length, 0),
)
</script>

<template>
  <div>
    <PageHeader :title="$t('permissions.title')" :subtitle="$t('permissions.subtitle')" />

    <BaseAlert variant="info" class="mb-4">{{ $t('permissions.readOnlyNote') }}</BaseAlert>

    <BaseCard flush>
      <ListToolbar
        v-model:search="search"
        :has-filters="search.length > 0"
        :result-count="permissions.loaded.value ? totalShown : null"
        @clear="search = ''"
      />

      <div v-if="permissions.loading.value" class="space-y-3 p-4">
        <BaseSkeleton v-for="block in 4" :key="block" height="h-24" rounded="rounded-xl" />
      </div>

      <BaseErrorState
        v-else-if="permissions.error.value"
        :error="permissions.error.value"
        compact
        @retry="permissions.refresh()"
      />

      <div v-else-if="totalShown === 0" class="p-8 text-center">
        <p class="text-sm font-semibold text-content">{{ $t('permissions.empty') }}</p>
        <p class="mt-1 text-sm text-content-muted">{{ $t('permissions.emptyHint') }}</p>
      </div>

      <div v-else class="divide-y divide-hairline">
        <section v-for="group in groups" :key="group.key" class="px-4 py-4">
          <div class="mb-2.5 flex items-center gap-2">
            <h2 class="text-xs font-semibold uppercase tracking-wide text-content">
              {{ group.label }}
            </h2>
            <BaseBadge size="sm">{{ group.items.length }}</BaseBadge>
          </div>

          <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <div
              v-for="permission in group.items"
              :key="permission.id"
              class="rounded-lg border border-hairline bg-surface-muted/50 px-3 py-2"
            >
              <!-- The key is the contract; it is shown verbatim and LTR. -->
              <p class="truncate font-mono text-xs font-medium text-content" dir="ltr">
                {{ permission.name }}
              </p>
              <p class="mt-0.5 text-xs leading-snug text-content-muted">
                {{ permission.description }}
              </p>
            </div>
          </div>
        </section>
      </div>
    </BaseCard>
  </div>
</template>
