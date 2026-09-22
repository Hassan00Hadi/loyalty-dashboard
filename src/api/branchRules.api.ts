import { apiDelete, apiGet, apiPost, apiPut } from './client'
import type { PagedResult } from '@/types/api'
import type {
  BranchOfferRule,
  BranchOfferRuleQuery,
  CreateBranchOfferRuleRequest,
  UpdateBranchOfferRuleRequest,
} from '@/types/models'

/**
 * Per-branch terms for an offer: required points, discount, and voucher validity.
 *
 * This is what lets one offer cost 100 points and give 20% at one branch while costing
 * 150 and giving 15% at another. Editing a rule never changes a voucher already issued
 * under it — vouchers snapshot their own terms at activation.
 */

/** `GET /api/v1/loyalty/branch-offer-rules` — BranchDiscounts.Read. Paged. */
export function listBranchRules(
  query: BranchOfferRuleQuery,
): Promise<PagedResult<BranchOfferRule>> {
  return apiGet<PagedResult<BranchOfferRule>>('/api/v1/loyalty/branch-offer-rules', {
    ...query,
  })
}

/** `GET /api/v1/loyalty/branch-offer-rules/{id}` — BranchDiscounts.Read. */
export function getBranchRule(id: string): Promise<BranchOfferRule> {
  return apiGet<BranchOfferRule>(`/api/v1/loyalty/branch-offer-rules/${id}`)
}

/**
 * `POST /api/v1/loyalty/branch-offer-rules` — BranchDiscounts.Create.
 *
 * The branch must belong to the offer's merchant, and only one rule may exist per
 * offer-and-branch pair; a second returns 409.
 */
export function createBranchRule(
  body: CreateBranchOfferRuleRequest,
): Promise<BranchOfferRule> {
  return apiPost<BranchOfferRule>('/api/v1/loyalty/branch-offer-rules', body)
}

/** `PUT /api/v1/loyalty/branch-offer-rules/{id}` — BranchDiscounts.Update. Sparse. */
export function updateBranchRule(
  id: string,
  body: UpdateBranchOfferRuleRequest,
): Promise<BranchOfferRule> {
  return apiPut<BranchOfferRule>(`/api/v1/loyalty/branch-offer-rules/${id}`, body)
}

/**
 * `DELETE /api/v1/loyalty/branch-offer-rules/{id}` — BranchDiscounts.Delete.
 *
 * Safe for issued vouchers: each carries its own snapshot, so this only affects
 * future activations at that branch.
 */
export function deleteBranchRule(id: string): Promise<void> {
  return apiDelete(`/api/v1/loyalty/branch-offer-rules/${id}`)
}
