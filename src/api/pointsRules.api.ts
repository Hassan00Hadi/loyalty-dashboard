import { apiGet, apiPatch, apiPost } from './client'
import type {
  CreatePointsRuleRequest,
  PointsRule,
  UpdatePointsRuleRequest,
} from '@/types/models'

/**
 * Points rules: named amounts of points ("Referral bonus — 500 points").
 *
 * There is no delete — a rule is retired by deactivating it.
 */

/**
 * `GET /api/v1/loyalty/points-rules` — PointsRules.Read.
 *
 * Every rule, active and inactive, sorted by title with untitled rules last. Not
 * paged or filtered on the server, so the page searches and filters in the browser.
 */
export function listPointsRules(): Promise<PointsRule[]> {
  return apiGet<PointsRule[]>('/api/v1/loyalty/points-rules')
}

/** `GET /api/v1/loyalty/points-rules/{id}` — PointsRules.Read. */
export function getPointsRule(id: string): Promise<PointsRule> {
  return apiGet<PointsRule>(`/api/v1/loyalty/points-rules/${id}`)
}

/** `POST /api/v1/loyalty/points-rules` — PointsRules.Create. */
export function createPointsRule(body: CreatePointsRuleRequest): Promise<PointsRule> {
  return apiPost<PointsRule>('/api/v1/loyalty/points-rules', body)
}

/** `PATCH /api/v1/loyalty/points-rules/{id}` — PointsRules.Update. Sparse. */
export function updatePointsRule(id: string, body: UpdatePointsRuleRequest): Promise<PointsRule> {
  return apiPatch<PointsRule>(`/api/v1/loyalty/points-rules/${id}`, body)
}
