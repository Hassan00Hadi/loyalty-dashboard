import { apiDelete, apiGet, apiPost, apiPut } from './client'
import type { PagedResult, PageRequest } from '@/types/api'
import type {
  Admin,
  CreateAdminRequest,
  RoleSummary,
  UpdateAdminRequest,
} from '@/types/models'

/** Administrator accounts and their role assignments. */

/** `GET /api/v1/admin/admins` — Admins.Read. Paged. */
export function listAdmins(query: PageRequest): Promise<PagedResult<Admin>> {
  return apiGet<PagedResult<Admin>>('/api/v1/admin/admins', { ...query })
}

/** `GET /api/v1/admin/admins/{id}` — Admins.Read. */
export function getAdmin(id: string): Promise<Admin> {
  return apiGet<Admin>(`/api/v1/admin/admins/${id}`)
}

/** `POST /api/v1/admin/admins` — Admins.Create. */
export function createAdmin(body: CreateAdminRequest): Promise<Admin> {
  return apiPost<Admin>('/api/v1/admin/admins', body)
}

/** `PUT /api/v1/admin/admins/{id}` — Admins.Update. Sparse: only sent fields change. */
export function updateAdmin(id: string, body: UpdateAdminRequest): Promise<Admin> {
  return apiPut<Admin>(`/api/v1/admin/admins/${id}`, body)
}

/** `DELETE /api/v1/admin/admins/{id}` — Admins.Delete. Deactivates the account. */
export function deleteAdmin(id: string): Promise<void> {
  return apiDelete(`/api/v1/admin/admins/${id}`)
}

/** `GET /api/v1/admin/admins/{id}/roles` — Admins.Read. */
export function getAdminRoles(id: string): Promise<RoleSummary[]> {
  return apiGet<RoleSummary[]>(`/api/v1/admin/admins/${id}/roles`)
}

/**
 * `PUT /api/v1/admin/admins/{id}/roles` — Admins.ManageRoles.
 *
 * Replaces the whole set rather than applying a delta, so two administrators
 * editing at once cannot merge into a union neither of them chose.
 */
export function replaceAdminRoles(id: string, roleIds: string[]): Promise<RoleSummary[]> {
  return apiPut<RoleSummary[]>(`/api/v1/admin/admins/${id}/roles`, { roleIds })
}
