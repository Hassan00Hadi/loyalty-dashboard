import { apiGet, apiPatch, apiPost, apiPut } from './client'
import type {
  CreateLoyaltyPackageRequest,
  CreateMembershipTierRequest,
  CreatePackagePointRuleRequest,
  LoyaltyConfiguration,
  LoyaltyPackage,
  MembershipTier,
  PackagePointRule,
  UpdateLoyaltyConfigurationRequest,
  UpdateLoyaltyPackageRequest,
  UpdateMembershipTierRequest,
  UpdatePackagePointRuleRequest,
} from '@/types/models'

/**
 * Loyalty configuration: the point formula, membership tiers, packages and the
 * legacy package point rules.
 */

// ── Point settings ────────────────────────────────────────────────────────────
// The formula is expressed as "every `amountIqd` spent earns `points` points".
// The arithmetic itself stays on the server; the dashboard only previews it.

/** `GET /api/v1/loyalty/configuration` — LoyaltyConfiguration.Read. */
export function getConfiguration(): Promise<LoyaltyConfiguration> {
  return apiGet<LoyaltyConfiguration>('/api/v1/loyalty/configuration')
}

/** `PUT /api/v1/loyalty/configuration` — LoyaltyConfiguration.Update. */
export function updateConfiguration(
  body: UpdateLoyaltyConfigurationRequest,
): Promise<LoyaltyConfiguration> {
  return apiPut<LoyaltyConfiguration>('/api/v1/loyalty/configuration', body)
}

// ── Membership tiers ──────────────────────────────────────────────────────────

/** `GET /api/v1/loyalty/tiers` — MembershipTiers.Read. Not paged. */
export function listTiers(): Promise<MembershipTier[]> {
  return apiGet<MembershipTier[]>('/api/v1/loyalty/tiers')
}

/** `POST /api/v1/loyalty/tiers` — MembershipTiers.Create. */
export function createTier(body: CreateMembershipTierRequest): Promise<MembershipTier> {
  return apiPost<MembershipTier>('/api/v1/loyalty/tiers', body)
}

/** `PATCH /api/v1/loyalty/tiers/{id}` — MembershipTiers.Update. */
export function updateTier(
  id: string,
  body: UpdateMembershipTierRequest,
): Promise<MembershipTier> {
  return apiPatch<MembershipTier>(`/api/v1/loyalty/tiers/${id}`, body)
}

// ── Loyalty packages ──────────────────────────────────────────────────────────

/** `GET /api/v1/loyalty/packages` — Packages.Read. Not paged. */
export function listPackages(): Promise<LoyaltyPackage[]> {
  return apiGet<LoyaltyPackage[]>('/api/v1/loyalty/packages')
}

/** `POST /api/v1/loyalty/packages` — Packages.Create. */
export function createPackage(body: CreateLoyaltyPackageRequest): Promise<LoyaltyPackage> {
  return apiPost<LoyaltyPackage>('/api/v1/loyalty/packages', body)
}

/** `PATCH /api/v1/loyalty/packages/{id}` — Packages.Update. */
export function updatePackage(
  id: string,
  body: UpdateLoyaltyPackageRequest,
): Promise<LoyaltyPackage> {
  return apiPatch<LoyaltyPackage>(`/api/v1/loyalty/packages/${id}`, body)
}

// ── Package point rules ───────────────────────────────────────────────────────
// Retained because the endpoints exist and are permissioned, but note that
// subscription processing no longer consults them: awards come from the global
// point formula above. The UI says so on the page itself.

/** `GET /api/v1/loyalty/package-point-rules` — PackageRules.Read. */
export function listPackageRules(loyaltyPackageId?: string | null): Promise<PackagePointRule[]> {
  return apiGet<PackagePointRule[]>('/api/v1/loyalty/package-point-rules', { loyaltyPackageId })
}

/** `POST /api/v1/loyalty/package-point-rules` — PackageRules.Create. */
export function createPackageRule(
  body: CreatePackagePointRuleRequest,
): Promise<PackagePointRule> {
  return apiPost<PackagePointRule>('/api/v1/loyalty/package-point-rules', body)
}

/** `PATCH /api/v1/loyalty/package-point-rules/{id}` — PackageRules.Update. */
export function updatePackageRule(
  id: string,
  body: UpdatePackagePointRuleRequest,
): Promise<PackagePointRule> {
  return apiPatch<PackagePointRule>(`/api/v1/loyalty/package-point-rules/${id}`, body)
}
