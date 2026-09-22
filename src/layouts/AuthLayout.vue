<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Globe } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BrandLogo from '@/components/layout/BrandLogo.vue'
import { useUiStore } from '@/stores/ui.store'
import { setI18nLocale } from '@/i18n'

/**
 * Chrome for unauthenticated screens: the brand mark, a language toggle, and a
 * centred slot.
 *
 * The login page currently renders this shell inline so it can own its own
 * background treatment; this layout is here for any further pre-auth screen
 * (a password reset, say) to reuse without duplicating the header.
 */
const ui = useUiStore()
const { locale } = useI18n()

function toggleLocale(): void {
  const next = locale.value === 'ar' ? 'en' : 'ar'
  ui.setLocale(next)
  setI18nLocale(next)
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-canvas">
    <header class="flex items-center justify-between px-4 py-4 sm:px-6">
      <BrandLogo :height="26" />
      <BaseButton variant="ghost" size="sm" @click="toggleLocale">
        <template #icon><Globe class="size-4" /></template>
        {{ locale === 'ar' ? 'English' : 'العربية' }}
      </BaseButton>
    </header>

    <main class="flex flex-1 items-center justify-center px-4 py-8">
      <div class="w-full max-w-[26rem]">
        <slot />
      </div>
    </main>

    <footer class="px-4 py-4 text-center text-xs text-content-subtle">
      {{ $t('auth.footerNote') }}
    </footer>
  </div>
</template>
