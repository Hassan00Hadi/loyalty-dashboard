import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as authApi from '@/api/auth.api'
import type { AdminIdentity, AdminLoginRequest } from '@/types/models'
import type { PermissionName } from '@/utils/permissions'

const TOKEN_KEY = 'fiberx.loyalty.token'
const EXPIRY_KEY = 'fiberx.loyalty.token.expiresAt'

/**
 * Session state: the bearer token, who holds it, and what they may do.
 *
 * The token is kept in `localStorage` so a reload does not sign the user out.
 * That is a deliberate trade-off — it is readable by script on this origin —
 * and it is why the permission list here is treated as advisory UX only: the
 * backend re-checks every call, so a tampered list grants nothing.
 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const expiresAt = ref<string | null>(null)
  const admin = ref<AdminIdentity | null>(null)
  const permissions = ref<ReadonlySet<string>>(new Set())
  /** True while a stored token is being replayed against `/me` on boot. */
  const restoring = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value && admin.value))

  const fullName = computed(() => {
    if (!admin.value) return ''
    return `${admin.value.firstName} ${admin.value.lastName}`.trim() || admin.value.email
  })

  const initials = computed(() => {
    if (!admin.value) return '?'
    const first = admin.value.firstName?.[0] ?? ''
    const last = admin.value.lastName?.[0] ?? ''
    return (first + last).toUpperCase() || admin.value.email[0]?.toUpperCase() || '?'
  })

  const roleNames = computed(() => admin.value?.roles ?? [])

  /** True when the stored token's expiry has already passed. */
  function isExpired(): boolean {
    if (!expiresAt.value) return false
    const expiry = new Date(
      /[Z+]|-\d{2}:\d{2}$/.test(expiresAt.value) ? expiresAt.value : `${expiresAt.value}Z`,
    )
    return !Number.isNaN(expiry.getTime()) && expiry.getTime() <= Date.now()
  }

  function applyIdentity(identity: AdminIdentity): void {
    admin.value = identity
    permissions.value = new Set(identity.permissions)
  }

  function persist(newToken: string, newExpiry: string): void {
    token.value = newToken
    expiresAt.value = newExpiry
    try {
      localStorage.setItem(TOKEN_KEY, newToken)
      localStorage.setItem(EXPIRY_KEY, newExpiry)
    } catch {
      // A blocked or full storage must not break the session in progress; it
      // only costs persistence across a reload.
    }
  }

  function clear(): void {
    token.value = null
    expiresAt.value = null
    admin.value = null
    permissions.value = new Set()
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(EXPIRY_KEY)
    } catch {
      // Nothing to do — the in-memory state is already cleared.
    }
  }

  async function login(credentials: AdminLoginRequest): Promise<void> {
    const result = await authApi.login(credentials)
    persist(result.accessToken, result.expiresAt)
    applyIdentity(result.admin)
  }

  function logout(): void {
    // There is no server-side logout endpoint: the token is stateless and
    // simply discarded here. It stops working at its own expiry.
    clear()
  }

  /**
   * Restores a session from storage on boot.
   *
   * Returns false when there is nothing to restore or the token is no longer
   * accepted, which is the router's cue to send the user to the login screen.
   */
  async function restore(): Promise<boolean> {
    let stored: string | null = null
    let storedExpiry: string | null = null
    try {
      stored = localStorage.getItem(TOKEN_KEY)
      storedExpiry = localStorage.getItem(EXPIRY_KEY)
    } catch {
      return false
    }

    if (!stored) return false

    token.value = stored
    expiresAt.value = storedExpiry

    // An already-expired token is discarded without a request: the call would
    // only come back 401.
    if (isExpired()) {
      clear()
      return false
    }

    restoring.value = true
    try {
      applyIdentity(await authApi.fetchCurrentAdmin())
      return true
    } catch {
      clear()
      return false
    } finally {
      restoring.value = false
    }
  }

  /** Re-reads the caller's identity, e.g. after their roles were changed. */
  async function refreshIdentity(): Promise<void> {
    if (!token.value) return
    applyIdentity(await authApi.fetchCurrentAdmin())
  }

  function hasPermission(name: PermissionName | string): boolean {
    return permissions.value.has(name)
  }

  function hasAnyPermission(...names: (PermissionName | string)[]): boolean {
    return names.some((name) => permissions.value.has(name))
  }

  function hasAllPermissions(...names: (PermissionName | string)[]): boolean {
    return names.every((name) => permissions.value.has(name))
  }

  return {
    token,
    expiresAt,
    admin,
    permissions,
    restoring,
    isAuthenticated,
    fullName,
    initials,
    roleNames,
    login,
    logout,
    restore,
    refreshIdentity,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  }
})
