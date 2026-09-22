import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import ar from '@/locales/ar.json'

export type AppLocale = 'en' | 'ar'

/**
 * Both locales are bundled rather than lazily fetched: together they are a few
 * tens of kilobytes, and switching language must not wait on a network round
 * trip mid-session.
 *
 * `legacy: false` selects the Composition API, so components use `useI18n()`.
 */
export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  // The dashboard is Arabic-first: Arabic and RTL are what an operator sees
  // unless they have explicitly chosen English, which the UI store remembers.
  locale: 'ar',
  // English remains the fallback chain because it is the complete key set a new
  // message is authored against; a missing Arabic string shows English rather
  // than a raw key.
  fallbackLocale: 'en',
  messages: { en, ar },
  // Arabic here is a plain fallback chain, not a pluralisation ruleset: the
  // messages avoid count-sensitive grammar so a single form reads correctly.
  missingWarn: import.meta.env.DEV,
  fallbackWarn: import.meta.env.DEV,
})

export function setI18nLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale
}
