import { apiGet } from './client'
import type { PagedResult } from '@/types/api'
import type {
  PointTransaction,
  PointTransactionQuery,
  UserLoyalty,
  UserLoyaltyQuery,
  UserRank,
  Voucher,
  VoucherQuery,
} from '@/types/models'

/**
 * Member wallet reads. These are the only endpoints that expose member loyalty
 * state, and all of them are keyed by the external user id — the loyalty service
 * holds no other member identity.
 */

/** `GET /api/v1/loyalty/users/wallets` — UserPoints.Read. Paged. */
export function listWallets(query: UserLoyaltyQuery): Promise<PagedResult<UserLoyalty>> {
  return apiGet<PagedResult<UserLoyalty>>('/api/v1/loyalty/users/wallets', { ...query })
}

/** `GET /api/v1/loyalty/users/{userId}/wallet` — UserPoints.Read. */
export function getWallet(userId: string): Promise<UserLoyalty> {
  return apiGet<UserLoyalty>(`/api/v1/loyalty/users/${userId}/wallet`)
}

/** `GET /api/v1/loyalty/users/{userId}/point-transactions` — UserPoints.Read. Paged. */
export function listUserTransactions(
  userId: string,
  query: PointTransactionQuery,
): Promise<PagedResult<PointTransaction>> {
  return apiGet<PagedResult<PointTransaction>>(
    `/api/v1/loyalty/users/${userId}/point-transactions`,
    { ...query },
  )
}

/** `GET /api/v1/loyalty/users/{userId}/rank` — UserRank.Read. */
export function getUserRank(userId: string): Promise<UserRank> {
  return apiGet<UserRank>(`/api/v1/loyalty/users/${userId}/rank`)
}

/** `GET /api/v1/loyalty/users/{userId}/vouchers` — UserVouchers.Read. Paged. */
export function listUserVouchers(
  userId: string,
  query: VoucherQuery,
): Promise<PagedResult<Voucher>> {
  return apiGet<PagedResult<Voucher>>(`/api/v1/loyalty/users/${userId}/vouchers`, { ...query })
}
