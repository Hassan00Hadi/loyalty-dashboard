<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

withDefaults(
  defineProps<{
    /** Which edge of the trigger the panel aligns to. Logical, so it mirrors. */
    align?: 'start' | 'end'
    width?: string
  }>(),
  { align: 'end', width: 'w-56' },
)

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function close(): void {
  open.value = false
}

function toggle(): void {
  open.value = !open.value
}

function onDocumentClick(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) close()
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})

defineExpose({ close })
</script>

<template>
  <div ref="root" class="relative">
    <div :aria-expanded="open" aria-haspopup="menu" @click="toggle">
      <slot name="trigger" :open="open" />
    </div>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        role="menu"
        class="absolute z-30 mt-1.5 origin-top overflow-hidden rounded-xl border border-hairline
               bg-surface p-1 shadow-raised"
        :class="[width, align === 'end' ? 'end-0' : 'start-0']"
        @click="close"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>
