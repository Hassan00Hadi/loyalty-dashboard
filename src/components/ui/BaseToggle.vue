<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean | null | undefined
    label?: string
    hint?: string
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const id = useId()
const hintId = computed(() => `${id}-hint`)
const checked = computed(() => props.modelValue === true)
</script>

<template>
  <div class="flex items-start gap-3">
    <!--
      A real checkbox, restyled. Using the native control keeps keyboard
      operation, form association and screen-reader semantics for free.
    -->
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="checked"
      :aria-describedby="hint ? hintId : undefined"
      :disabled="disabled"
      class="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full
             transition disabled:cursor-not-allowed disabled:opacity-50"
      :class="checked ? 'bg-primary-600' : 'bg-hairline'"
      @click="emit('update:modelValue', !checked)"
    >
      <!--
        Translating by a logical margin would not mirror, so the knob is placed
        with `start`/`end` insets which do follow direction.
      -->
      <span
        class="absolute size-3.5 rounded-full bg-white shadow-sm transition-all"
        :class="checked ? 'start-auto end-1' : 'start-1 end-auto'"
      />
    </button>

    <div v-if="label || hint" class="min-w-0">
      <label :for="id" class="block cursor-pointer text-sm font-medium text-content">
        {{ label }}
      </label>
      <p v-if="hint" :id="hintId" class="mt-0.5 text-xs text-content-muted">{{ hint }}</p>
    </div>
  </div>
</template>
