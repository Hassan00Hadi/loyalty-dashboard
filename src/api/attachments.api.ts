import { apiDelete, apiGet, apiPatch, apiPost, http } from './client'
import { MAX_PAGE_SIZE, type PagedResult } from '@/types/api'
import type {
  Attachment,
  AttachmentKind,
  AttachmentLinkRequest,
  AttachmentOwnerType,
  AttachmentQuery,
} from '@/types/models'

/**
 * Uploaded files, and the record that links each one to what it belongs to.
 *
 * An attachment exists on its own: it is uploaded first and owned afterwards, so
 * a file can be picked before the merchant or offer it illustrates has been
 * saved. `ownerType: 'None'` is that unowned state, not a missing value.
 */

/** What the server will accept, read from `GET /constraints`. */
export interface AttachmentConstraints {
  maxImageSizeBytes: number
  maxDocumentSizeBytes: number
  allowedImageContentTypes: string[]
  allowedDocumentContentTypes: string[]
}

/** The owner half of a link, shared by upload and re-link. */
export interface AttachmentOwner {
  ownerType?: AttachmentOwnerType | null
  ownerId?: string | null
}

export interface UploadAttachmentRequest extends AttachmentOwner {
  file: File
  /** Overrides the browser's own file name. The extension still decides the kind. */
  fileName?: string | null
}

/** Progress as a whole number 0-100, or null while the total size is unknown. */
export type UploadProgressHandler = (percent: number | null) => void

/**
 * Builds the multipart body the two upload endpoints expect.
 *
 * Empty owner fields are omitted rather than sent blank: the server binds
 * `OwnerType` to an enum and `OwnerId` to a Guid, and an empty string fails
 * model binding where an absent key falls back to the declared default.
 */
function appendOwner(form: FormData, owner: AttachmentOwner, fileName?: string | null): void {
  if (owner.ownerType) {
    form.append('OwnerType', owner.ownerType)
  }
  if (owner.ownerId) {
    form.append('OwnerId', owner.ownerId)
  }
  if (fileName) {
    form.append('FileName', fileName)
  }
}

function progressConfig(onProgress?: UploadProgressHandler) {
  if (!onProgress) return {}

  return {
    onUploadProgress: (event: { loaded: number; total?: number }) => {
      onProgress(event.total ? Math.round((event.loaded * 100) / event.total) : null)
    },
  }
}

/** `GET /api/v1/loyalty/attachments` — Attachments.Read. Paged, filterable. */
export function listAttachments(query: AttachmentQuery): Promise<PagedResult<Attachment>> {
  // Clamped for the same reason as every other list: the server rejects a page
  // size above its ceiling, and "give me all of them" should mean the maximum
  // rather than a validation error.
  const pageSize = query.pageSize === undefined
    ? undefined
    : Math.min(Math.max(query.pageSize, 1), MAX_PAGE_SIZE)

  return apiGet<PagedResult<Attachment>>('/api/v1/loyalty/attachments', { ...query, pageSize })
}

/** `GET /api/v1/loyalty/attachments/{id}` — Attachments.Read. */
export function getAttachment(id: string): Promise<Attachment> {
  return apiGet<Attachment>(`/api/v1/loyalty/attachments/${id}`)
}

/**
 * `POST /api/v1/loyalty/attachments` — Attachments.Create. One file, ≤ 64 MB.
 *
 * The Content-Type header is deleted rather than set: the browser has to write
 * it itself so the multipart boundary it generates is the one the server reads.
 */
export function uploadAttachment(
  request: UploadAttachmentRequest,
  onProgress?: UploadProgressHandler,
): Promise<Attachment> {
  const form = new FormData()
  form.append('File', request.file)
  appendOwner(form, request, request.fileName)

  return apiPost<Attachment>('/api/v1/loyalty/attachments', form, {
    headers: { 'Content-Type': undefined },
    ...progressConfig(onProgress),
  })
}

/**
 * `POST /api/v1/loyalty/attachments/bulk` — Attachments.Create. ≤ 256 MB total.
 *
 * Every file in one call shares a single owner, which is what the endpoint takes:
 * the link is sent once, not per file. Linking files to different owners means
 * one call each.
 */
export function uploadAttachments(
  files: File[],
  owner: AttachmentOwner = {},
  onProgress?: UploadProgressHandler,
): Promise<Attachment[]> {
  const form = new FormData()
  for (const file of files) {
    form.append('files', file)
  }
  appendOwner(form, owner)

  return apiPost<Attachment[]>('/api/v1/loyalty/attachments/bulk', form, {
    headers: { 'Content-Type': undefined },
    ...progressConfig(onProgress),
  })
}

/**
 * `PATCH /api/v1/loyalty/attachments/{id}` — Attachments.Update.
 *
 * Re-links the file, renames it, or both. Passing `ownerType: 'None'` detaches it
 * and clears the owner id, which is how a file is unlinked without being deleted.
 */
export function updateAttachment(id: string, body: AttachmentLinkRequest): Promise<Attachment> {
  return apiPatch<Attachment>(`/api/v1/loyalty/attachments/${id}`, body)
}

/** `DELETE /api/v1/loyalty/attachments/{id}` — Attachments.Delete. */
export function deleteAttachment(id: string): Promise<void> {
  return apiDelete(`/api/v1/loyalty/attachments/${id}`)
}

/** `GET /api/v1/loyalty/attachments/constraints` — Attachments.Read. */
export function getAttachmentConstraints(): Promise<AttachmentConstraints> {
  return apiGet<AttachmentConstraints>('/api/v1/loyalty/attachments/constraints')
}

/**
 * Fetches the bytes of an attachment as a blob.
 *
 * Deliberately not enveloped: `/content` streams the file itself, so this goes
 * through the Axios instance directly instead of the `apiGet` unwrapper, which
 * expects an `ApiResponse` body.
 *
 * Note that this endpoint is gated on the mobile-user policy rather than on
 * `Attachments.Read`, so an admin session is answered 401. Use {@link resolveAttachmentUrl}
 * to display a file from the dashboard.
 */
export async function downloadAttachmentContent(id: string): Promise<Blob> {
  const response = await http.get<Blob>(`/api/v1/loyalty/attachments/${id}/content`, {
    responseType: 'blob',
  })
  return response.data
}

/**
 * Turns the relative `url` an attachment carries into one a browser can load.
 *
 * Returned rather than fetched so an `<img>` or a link can use it directly. It
 * is left relative when no API base is configured, which is the same-origin case.
 */
export function resolveAttachmentUrl(attachment: Pick<Attachment, 'url'>): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
  if (!base) return attachment.url

  return `${base}${attachment.url.startsWith('/') ? '' : '/'}${attachment.url}`
}

/** Whether a file's type and size satisfy the server's constraints for its kind. */
export function validateAttachment(
  file: File,
  constraints: AttachmentConstraints,
): { valid: boolean; reason?: 'type' | 'size'; kind?: AttachmentKind } {
  const isImage = constraints.allowedImageContentTypes.includes(file.type)
  const isDocument = constraints.allowedDocumentContentTypes.includes(file.type)

  if (!isImage && !isDocument) {
    return { valid: false, reason: 'type' }
  }

  const kind: AttachmentKind = isImage ? 'Image' : 'Document'
  const limit = isImage ? constraints.maxImageSizeBytes : constraints.maxDocumentSizeBytes

  if (file.size > limit) {
    return { valid: false, reason: 'size', kind }
  }

  return { valid: true, kind }
}
