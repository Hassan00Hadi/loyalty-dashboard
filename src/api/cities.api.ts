import { apiDelete, apiGet, apiPost, apiPut } from './client'
import { MAX_PAGE_SIZE, type PagedResult } from '@/types/api'
import type {
  City,
  CityQuery,
  CreateCityRequest,
  UpdateCityRequest,
} from '@/types/models'

/**
 * Cities, shared by the whole platform.
 *
 * A city belongs to no merchant: branches point at it, and an offer's city records
 * where it is worth redeeming rather than limiting who may see or activate it.
 */

/** `GET /api/v1/loyalty/cities` — Cities.Read. Paged, searchable. */
export function listCities(query: CityQuery): Promise<PagedResult<City>> {
  // Clamped rather than passed through: the server rejects anything above its ceiling
  // with a validation error, and a caller asking for "all of them" means the maximum,
  // not a failed request and an empty picker.
  const pageSize = query.pageSize === undefined
    ? undefined
    : Math.min(Math.max(query.pageSize, 1), MAX_PAGE_SIZE)

  return apiGet<PagedResult<City>>('/api/v1/loyalty/cities', { ...query, pageSize })
}

/** `GET /api/v1/loyalty/cities/{id}` — Cities.Read. */
export function getCity(id: string): Promise<City> {
  return apiGet<City>(`/api/v1/loyalty/cities/${id}`)
}

/**
 * `POST /api/v1/loyalty/cities` — Cities.Create.
 *
 * The branch decides the merchant: a merchantId disagreeing with the branch's own is
 * rejected rather than corrected.
 */
export function createCity(body: CreateCityRequest): Promise<City> {
  return apiPost<City>('/api/v1/loyalty/cities', body)
}

/** `PUT /api/v1/loyalty/cities/{id}` — Cities.Update. Sparse. */
export function updateCity(id: string, body: UpdateCityRequest): Promise<City> {
  return apiPut<City>(`/api/v1/loyalty/cities/${id}`, body)
}

/**
 * `DELETE /api/v1/loyalty/cities/{id}` — Cities.Delete.
 *
 * Refused with 409 while an offer or a member still references it.
 */
export function deleteCity(id: string): Promise<void> {
  return apiDelete(`/api/v1/loyalty/cities/${id}`)
}
