<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import type { Permission } from '@/types/models'

/**
 * Picks a set of permissions, grouped as the backend groups them.
 *
 * Two rules from the API shape this:
 *
 *  - Permission *names* are stable identifiers and are never translated. Only
 *    the group heading is localised, and the raw name is shown in monospace so
 *    an administrator can match it against the API documentation.
 *  - Assignment is wholesale, so the model is the complete intended set of ids.
 */
const props = defineProps<{
  modelValue: string[]
  permissions: Permission[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const { t, te } = useI18n()

interface Group {
  key: string
  label: string
  items: Permission[]
}

const groups = computed<Group[]>(() => {
  const map = new Map<string, Permission[]>()
  for (const permission of props.permissions) {
    const existing = map.get(permission.group)
    if (existing) existing.push(permission)
    else map.set(permission.group, [permission])
  }

  return [...map.entries()].map(([key, items]) => ({
    key,
    // Falls back to the backend's own group name when no translation exists, so
    // a newly added group is never blank.
    label: te(`permissions.groups.${key}`) ? t(`permissions.groups.${key}`) : key,
    items,
  }))
})

const selected = computed(() => new Set(props.modelValue))

function toggle(id: string): void {
  const next = new Set(props.modelValue)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  emit('update:modelValue', [...next])
}

function groupState(group: Group): 'all' | 'some' | 'none' {
  const chosen = group.items.filter((item) => selected.value.has(item.id)).length
  if (chosen === 0) return 'none'
  return chosen === group.items.length ? 'all' : 'some'
}

function toggleGroup(group: Group): void {
  const next = new Set(props.modelValue)
  if (groupState(group) === 'all') {
    for (const item of group.items) next.delete(item.id)
  } else {
    for (const item of group.items) next.add(item.id)
  }
  emit('update:modelValue', [...next])
}

function selectAll(): void {
  emit('update:modelValue', props.permissions.map((permission) => permission.id))
}

function clearAll(): void {
  emit('update:modelValue', [])
}
</script>

<template>
  <div>
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm font-medium text-content">
        {{ $t('permissions.title') }}
        <span class="ms-1 text-xs font-normal text-content-muted">
          ({{ modelValue.length }}/{{ permissions.length }})
        </span>
      </p>
      <div class="flex gap-1.5">
        <BaseButton variant="ghost" size="sm" @click="selectAll">
          {{ $t('common.selectAll') }}
        </BaseButton>
        <BaseButton variant="ghost" size="sm" @click="clearAll">
          {{ $t('common.deselectAll') }}
        </BaseButton>
      </div>
    </div>

    <div class="max-h-[26rem] space-y-3 overflow-y-auto pe-1">
      <fieldset
        v-for="group in groups"
        :key="group.key"
        class="rounded-xl border border-hairline p-3"
      >
        <legend class="flex items-center gap-2 px-1">
          <label class="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              class="size-4 rounded border-hairline text-primary-600 focus:ring-primary-500"
              :checked="groupState(group) === 'all'"
              :indeterminate="groupState(group) === 'some'"
              @change="toggleGroup(group)"
            />
            <span class="text-xs font-semibold uppercase tracking-wide text-content">
              {{ group.label }}
            </span>
          </label>
        </legend>

        <div class="mt-1.5 grid gap-1 sm:grid-cols-2">
          <label
            v-for="permission in group.items"
            :key="permission.id"
            class="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-surface-muted"
          >
            <input
              type="checkbox"
              class="mt-0.5 size-4 shrink-0 rounded border-hairline text-primary-600 focus:ring-primary-500"
              :checked="selected.has(permission.id)"
              @change="toggle(permission.id)"
            />
            <span class="min-w-0">
              <!-- The identifier itself: never translated, shown LTR. -->
              <span class="block truncate font-mono text-[0.6875rem] text-content" dir="ltr">
                {{ permission.name }}
              </span>
              <span class="block text-xs leading-snug text-content-muted">
                {{ permission.description }}
              </span>
            </span>
          </label>
        </div>
      </fieldset>
    </div>
  </div>
</template>
