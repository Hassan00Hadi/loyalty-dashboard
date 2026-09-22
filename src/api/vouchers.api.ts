import { apiPost } from './client'
import type {
  ConsumeVoucherRequest,
  ConsumeVoucherResponse,
  ValidateVoucherRequest,
  ValidateVoucherResponse,
} from '@/types/models'

/**
 * Merchant-facing voucher operations.
 *
 * There is no endpoint that lists all vouchers system-wide: vouchers are only
 * readable per member, via `wallets.api.listUserVouchers`. These two endpoints
 * act on a single code presented at a merchant.
 *
 * `merchantId` is required of an administrator, who has no merchant scope of
 * their own, and ignored for a client bound to one.
 */

/**
 * `POST /api/v1/loyalty/vouchers/validate` — Vouchers.Validate.
 *
 * A read-only check. Safe to call repeatedly; it does not consume the voucher.
 */
export function validateVoucher(
  body: ValidateVoucherRequest,
): Promise<ValidateVoucherResponse> {
  return apiPost<ValidateVoucherResponse>('/api/v1/loyalty/vouchers/validate', body)
}

/**
 * `POST /api/v1/loyalty/vouchers/consume` — Vouchers.Consume.
 *
 * Irreversible: marks the voucher used. The UI confirms before calling it.
 */
export function consumeVoucher(body: ConsumeVoucherRequest): Promise<ConsumeVoucherResponse> {
  return apiPost<ConsumeVoucherResponse>('/api/v1/loyalty/vouchers/consume', body)
}
