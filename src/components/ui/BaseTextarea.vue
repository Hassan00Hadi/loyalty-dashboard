<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string | null | undefined
    label?: string
    placeholder?: string
    hint?: string
    errors?: string[]
    required?: boolean
    disabled?: boolean
    rows?: number
    maxlength?: number
  }>(),
  { required: false, disabled: false, rows: 3 },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const id = useId()
const errorId = computed(() => `${id}-error`)
const hintId = computed(() => `${id}-hint`)
const hasError = computed(() => Boolean(props.errors?.length))

const describedBy = computed(() => {
  const ids: string[] = []
  if (props.hint) ids.push(hintId.value)
  if (hasError.value) ids.push(errorId.value)
  return ids.length ? ids.join(' ') : undefined
})

const remaining = computed(() =>
  props.maxlength ? props.maxlength - (props.modelValue?.length ?? 0) : null,
)
</script>

<template>
  <div class="w-full">
    <label v-if="label" :for="id" class="mb-1.5 block text-sm font-medium text-content">
      {{ label }}
      <span v-if="required" class="text-danger-600" :aria-label="$t('a11y.required')">*</span>
    </label>

    <textarea
      :id="id"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :rows="rows"
      :maxlength="maxlength"
      :aria-invalid="hasError || undefined"
      :aria-describedby="describedBy"
      class="field-base resize-y"
      :class="hasError ? 'field-invalid' : ''"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />

    <div class="mt-1.5 flex items-start justify-between gap-3">
      <p v-if="hint && !hasError" :id="hintId" class="text-xs text-content-muted">{{ hint }}</p>
      <p v-if="hasError" :id="errorId" class="text-xs font-medium text-danger-600">
        {{ errors?.[0] }}
      </p>
      <span v-if="remaining !== null" class="ms-auto shrink-0 text-xs text-content-subtle">
        {{ remaining }}
      </span>
    </div>
  </div>
</template>
