import { apiDelete, apiGet, apiPost, apiPut } from './client'
import type {
  ApiClient,
  ClientCreated,
  CreateClientRequest,
  Permission,
  UpdateClientRequest,
} from '@/types/models'

/**
 * API clients — the server-to-server credentials external systems use.
 *
 * The plaintext secret exists only in the response to `createClient`. It is not
 * stored and no other endpoint returns it, so the UI must show it once and say so.
 */

/** `GET /api/v1/admin/clients` — Clients.Read. Not paged. */
export function listClients(): Promise<ApiClient[]> {
  return apiGet<ApiClient[]>('/api/v1/admin/clients')
}

/** `GET /api/v1/admin/clients/{id}` — Clients.Read. */
export function getClient(id: string): Promise<ApiClient> {
  return apiGet<ApiClient>(`/api/v1/admin/clients/${id}`)
}

/** `POST /api/v1/admin/clients` — Clients.Create. Returns the one-time secret. */
export function createClient(body: CreateClientRequest): Promise<ClientCreated> {
  return apiPost<ClientCreated>('/api/v1/admin/clients', body)
}

/** `PUT /api/v1/admin/clients/{id}` — Clients.Update. */
export function updateClient(id: string, body: UpdateClientRequest): Promise<ApiClient> {
  return apiPut<ApiClient>(`/api/v1/admin/clients/${id}`, body)
}

/** `DELETE /api/v1/admin/clients/{id}` — Clients.Delete. */
export function deleteClient(id: string): Promise<void> {
  return apiDelete(`/api/v1/admin/clients/${id}`)
}

/**
 * `POST /api/v1/admin/clients/{id}/revoke` — Clients.Revoke.
 *
 * Stops the credential working immediately without deleting the record, so the
 * client's history and permissions stay auditable.
 */
export function revokeClient(id: string): Promise<ApiClient> {
  return apiPost<ApiClient>(`/api/v1/admin/clients/${id}/revoke`)
}

/** `GET /api/v1/admin/clients/{id}/permissions` — Clients.Read. */
export function getClientPermissions(id: string): Promise<Permission[]> {
  return apiGet<Permission[]>(`/api/v1/admin/clients/${id}/permissions`)
}

/** `PUT /api/v1/admin/clients/{id}/permissions` — Clients.ManagePermissions. */
export function replaceClientPermissions(
  id: string,
  permissionIds: string[],
): Promise<Permission[]> {
  return apiPut<Permission[]>(`/api/v1/admin/clients/${id}/permissions`, { permissionIds })
}
