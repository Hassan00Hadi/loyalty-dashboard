<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import BrandLogo from '@/components/layout/BrandLogo.vue'
import { useAuthStore } from '@/stores/auth.store'

/**
 * Catch-all route. Public, so it renders for a signed-out visitor too — in
 * which case it offers the login screen rather than the dashboard.
 */
const auth = useAuthStore()
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
    <BrandLogo :height="28" class="mb-8" />

    <p class="font-mono text-5xl font-semibold text-primary-600 dark:text-primary-400">404</p>
    <h1 class="mt-4 text-lg font-semibold text-content">{{ $t('states.notFoundTitle') }}</h1>
    <p class="mt-2 max-w-sm text-sm leading-relaxed text-content-muted">
      {{ $t('states.notFoundBody') }}
    </p>

    <BaseButton
      variant="primary"
      class="mt-6"
      @click="$router.push(auth.isAuthenticated ? { name: 'dashboard' } : { name: 'login' })"
    >
      {{ auth.isAuthenticated ? $t('states.goToDashboard') : $t('auth.signIn') }}
    </BaseButton>
  </div>
</template>
