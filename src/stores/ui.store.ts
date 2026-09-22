import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

const THEME_KEY = 'fiberx.loyalty.theme'
const LOCALE_KEY = 'fiberx.loyalty.locale'
const SIDEBAR_KEY = 'fiberx.loyalty.sidebar.collapsed'

export type ThemeMode = 'light' | 'dark' | 'system'
export type AppLocale = 'en' | 'ar'

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Persistence is a convenience; a blocked store must not break the setting.
  }
}

/**
 * Presentation state: theme, language and the sidebar.
 *
 * This store owns the side effects on `<html>` — the `dark` class, `lang` and
 * `dir` — so that direction and theme are applied in exactly one place and
 * cannot drift between a component and the document.
 */
export const useUiStore = defineStore('ui', () => {
  const theme = ref<ThemeMode>(readStored(THEME_KEY, ['light', 'dark', 'system'], 'system'))
  // Arabic-first: the dashboard opens in Arabic and RTL unless this operator has
  // previously chosen English.
  const locale = ref<AppLocale>(readStored(LOCALE_KEY, ['en', 'ar'], 'ar'))
  const sidebarCollapsed = ref(readStored(SIDEBAR_KEY, ['true', 'false'], 'false') === 'true')
  /** The mobile drawer, which is separate from the desktop collapsed state. */
  const mobileNavOpen = ref(false)

  const direction = computed<'rtl' | 'ltr'>(() => (locale.value === 'ar' ? 'rtl' : 'ltr'))
  const isRtl = computed(() => direction.value === 'rtl')

  const systemPrefersDark = ref(
    typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches === true,
  )

  const isDark = computed(() =>
    theme.value === 'system' ? systemPrefersDark.value : theme.value === 'dark',
  )

  function applyTheme(): void {
    document.documentElement.classList.toggle('dark', isDark.value)
    // Lets form controls and scrollbars follow the theme.
    document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light'
  }

  function applyLocale(): void {
    document.documentElement.lang = locale.value
    document.documentElement.dir = direction.value
  }

  function setTheme(next: ThemeMode): void {
    theme.value = next
    write(THEME_KEY, next)
  }

  function setLocale(next: AppLocale): void {
    locale.value = next
    write(LOCALE_KEY, next)
  }

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
    write(SIDEBAR_KEY, String(sidebarCollapsed.value))
  }

  function openMobileNav(): void {
    mobileNavOpen.value = true
  }

  function closeMobileNav(): void {
    mobileNavOpen.value = false
  }

  /** Called once at startup, before the first paint, to avoid a flash. */
  function initialise(): void {
    applyTheme()
    applyLocale()

    // Following the OS preference only matters while the mode is 'system'; the
    // computed above handles the branch, so the listener just refreshes input.
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
      systemPrefersDark.value = event.matches
    })
  }

  watch(isDark, applyTheme)
  watch(locale, applyLocale)

  return {
    theme,
    locale,
    direction,
    isRtl,
    isDark,
    sidebarCollapsed,
    mobileNavOpen,
    setTheme,
    setLocale,
    toggleSidebar,
    openMobileNav,
    closeMobileNav,
    initialise,
  }
})
