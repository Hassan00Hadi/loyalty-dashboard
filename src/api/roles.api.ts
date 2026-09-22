import { apiDelete, apiGet, apiPost, apiPut } from './client'
import type {
  CreateRoleRequest,
  Permission,
  Role,
  UpdateRoleRequest,
} from '@/types/models'

/** Roles, their permission sets, and the permission catalogue. */

/** `GET /api/v1/admin/roles` — Roles.Read. Not paged. */
export function listRoles(): Promise<Role[]> {
  return apiGet<Role[]>('/api/v1/admin/roles')
}

/** `GET /api/v1/admin/roles/{id}` — Roles.Read. */
export function getRole(id: string): Promise<Role> {
  return apiGet<Role>(`/api/v1/admin/roles/${id}`)
}

/** `POST /api/v1/admin/roles` — Roles.Create. */
export function createRole(body: CreateRoleRequest): Promise<Role> {
  return apiPost<Role>('/api/v1/admin/roles', body)
}

/** `PUT /api/v1/admin/roles/{id}` — Roles.Update. Name and description only. */
export function updateRole(id: string, body: UpdateRoleRequest): Promise<Role> {
  return apiPut<Role>(`/api/v1/admin/roles/${id}`, body)
}

/** `DELETE /api/v1/admin/roles/{id}` — Roles.Delete. System roles cannot be deleted. */
export function deleteRole(id: string): Promise<void> {
  return apiDelete(`/api/v1/admin/roles/${id}`)
}

/** `GET /api/v1/admin/roles/{id}/permissions` — Roles.Read. */
export function getRolePermissions(id: string): Promise<Permission[]> {
  return apiGet<Permission[]>(`/api/v1/admin/roles/${id}/permissions`)
}

/**
 * `PUT /api/v1/admin/roles/{id}/permissions` — Roles.ManagePermissions.
 *
 * Wholesale replacement: send the complete intended set, not a delta.
 */
export function replaceRolePermissions(
  id: string,
  permissionIds: string[],
): Promise<Permission[]> {
  return apiPut<Permission[]>(`/api/v1/admin/roles/${id}/permissions`, { permissionIds })
}

/**
 * `GET /api/v1/admin/permissions` — Permissions.Read.
 *
 * The declared catalogue, already grouped by the server. Permission names are
 * stable identifiers; only their display labels are localised.
 */
export function listPermissions(): Promise<Permission[]> {
  return apiGet<Permission[]>('/api/v1/admin/permissions')
}
