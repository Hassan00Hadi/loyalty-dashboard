<script setup lang="ts">
import { computed } from 'vue'
import { navigation, type NavItem } from './navigation'
import { usePermissions } from '@/composables/usePermissions'

const props = withDefaults(
  defineProps<{
    /** Icon-only rail. Ignored in the mobile drawer, which is always expanded. */
    collapsed?: boolean
  }>(),
  { collapsed: false },
)

const emit = defineEmits<{ navigate: [] }>()

const { canAny } = usePermissions()

function isVisible(item: NavItem): boolean {
  return !item.anyPermission || canAny(...item.anyPermission)
}

/**
 * Sections whose every entry is hidden are dropped along with their heading, so
 * a limited role sees a shorter menu rather than empty group labels.
 */
const visibleSections = computed(() =>
  navigation
    .map((section) => ({ ...section, items: section.items.filter(isVisible) }))
    .filter((section) => section.items.length > 0),
)
</script>

<template>
  <nav class="flex flex-col gap-5 p-3" :aria-label="$t('nav.mainNavigation')">
    <div v-for="(section, index) in visibleSections" :key="section.labelKey ?? index">
      <p
        v-if="section.labelKey && !props.collapsed"
        class="mb-1.5 px-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-content-subtle"
      >
        {{ $t(section.labelKey) }}
      </p>
      <!-- Collapsed rail: a hairline stands in for the dropped heading. -->
      <div v-else-if="section.labelKey" class="mx-auto mb-2 h-px w-6 bg-hairline" aria-hidden="true" />

      <ul class="space-y-0.5">
        <li v-for="item in section.items" :key="item.name">
          <!--
            `custom` gives access to `isActive` for styling while still
            rendering a real anchor, so the link keeps its native behaviour.
          -->
          <RouterLink v-slot="{ href, navigate, isActive }" :to="{ name: item.name }" custom>
            <a
              :href="href"
              class="group flex items-center gap-2.5 rounded-lg text-sm font-medium transition"
              :class="[
                props.collapsed ? 'justify-center px-2 py-2.5' : 'px-2.5 py-2',
                isActive
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-content-muted hover:bg-surface-muted hover:text-content',
              ]"
              :aria-current="isActive ? 'page' : undefined"
              :title="props.collapsed ? $t(item.labelKey) : undefined"
              @click="
                (event: MouseEvent) => {
                  navigate(event)
                  emit('navigate')
                }
              "
            >
              <component
                :is="item.icon"
                class="size-[1.125rem] shrink-0"
                :class="isActive ? 'text-white' : 'text-content-subtle group-hover:text-content'"
                aria-hidden="true"
              />
              <span v-if="!props.collapsed" class="min-w-0 flex-1 truncate">
                {{ $t(item.labelKey) }}
              </span>
              <span v-else class="sr-only">{{ $t(item.labelKey) }}</span>
            </a>
          </RouterLink>
        </li>
      </ul>
    </div>
  </nav>
</template>
