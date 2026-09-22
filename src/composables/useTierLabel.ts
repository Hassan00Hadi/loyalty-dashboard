import { useI18n } from 'vue-i18n'

/**
 * Localises the tier the backend reports.
 *
 * The mapping from rank to tier — P1 → Bronze, P2 → Silver, P3 and above → Gold
 * — belongs to the server, which sends the result as `displayTier`. This only
 * translates that string for display: Bronze → برونزي, Silver → فضي,
 * Gold → ذهبي.
 *
 * Nothing here derives a tier from a level. Doing so would duplicate a business
 * rule the backend owns, and would silently disagree with it the moment a rank
 * is added.
 */

/** The tiers the backend currently emits, for the message lookup. */
const KNOWN_TIERS: Record<string, string> = {
  bronze: 'tiers.displayTier.bronze',
  silver: 'tiers.displayTier.silver',
  gold: 'tiers.displayTier.gold',
}

export function useTierLabel() {
  const { t, te } = useI18n()

  /**
   * The display name for a tier.
   *
   * An unrecognised value is shown as the backend sent it rather than being
   * hidden, so a newly added tier appears immediately instead of vanishing.
   */
  function tierLabel(displayTier: string | null | undefined, fallback?: string | null): string {
    if (!displayTier) return fallback ?? ''

    const key = KNOWN_TIERS[displayTier.trim().toLowerCase()]
    if (key && te(key)) return t(key)

    return displayTier
  }

  return { tierLabel }
}
