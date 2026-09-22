<script setup lang="ts">
import { computed, useId } from 'vue'

export interface CheckboxOption {
  value: string
  label: string
  /** Secondary text, e.g. a branch's city or a count. */
  meta?: string
  disabled?: boolean
}

/**
 * A set of checkboxes bound to an array of selected ids.
 *
 * Used wherever the backend takes a list of ids — a merchant's cities, an
 * offer's tiers, an offer's branches. The component only reports what is ticked;
 * every rule about which combinations are legal belongs to the caller and,
 * finally, to the server.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string[]
    options: CheckboxOption[]
    label?: string
    hint?: string
    errors?: string[]
    disabled?: boolean
    /** Message shown in place of the list when there is nothing to choose from. */
    emptyText?: string
    /** Caps the height and scrolls, for lists that can grow long. */
    scroll?: boolean
    columns?: boolean
  }>(),
  { disabled: false, scroll: false, columns: true },
)

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const id = useId()
const hasError = computed(() => Boolean(props.errors?.length))
const selected = computed(() => new Set(props.modelValue))

function toggle(value: string): void {
  if (props.disabled) return

  const next = new Set(props.modelValue)
  if (next.has(value)) {
    next.delete(value)
  } else {
    next.add(value)
  }

  // Emitted in the options' own order so the payload is stable regardless of
  // the order boxes were ticked in.
  emit(
    'update:modelValue',
    props.options.filter((option) => next.has(option.value)).map((option) => option.value),
  )
}
</script>

<template>
  <fieldset class="w-full" :disabled="disabled">
    <legend v-if="label" class="mb-1.5 block text-sm font-medium text-content">
      {{ label }}
    </legend>

    <p v-if="!options.length" class="text-xs text-content-subtle">
      {{ emptyText ?? $t('common.none') }}
    </p>

    <div
      v-else
      class="grid gap-1"
      :class="[
        columns ? 'sm:grid-cols-2' : '',
        scroll ? 'max-h-48 overflow-y-auto rounded-lg border border-hairline p-2' : '',
      ]"
      :aria-describedby="hasError ? `${id}-error` : undefined"
    >
      <label
        v-for="option in options"
        :key="option.value"
        class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm
               hover:bg-surface-muted"
        :class="option.disabled || disabled ? 'cursor-not-allowed opacity-60' : ''"
      >
        <input
          type="checkbox"
          class="size-4 shrink-0 rounded border-hairline text-primary-600
                 focus:ring-2 focus:ring-primary-500"
          :checked="selected.has(option.value)"
          :disabled="option.disabled || disabled"
          @change="toggle(option.value)"
        />
        <span class="min-w-0 flex-1 truncate text-content">{{ option.label }}</span>
        <span v-if="option.meta" class="shrink-0 text-xs text-content-subtle">
          {{ option.meta }}
        </span>
      </label>
    </div>

    <p v-if="hint && !hasError" class="mt-1.5 text-xs text-content-muted">{{ hint }}</p>
    <p v-if="hasError" :id="`${id}-error`" class="mt-1.5 text-xs font-medium text-danger-600">
      {{ errors?.[0] }}
    </p>
  </fieldset>
</template>
