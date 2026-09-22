import { apiPost } from './client'
import type { ProcessSubscriptionRequest, ProcessSubscriptionResponse } from '@/types/models'

/**
 * `POST /api/v1/loyalty/subscriptions/process` — Subscriptions.Process.
 *
 * Awards points for a subscription the billing system has taken. Only `userId`
 * and `price` are required, and the award is computed server-side from `price`
 * alone — the dashboard never calculates points and never consults a package rule.
 *
 * This endpoint is not idempotent: the same body submitted twice awards twice.
 * The caller is therefore responsible for not sending it twice, which the form
 * enforces by disabling submit for the duration of the request. No duplicate
 * detection is attempted on `subscriptionId`.
 */
export function processSubscription(
  body: ProcessSubscriptionRequest,
): Promise<ProcessSubscriptionResponse> {
  return apiPost<ProcessSubscriptionResponse>('/api/v1/loyalty/subscriptions/process', body)
}
