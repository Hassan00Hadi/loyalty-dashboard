import { useAuthStore } from '@/stores/auth.store'
import type { PermissionName } from '@/utils/permissions'

/**
 * Permission checks for templates.
 *
 * This is UX protection only — hiding an action the caller would be refused.
 * The backend re-checks every request, so nothing here is a security boundary.
 */
export function usePermissions() {
  const auth = useAuthStore()

  const can = (permission: PermissionName | string): boolean => auth.hasPermission(permission)

  const canAny = (...permissions: (PermissionName | string)[]): boolean =>
    auth.hasAnyPermission(...permissions)

  const canAll = (...permissions: (PermissionName | string)[]): boolean =>
    auth.hasAllPermissions(...permissions)

  return { can, canAny, canAll }
}
