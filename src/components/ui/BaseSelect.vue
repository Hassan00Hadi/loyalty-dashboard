<script setup lang="ts">
import { computed, useId } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

export interface SelectOption {
  value: string | number | null
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null | undefined
    options: SelectOption[]
    label?: string
    placeholder?: string
    hint?: string
    errors?: string[]
    required?: boolean
    disabled?: boolean
  }>(),
  { required: false, disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string | number | null] }>()

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

/**
 * The placeholder maps to the empty string in the DOM and back to `null` in the
 * model, so "no filter" and "not chosen" are the same value the API expects to
 * be absent.
 */
function onChange(event: Event): void {
  const raw = (event.target as HTMLSelectElement).value
  if (raw === '') {
    emit('update:modelValue', null)
    return
  }
  const match = props.options.find((option) => String(option.value) === raw)
  emit('update:modelValue', match ? match.value : raw)
}
</script>

<template>
  <div class="w-full">
    <label v-if="label" :for="id" class="mb-1.5 block text-sm font-medium text-content">
      {{ label }}
      <span v-if="required" class="text-danger-600" :aria-label="$t('a11y.required')">*</span>
    </label>

    <div class="relative">
      <select
        :id="id"
        :value="modelValue === null || modelValue === undefined ? '' : String(modelValue)"
        :required="required"
        :disabled="disabled"
        :aria-invalid="hasError || undefined"
        :aria-describedby="describedBy"
        class="field-base cursor-pointer appearance-none pe-9"
        :class="hasError ? 'field-invalid' : ''"
        @change="onChange"
      >
        <option v-if="placeholder" value="">{{ placeholder }}</option>
        <option
          v-for="option in options"
          :key="String(option.value)"
          :value="String(option.value)"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </option>
      </select>

      <!-- `end-3` rather than `right-3` so the chevron follows the text direction. -->
      <ChevronDown
        class="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-content-subtle"
        aria-hidden="true"
      />
    </div>

    <p v-if="hint && !hasError" :id="hintId" class="mt-1.5 text-xs text-content-muted">
      {{ hint }}
    </p>
    <p v-if="hasError" :id="errorId" class="mt-1.5 text-xs font-medium text-danger-600">
      {{ errors?.[0] }}
    </p>
  </div>
</template>
