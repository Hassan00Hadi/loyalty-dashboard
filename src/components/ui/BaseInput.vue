<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null | undefined
    label?: string
    type?: string
    placeholder?: string
    hint?: string
    /** Messages from the server or local validation; the first is displayed. */
    errors?: string[]
    required?: boolean
    disabled?: boolean
    readonly?: boolean
    autocomplete?: string
    inputmode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'email' | 'url' | 'search'
    min?: number | string
    max?: number | string
    step?: number | string
    maxlength?: number
    dir?: 'ltr' | 'rtl' | 'auto'
    monospace?: boolean
  }>(),
  { type: 'text', required: false, disabled: false, readonly: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: []
}>()

const id = useId()
const errorId = computed(() => `${id}-error`)
const hintId = computed(() => `${id}-hint`)

const hasError = computed(() => Boolean(props.errors?.length))
const firstError = computed(() => props.errors?.[0])

// Identifiers, codes and coordinates read wrongly when mirrored, so those
// fields opt into LTR even in an RTL layout.
const resolvedDir = computed(() => props.dir ?? 'auto')

const describedBy = computed(() => {
  const ids: string[] = []
  if (props.hint) ids.push(hintId.value)
  if (hasError.value) ids.push(errorId.value)
  return ids.length ? ids.join(' ') : undefined
})
</script>

<template>
  <div class="w-full">
    <label v-if="label" :for="id" class="mb-1.5 block text-sm font-medium text-content">
      {{ label }}
      <span v-if="required" class="text-danger-600" :aria-label="$t('a11y.required')">*</span>
    </label>

    <input
      :id="id"
      :value="modelValue ?? ''"
      :type="type"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :readonly="readonly"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      :min="min"
      :max="max"
      :step="step"
      :maxlength="maxlength"
      :dir="resolvedDir"
      :aria-invalid="hasError || undefined"
      :aria-describedby="describedBy"
      class="field-base"
      :class="[hasError ? 'field-invalid' : '', monospace ? 'font-mono text-[0.8125rem]' : '']"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @blur="emit('blur')"
    />

    <p v-if="hint && !hasError" :id="hintId" class="mt-1.5 text-xs text-content-muted">
      {{ hint }}
    </p>
    <p v-if="hasError" :id="errorId" class="mt-1.5 text-xs font-medium text-danger-600">
      {{ firstError }}
    </p>
  </div>
</template>
