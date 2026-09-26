import type { AdminOffer, BranchOfferRule, DiscountType } from '@/types/models'

/**
 * What an offer actually costs and gives at each branch.
 *
 * Mirrors the backend's precedence for the member-facing offer endpoints: a branch
 * rule, when one exists, replaces the offer's defaults at that branch; otherwise
 * the defaults apply. Only the choice between the two is made here — whether a
 * rule applies right now is the server's `isApplicableNow`, never re-derived.
 */

/** A branch the offer can be redeemed at, from whichever source the page has. */
export interface PricingBranch {
  id: string
  name: string
  cityName: string | null
  /** Null when the branch's own record could not be read (no `Branches.Read`). */
  isActive: boolean | null
}

export type EffectiveStatus =
  /** No rule: the offer's own terms, under the offer's own status. */
  | 'default'
  | 'active'
  | 'inactive'
  /** Active, but the server says it does not apply now — outside its date window. */
  | 'outsideWindow'

/** One row of the branch pricing table. A view model only; nothing here is sent. */
export interface EffectiveBranchRow {
  branch: PricingBranch
  rule: BranchOfferRule | null
  requiredPoints: number
  discountType: DiscountType
  discountValue: number
  validityDays: number
  /** Which values the rule changes from the offer default, for highlighting. */
  overrides: { requiredPoints: boolean; discount: boolean; validityDays: boolean }
  status: EffectiveStatus
  /**
   * False for a rule on a branch the offer is no longer restricted to. The rule
   * still exists and still counts, so the row is shown rather than hidden.
   */
  inScope: boolean
}

type OfferDefaults = Pick<AdminOffer, 'requiredPoints' | 'discountType' | 'discountValue' | 'validDays'>

function ruleStatus(rule: BranchOfferRule): EffectiveStatus {
  if (rule.isApplicableNow) return 'active'
  return rule.isActive ? 'outsideWindow' : 'inactive'
}

export function effectiveRow(
  offer: OfferDefaults,
  branch: PricingBranch,
  rule: BranchOfferRule | null,
  inScope = true,
): EffectiveBranchRow {
  if (!rule) {
    return {
      branch,
      rule: null,
      requiredPoints: offer.requiredPoints,
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      validityDays: offer.validDays,
      overrides: { requiredPoints: false, discount: false, validityDays: false },
      status: 'default',
      inScope,
    }
  }

  return {
    branch,
    rule,
    requiredPoints: rule.requiredPoints,
    discountType: rule.discountType,
    discountValue: rule.discountValue,
    validityDays: rule.voucherValidityDays,
    overrides: {
      requiredPoints: rule.requiredPoints !== offer.requiredPoints,
      // A type change alone is an override even when the number is the same:
      // 20% and 20 IQD are not the same discount.
      discount:
        rule.discountType !== offer.discountType || rule.discountValue !== offer.discountValue,
      validityDays: rule.voucherValidityDays !== offer.validDays,
    },
    status: ruleStatus(rule),
    inScope,
  }
}

/**
 * One row per applicable branch, in the order given, followed by any rule whose
 * branch is outside the offer's scope.
 *
 * `rules` must be the offer's own rules (fetched with `offerId`); a rule for a
 * different offer would be matched to a branch by id and shown as an override.
 */
export function effectiveBranchRows(
  offer: OfferDefaults,
  branches: PricingBranch[],
  rules: BranchOfferRule[],
): EffectiveBranchRow[] {
  const byBranch = new Map(rules.map((rule) => [rule.branchId, rule]))
  const rows = branches.map((branch) => effectiveRow(offer, branch, byBranch.get(branch.id) ?? null))

  const scoped = new Set(branches.map((branch) => branch.id))
  for (const rule of rules) {
    if (scoped.has(rule.branchId)) continue
    rows.push(
      effectiveRow(
        offer,
        { id: rule.branchId, name: rule.branchName ?? rule.branchId, cityName: null, isActive: null },
        rule,
        false,
      ),
    )
  }
  return rows
}
