import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { i18n, setI18nLocale } from './i18n'
import { configureAuth } from './api/client'
import { useAuthStore } from './stores/auth.store'
import { useUiStore } from './stores/ui.store'
import { useToastStore } from './stores/toast.store'
import './assets/style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)

// Stores are resolved before the router so the navigation guard, which reads the
// auth store on its first call, always finds an initialised instance.
const auth = useAuthStore(pinia)
const ui = useUiStore(pinia)
const toast = useToastStore(pinia)

// Theme and direction are applied before the first paint to avoid a flash of
// the wrong theme or the wrong writing direction.
ui.initialise()
setI18nLocale(ui.locale)

/**
 * Wires the API layer to the session.
 *
 * A 401 from any call clears the session and returns to the login screen with
 * the attempted path preserved; a 403 is surfaced as a notification, since the
 * page itself renders its own forbidden state.
 */
configureAuth({
  getToken: () => auth.token,
  onUnauthenticated: () => {
    const wasSignedIn = auth.isAuthenticated
    auth.logout()

    if (wasSignedIn) {
      toast.error(i18n.global.t('auth.sessionExpired'))
    }

    const current = router.currentRoute.value
    if (current.name !== 'login') {
      void router.push({
        name: 'login',
        query: current.fullPath === '/' ? {} : { redirect: current.fullPath },
      })
    }
  },
  onForbidden: () => {
    toast.error(i18n.global.t('errors.forbidden'))
  },
})

app.use(router)
app.mount('#app')
