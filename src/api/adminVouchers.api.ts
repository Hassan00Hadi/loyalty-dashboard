import { apiGet, apiPost } from './client'
import type { PagedResult } from '@/types/api'
import type {
  AdminVoucher,
  AdminVoucherQuery,
  BranchPerformance,
  StatisticsQuery,
  VoucherStatistics,
} from '@/types/models'

/**
 * Administrative oversight of issued vouchers, and the figures aggregated over them.
 *
 * Distinct from `vouchers.api`, which is the till-side validate/consume pair scoped to
 * one merchant. These read across every merchant and carry their own permissions.
 */

/** `GET /api/v1/loyalty/admin/vouchers` — Vouchers.Read. Paged, filterable. */
export function listAdminVouchers(
  query: AdminVoucherQuery,
): Promise<PagedResult<AdminVoucher>> {
  return apiGet<PagedResult<AdminVoucher>>('/api/v1/loyalty/admin/vouchers', { ...query })
}

/** `GET /api/v1/loyalty/admin/vouchers/{id}` — Vouchers.Read. */
export function getAdminVoucher(id: string): Promise<AdminVoucher> {
  return apiGet<AdminVoucher>(`/api/v1/loyalty/admin/vouchers/${id}`)
}

/**
 * `POST /api/v1/loyalty/admin/vouchers/{id}/cancel` — Vouchers.Cancel.
 *
 * Points are **not** refunded: cancelling only stops the voucher being redeemed. A
 * voucher already used, cancelled or expired returns 409.
 */
export function cancelVoucher(id: string): Promise<AdminVoucher> {
  return apiPost<AdminVoucher>(`/api/v1/loyalty/admin/vouchers/${id}/cancel`)
}

/**
 * `GET /api/v1/loyalty/admin/vouchers/statistics` — Analytics.Read.
 *
 * Database aggregates over the whole filtered set, not a tally of one fetched page.
 */
export function getVoucherStatistics(
  query: StatisticsQuery = {},
): Promise<VoucherStatistics> {
  return apiGet<VoucherStatistics>('/api/v1/loyalty/admin/vouchers/statistics', {
    ...query,
  })
}

/**
 * `GET /api/v1/loyalty/admin/vouchers/branch-performance` — Analytics.Read.
 *
 * Covers branch-bound vouchers only: one issued without a branch has none to credit.
 */
export function getBranchPerformance(
  query: StatisticsQuery = {},
): Promise<BranchPerformance[]> {
  return apiGet<BranchPerformance[]>(
    '/api/v1/loyalty/admin/vouchers/branch-performance',
    { ...query },
  )
}
