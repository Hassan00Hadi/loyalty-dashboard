import { apiGet, apiPatch, apiPost, apiPut } from './client'
import type {
  CreateMembershipTierRequest,
  LoyaltyConfiguration,
  MembershipTier,
  UpdateLoyaltyConfigurationRequest,
  UpdateMembershipTierRequest,
} from '@/types/models'

/**
 * Loyalty configuration: the point formula and membership tiers.
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

