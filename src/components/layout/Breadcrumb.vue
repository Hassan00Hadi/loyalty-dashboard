<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui.store'

/**
 * Derives the trail from the matched route records.
 *
 * Each route carries a `breadcrumb` i18n key in its meta, so the trail needs no
 * separate registry and cannot drift from the router.
 */
const route = useRoute()
const ui = useUiStore()

const Separator = computed(() => (ui.isRtl ? ChevronLeft : ChevronRight))

interface Crumb {
  labelKey: string
  to?: string
}

const crumbs = computed<Crumb[]>(() =>
  route.matched
    .filter((record) => typeof record.meta.breadcrumb === 'string')
    .map((record, index, all) => ({
      labelKey: record.meta.breadcrumb as string,
      // The last crumb is the current page, so it is not a link.
      to: index < all.length - 1 ? record.path : undefined,
    })),
)
</script>

<template>
  <nav v-if="crumbs.length > 1" :aria-label="$t('a11y.breadcrumb')">
    <ol class="flex flex-wrap items-center gap-1 text-xs text-content-muted">
      <li v-for="(crumb, index) in crumbs" :key="crumb.labelKey" class="flex items-center gap-1">
        <component
          :is="Separator"
          v-if="index > 0"
          class="size-3 shrink-0 text-content-subtle"
          aria-hidden="true"
        />
        <RouterLink
          v-if="crumb.to"
          :to="crumb.to"
          class="rounded transition hover:text-content hover:underline"
        >
          {{ $t(crumb.labelKey) }}
        </RouterLink>
        <span v-else class="font-medium text-content" aria-current="page">
          {{ $t(crumb.labelKey) }}
        </span>
      </li>
    </ol>
  </nav>
</template>
