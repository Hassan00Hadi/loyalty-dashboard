import { apiGet, apiPatch, apiPost, apiPut } from './client'
import type { PagedResult } from '@/types/api'
import type {
  AdminCategory,
  AdminMerchant,
  AdminOffer,
  AdminOfferQuery,
  CreateCategoryRequest,
  CreateMerchantRequest,
  CreateOfferRequest,
  UpdateCategoryRequest,
  UpdateMerchantRequest,
  UpdateOfferRequest,
} from '@/types/models'

/**
 * Administrative catalogue: categories, merchants and offers.
 *
 * All three are unpaged list endpoints on the server, so the tables that render
 * them filter and page in memory. Updates are PATCH with a sparse body — only
 * the fields present are changed — and none of the three has a DELETE.
 *
 * Merchants and categories each have two write surfaces: a JSON pair for a write
 * with no image, and a multipart pair that carries the image with the entity.
 * The multipart form is what the dashboard's forms use, because it makes
 * creating an entity with a picture one request rather than an upload followed
 * by a create — the backend owns the attachment's creation and ownership, so
 * nothing here ever sends an attachment id, owner type or owner id.
 */

/**
 * A merchant form as the user filled it in, with the logo still a file.
 *
 * Deliberately has no attachment id: the form knows about a picture the user
 * chose, not about the record the backend will make of it.
 */
export interface MerchantFormPayload {
  name: string
  categoryId: string
  cityIds: string[]
  description?: string | null
  /** The chosen image, still unsent. Absent means "no change" on an update. */
  logoFile?: File | null
  /** The wide header image, on the same terms as `logoFile`. */
  backgroundFile?: File | null
  /** The compact square mark, on the same terms as `logoFile`. */
  iconFile?: File | null
  isActive: boolean
}

/** A category form as the user filled it in, with the icon still a file. */
export interface CategoryFormPayload {
  name: string
  /** The chosen image, still unsent. Absent means "no change" on an update. */
  iconFile?: File | null
  isActive: boolean
}

// ── Categories ────────────────────────────────────────────────────────────────

/** `GET /api/v1/loyalty/categories` — Categories.Read. Not paged. */
export function listCategories(): Promise<AdminCategory[]> {
  return apiGet<AdminCategory[]>('/api/v1/loyalty/categories')
}

/** `POST /api/v1/loyalty/categories` — Categories.Create. JSON, no icon. */
export function createCategory(body: CreateCategoryRequest): Promise<AdminCategory> {
  return apiPost<AdminCategory>('/api/v1/loyalty/categories', body)
}

/** `PATCH /api/v1/loyalty/categories/{id}` — Categories.Update. Sparse JSON. */
export function updateCategory(
  id: string,
  body: UpdateCategoryRequest,
): Promise<AdminCategory> {
  return apiPatch<AdminCategory>(`/api/v1/loyalty/categories/${id}`, body)
}

/**
 * `POST /api/v1/loyalty/categories` (multipart) — Categories.Create.
 *
 * Creates the category and stores its icon in one request: the backend writes
 * the file, creates the attachment and claims it for the new category. The
 * caller never uploads separately and never sees an attachment id.
 *
 * Field names are the server's `CreateCategoryFormRequest` properties verbatim.
 */
export function createCategoryWithIcon(form: CategoryFormPayload): Promise<AdminCategory> {
  const body = new FormData()
  body.append('Name', form.name)
  body.append('IsActive', String(form.isActive))
  if (form.iconFile) body.append('Icon', form.iconFile)

  return apiPost<AdminCategory>('/api/v1/loyalty/categories', body)
}

/**
 * `PUT /api/v1/loyalty/categories/{id}` (multipart) — Categories.Update.
 *
 * Omitting `Icon` keeps the current one; the previous icon is replaced only once
 * the new one is committed. `ClearIcon` removes it, and the server ignores that
 * flag when a replacement is supplied.
 */
export function updateCategoryWithIcon(
  id: string,
  form: CategoryFormPayload & { clearIcon?: boolean },
): Promise<AdminCategory> {
  const body = new FormData()
  body.append('Name', form.name)
  body.append('IsActive', String(form.isActive))
  if (form.iconFile) body.append('Icon', form.iconFile)
  if (form.clearIcon) body.append('ClearIcon', 'true')

  return apiPut<AdminCategory>(`/api/v1/loyalty/categories/${id}`, body)
}

// ── Merchants ─────────────────────────────────────────────────────────────────

/** `GET /api/v1/loyalty/merchants` — Merchants.Read. Optional category filter. */
export function listMerchants(categoryId?: string | null): Promise<AdminMerchant[]> {
  return apiGet<AdminMerchant[]>('/api/v1/loyalty/merchants', { categoryId })
}

/** `POST /api/v1/loyalty/merchants` — Merchants.Create. JSON, no logo. */
export function createMerchant(body: CreateMerchantRequest): Promise<AdminMerchant> {
  return apiPost<AdminMerchant>('/api/v1/loyalty/merchants', body)
}

/** `PATCH /api/v1/loyalty/merchants/{id}` — Merchants.Update. Sparse JSON. */
export function updateMerchant(
  id: string,
  body: UpdateMerchantRequest,
): Promise<AdminMerchant> {
  return apiPatch<AdminMerchant>(`/api/v1/loyalty/merchants/${id}`, body)
}

/**
 * Builds the shared part of the merchant multipart body.
 *
 * `CityIds` is appended once per id: the server accepts either repeated fields
 * or one comma-separated value, and repeating is the form that survives ids
 * containing a comma. An empty list still appends nothing, which the server
 * reads as "no cities" on create and "leave unchanged" on update — so an update
 * that means to empty the list sends an explicit empty value.
 */
function appendMerchantFields(body: FormData, form: MerchantFormPayload): void {
  body.append('Name', form.name)
  body.append('CategoryId', form.categoryId)
  body.append('IsActive', String(form.isActive))

  if (form.description) body.append('Description', form.description)
  for (const cityId of form.cityIds) body.append('CityIds', cityId)

  // Each image is its own multipart part, and each is independent: sending one
  // leaves the other two as they are.
  if (form.logoFile) body.append('Logo', form.logoFile)
  if (form.backgroundFile) body.append('Background', form.backgroundFile)
  if (form.iconFile) body.append('Icon', form.iconFile)
}

/**
 * `POST /api/v1/loyalty/merchants` (multipart) — Merchants.Create.
 *
 * Creates the merchant and stores its logo in one request. The backend creates
 * the attachment and assigns ownership to the new merchant, so no owner type,
 * owner id or attachment id is ever sent from here.
 *
 * Field names are the server's `CreateMerchantFormRequest` properties verbatim.
 */
export function createMerchantWithLogo(form: MerchantFormPayload): Promise<AdminMerchant> {
  const body = new FormData()
  appendMerchantFields(body, form)

  return apiPost<AdminMerchant>('/api/v1/loyalty/merchants', body)
}

/**
 * `PUT /api/v1/loyalty/merchants/{id}` (multipart) — Merchants.Update.
 *
 * Omitting an image field keeps the current one; the previous image is replaced
 * only once the new one is committed. The matching `Clear*` flag removes it, and
 * the server ignores that flag when a replacement is supplied.
 *
 * The three images are independent: clearing the background leaves the logo and
 * icon untouched.
 */
export function updateMerchantWithLogo(
  id: string,
  form: MerchantFormPayload & {
    clearLogo?: boolean
    clearBackground?: boolean
    clearIcon?: boolean
  },
): Promise<AdminMerchant> {
  const body = new FormData()
  appendMerchantFields(body, form)

  // An update with no cities means "remove them all", which needs a present but
  // empty field — an absent one would be read as "leave them unchanged".
  if (form.cityIds.length === 0) body.append('CityIds', '')
  if (form.clearLogo) body.append('ClearLogo', 'true')
  if (form.clearBackground) body.append('ClearBackground', 'true')
  if (form.clearIcon) body.append('ClearIcon', 'true')

  return apiPut<AdminMerchant>(`/api/v1/loyalty/merchants/${id}`, body)
}

// ── Offers ────────────────────────────────────────────────────────────────────

/** `GET /api/v1/loyalty/offers` — Offers.Read. Optional merchant filter. Not paged. */
export function listOffers(merchantId?: string | null): Promise<AdminOffer[]> {
  return apiGet<AdminOffer[]>('/api/v1/loyalty/offers', { merchantId })
}

/**
 * `GET /api/v1/loyalty/offers/search` — Offers.Read. Paged, filtered and sorted.
 *
 * Every filter and the sort order are applied in the database, so the offers
 * table only ever holds the page it is showing. This is what the list screen
 * uses; {@link listOffers} remains for pickers that need every offer at once.
 */
export function searchOffers(query: AdminOfferQuery): Promise<PagedResult<AdminOffer>> {
  return apiGet<PagedResult<AdminOffer>>('/api/v1/loyalty/offers/search', { ...query })
}

/** `POST /api/v1/loyalty/offers` — Offers.Create. */
export function createOffer(body: CreateOfferRequest): Promise<AdminOffer> {
  return apiPost<AdminOffer>('/api/v1/loyalty/offers', body)
}

/** `PATCH /api/v1/loyalty/offers/{id}` — Offers.Update. */
export function updateOffer(id: string, body: UpdateOfferRequest): Promise<AdminOffer> {
  return apiPatch<AdminOffer>(`/api/v1/loyalty/offers/${id}`, body)
}
