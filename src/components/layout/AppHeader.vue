<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  Check,
  Globe,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  UserCircle,
} from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDropdown from '@/components/ui/BaseDropdown.vue'
import DropdownItem from '@/components/ui/DropdownItem.vue'
import Breadcrumb from './Breadcrumb.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore, type ThemeMode } from '@/stores/ui.store'
import { setI18nLocale } from '@/i18n'
import { useToastStore } from '@/stores/toast.store'

const auth = useAuthStore()
const ui = useUiStore()
const toast = useToastStore()
const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()

const pageTitle = computed(() =>
  route.meta.titleKey ? t(route.meta.titleKey as string) : t('app.shortName'),
)

/**
 * Switching language updates both the i18n instance and the store, which owns
 * the `lang`/`dir` attributes on `<html>`. The route is untouched, so the user
 * stays exactly where they were.
 */
function switchLocale(next: 'en' | 'ar'): void {
  if (next === ui.locale) return
  ui.setLocale(next)
  setI18nLocale(next)
}

const themeOptions: { value: ThemeMode; labelKey: string; icon: typeof Sun }[] = [
  { value: 'light', labelKey: 'theme.light', icon: Sun },
  { value: 'dark', labelKey: 'theme.dark', icon: Moon },
  { value: 'system', labelKey: 'theme.system', icon: Monitor },
]

const ThemeIcon = computed(() => (ui.isDark ? Moon : Sun))

function signOut(): void {
  auth.logout()
  toast.info(t('auth.signedOut'))
  void router.push({ name: 'login' })
}
</script>

<template>
  <header
    class="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-hairline
           bg-surface/90 px-3 backdrop-blur sm:px-4"
  >
    <!-- Drawer trigger below `lg`; the rail toggle takes over from `lg` up. -->
    <BaseButton
      variant="ghost"
      size="sm"
      icon-only
      :label="$t('nav.openMenu')"
      class="lg:hidden"
      @click="ui.openMobileNav()"
    >
      <template #icon><Menu class="size-5" /></template>
    </BaseButton>

    <BaseButton
      variant="ghost"
      size="sm"
      icon-only
      :label="$t('nav.toggleSidebar')"
      class="hidden lg:inline-flex"
      @click="ui.toggleSidebar()"
    >
      <template #icon>
        <PanelLeftOpen v-if="ui.sidebarCollapsed" class="size-5 rtl:rotate-180" />
        <PanelLeftClose v-else class="size-5 rtl:rotate-180" />
      </template>
    </BaseButton>

    <div class="min-w-0 flex-1">
      <Breadcrumb class="hidden sm:block" />
      <h1 class="truncate text-sm font-semibold text-content sm:hidden">{{ pageTitle }}</h1>
    </div>

    <!-- Language -->
    <BaseDropdown width="w-40">
      <template #trigger>
        <BaseButton variant="ghost" size="sm" icon-only :label="$t('language.change')">
          <template #icon><Globe class="size-[1.125rem]" /></template>
        </BaseButton>
      </template>

      <DropdownItem :active="locale === 'en'" @click="switchLocale('en')">
        {{ $t('language.english') }}
        <template v-if="locale === 'en'" #trailing>
          <Check class="size-3.5 text-primary-600 dark:text-primary-400" />
        </template>
      </DropdownItem>
      <DropdownItem :active="locale === 'ar'" @click="switchLocale('ar')">
        {{ $t('language.arabic') }}
        <template v-if="locale === 'ar'" #trailing>
          <Check class="size-3.5 text-primary-600 dark:text-primary-400" />
        </template>
      </DropdownItem>
    </BaseDropdown>

    <!-- Theme -->
    <BaseDropdown width="w-40">
      <template #trigger>
        <BaseButton variant="ghost" size="sm" icon-only :label="$t('theme.toggle')">
          <template #icon><component :is="ThemeIcon" class="size-[1.125rem]" /></template>
        </BaseButton>
      </template>

      <DropdownItem
        v-for="option in themeOptions"
        :key="option.value"
        :active="ui.theme === option.value"
        @click="ui.setTheme(option.value)"
      >
        <template #icon><component :is="option.icon" class="size-4" /></template>
        {{ $t(option.labelKey) }}
        <template v-if="ui.theme === option.value" #trailing>
          <Check class="size-3.5 text-primary-600 dark:text-primary-400" />
        </template>
      </DropdownItem>
    </BaseDropdown>

    <!-- User -->
    <BaseDropdown width="w-60">
      <template #trigger>
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg p-1 transition hover:bg-surface-muted"
          :aria-label="$t('a11y.userMenu')"
        >
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-600
                   text-xs font-semibold text-white"
            aria-hidden="true"
          >
            {{ auth.initials }}
          </span>
          <span class="hidden min-w-0 text-start md:block">
            <span class="block max-w-[10rem] truncate text-xs font-semibold text-content">
              {{ auth.fullName }}
            </span>
            <span class="block max-w-[10rem] truncate text-[0.6875rem] text-content-muted">
              {{ auth.roleNames.join(', ') || $t('admins.noRoles') }}
            </span>
          </span>
        </button>
      </template>

      <div class="border-b border-hairline px-2.5 pb-2 pt-1">
        <p class="truncate text-sm font-semibold text-content">{{ auth.fullName }}</p>
        <p class="truncate text-xs text-content-muted">{{ auth.admin?.email }}</p>
        <p class="mt-1 text-[0.6875rem] text-content-subtle">
          {{ $t('auth.permissionCount', { count: auth.permissions.size }) }}
        </p>
      </div>

      <div class="pt-1">
        <DropdownItem @click="router.push({ name: 'profile' })">
          <template #icon><UserCircle class="size-4" /></template>
          {{ $t('nav.profile') }}
        </DropdownItem>
        <DropdownItem danger @click="signOut">
          <template #icon><LogOut class="size-4 rtl:rotate-180" /></template>
          {{ $t('auth.signOut') }}
        </DropdownItem>
      </div>
    </BaseDropdown>
  </header>
</template>
