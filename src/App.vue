<script setup lang="ts">
import ToastHost from '@/components/ui/ToastHost.vue'

/**
 * The root is deliberately thin: the layout for each area is chosen by the
 * router, and the only thing mounted app-wide is the toast host.
 */
</script>

<template>
  <RouterView />
  <ToastHost />
</template>
