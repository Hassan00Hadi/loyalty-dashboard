import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client'
import type { MerchantBranch, MerchantBranchPatch, MerchantBranchRequest } from '@/types/models'

/**
 * Merchant branches — the one catalogue resource with a full CRUD surface,
 * including DELETE and both PUT (full replace) and PATCH (sparse update).
 *
 * Like merchants and categories, branches have two write surfaces: a JSON pair
 * for a write with no image, and a multipart pair (`/with-images`) that carries
 * the background and icon with the branch. The multipart form makes creating a
 * branch with pictures one request rather than an upload followed by a create —
 * the backend owns the attachments, so no attachment id is ever sent from here.
 */

/**
 * A branch form as the user filled it in, with the images still files.
 *
 * Mirrors {@link MerchantFormPayload}: no attachment ids, because the form knows
 * about pictures the user chose, not about the records the backend will make.
 */
export interface BranchFormPayload {
  merchantId: string
  cityId?: string | null
  name: string
  address?: string | null
  latitude: string
  longitude: string
  phoneNumber?: string | null
  /** The chosen image, still unsent. Null means "no change" on an update. */
  backgroundFile?: File | null
  iconFile?: File | null
  isActive: boolean
}

/** `GET /api/v1/loyalty/branches` — Branches.Read. Optional merchant filter. */
export function listBranches(merchantId?: string | null): Promise<MerchantBranch[]> {
  return apiGet<MerchantBranch[]>('/api/v1/loyalty/branches', { merchantId })
}

/** `GET /api/v1/loyalty/branches/{id}` — Branches.Read. */
export function getBranch(id: string): Promise<MerchantBranch> {
  return apiGet<MerchantBranch>(`/api/v1/loyalty/branches/${id}`)
}

/** `POST /api/v1/loyalty/branches` — Branches.Create. */
export function createBranch(body: MerchantBranchRequest): Promise<MerchantBranch> {
  return apiPost<MerchantBranch>('/api/v1/loyalty/branches', body)
}

/** `PUT /api/v1/loyalty/branches/{id}` — Branches.Update. Replaces every field. */
export function replaceBranch(
  id: string,
  body: MerchantBranchRequest,
): Promise<MerchantBranch> {
  return apiPut<MerchantBranch>(`/api/v1/loyalty/branches/${id}`, body)
}

/** `PATCH /api/v1/loyalty/branches/{id}` — Branches.Update. Sparse update. */
export function patchBranch(id: string, body: MerchantBranchPatch): Promise<MerchantBranch> {
  return apiPatch<MerchantBranch>(`/api/v1/loyalty/branches/${id}`, body)
}

/**
 * Builds the shared part of the branch multipart body.
 *
 * Field names are the server's form-request properties verbatim. Optional text
 * fields are appended only when they carry a value, matching how the merchant
 * body is built.
 */
function appendBranchFields(body: FormData, form: BranchFormPayload): void {
  body.append('MerchantId', form.merchantId)
  body.append('Name', form.name)
  body.append('Latitude', form.latitude)
  body.append('Longitude', form.longitude)
  body.append('IsActive', String(form.isActive))

  if (form.cityId) body.append('CityId', form.cityId)
  if (form.address) body.append('Address', form.address)
  if (form.phoneNumber) body.append('PhoneNumber', form.phoneNumber)

  // The two images are independent parts: sending one leaves the other as it is.
  if (form.backgroundFile) body.append('Background', form.backgroundFile)
  if (form.iconFile) body.append('Icon', form.iconFile)
}

/**
 * `POST /api/v1/loyalty/branches/with-images` (multipart) — Branches.Create.
 *
 * Creates the branch and stores its background and icon in one request. Used in
 * place of {@link createBranch} only when the user actually picked an image;
 * a branch with no pictures stays on the plain JSON endpoint.
 */
export function createBranchWithImages(form: BranchFormPayload): Promise<MerchantBranch> {
  const body = new FormData()
  appendBranchFields(body, form)

  return apiPost<MerchantBranch>('/api/v1/loyalty/branches/with-images', body)
}

/**
 * `PATCH /api/v1/loyalty/branches/{id}/with-images` (multipart) — Branches.Update.
 *
 * PATCH, not PUT: an absent field means "leave it alone", so editing a branch's
 * phone number cannot silently drop its background. The PUT surface would clear
 * whatever it was not given, which is why the images are never sent through it.
 *
 * `ClearBackground` / `ClearIcon` remove an image; the server ignores either flag
 * when a replacement file is supplied in the same request.
 */
export function patchBranchWithImages(
  id: string,
  form: BranchFormPayload & { clearBackground?: boolean; clearIcon?: boolean },
): Promise<MerchantBranch> {
  const body = new FormData()
  appendBranchFields(body, form)

  if (form.clearBackground) body.append('ClearBackground', 'true')
  if (form.clearIcon) body.append('ClearIcon', 'true')

  return apiPatch<MerchantBranch>(`/api/v1/loyalty/branches/${id}/with-images`, body)
}

/** `DELETE /api/v1/loyalty/branches/{id}` — Branches.Delete. */
export function deleteBranch(id: string): Promise<void> {
  return apiDelete(`/api/v1/loyalty/branches/${id}`)
}
