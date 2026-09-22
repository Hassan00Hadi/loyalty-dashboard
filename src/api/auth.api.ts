import { apiGet, apiPost } from './client'
import type {
  AdminIdentity,
  AdminLoginRequest,
  AdminLoginResponse,
  ChangeOwnPasswordRequest,
} from '@/types/models'

/** `POST /api/v1/admin/auth/login` — anonymous. */
export function login(body: AdminLoginRequest): Promise<AdminLoginResponse> {
  return apiPost<AdminLoginResponse>('/api/v1/admin/auth/login', body)
}

/**
 * `GET /api/v1/admin/auth/me` — any authenticated admin.
 *
 * Used to restore a session on reload: the stored token is replayed here, and a
 * 401 tells the store the token is no longer good.
 */
export function fetchCurrentAdmin(): Promise<AdminIdentity> {
  return apiGet<AdminIdentity>('/api/v1/admin/auth/me')
}

/** `POST /api/v1/admin/auth/change-password` — any authenticated admin. */
export function changeOwnPassword(body: ChangeOwnPasswordRequest): Promise<boolean> {
  return apiPost<boolean>('/api/v1/admin/auth/change-password', body)
}
