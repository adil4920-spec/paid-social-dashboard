import {
  TOP_QUARTILE, TOP_HALF, BOTTOM_QUARTILE, BOTTOM_20,
  ROAS_GAP_AMBER, MIN_DAYS_HIGH,
} from './config.js'

// Evaluate health for a single campaign.
// `campaign` must have: daysActive, l7 (spend, roas, iRoas), roasGapPct,
//                       spendSharePct, iPurchaseSharePct,
//                       p_roas_percentile, i_roas_percentile, trendDirection
// `adsets` is the array of all adsets with adset_health already computed,
//           filtered to those belonging to this campaign.
export function evaluateCampaignHealth(campaign, adsets = []) {
  const {
    daysActive,
    p_roas_percentile: pPct,
    i_roas_percentile: iPct,
    roasGapPct: gapPct,
    spendSharePct     = 0,
    iPurchaseSharePct = 0,
    l7 = {},
    trendDirection,
  } = campaign

  const spend = l7.spend ?? 0

  // 1. Too new
  if (daysActive < 7 || spend < 500) return 'Too new'

  // Adset quality check
  const killOrRestructure = adsets.filter(a =>
    ['Kill', 'Restructure'].includes(a.adset_health)
  ).length
  const adsetPct = adsets.length > 0 ? killOrRestructure / adsets.length : 0

  // 2. Restructure
  if (
    adsetPct > 0.5 ||
    (spendSharePct - iPurchaseSharePct > 15)
  ) return 'Restructure'

  // 3. Defund
  const topQuarterP = pPct !== null && pPct >= TOP_QUARTILE
  const bottomQrtI  = iPct !== null && iPct <= BOTTOM_QUARTILE
  if (
    (spendSharePct - iPurchaseSharePct > 10)   ||
    (gapPct != null && gapPct > 70 && spendSharePct > 15)
  ) return 'Defund'

  // 5. Investigate attribution (check before Scale)
  if (
    topQuarterP &&
    bottomQrtI  &&
    gapPct != null && gapPct > 70
  ) return 'Investigate attribution'

  // 4. Scale
  const topHalfI = iPct === null || iPct >= TOP_HALF
  if (
    (iPurchaseSharePct - spendSharePct > 10) ||
    (topHalfI && trendDirection === 'Scaling well')
  ) return 'Scale'

  // 6. Volume opportunity — not hitting budget but incremental is healthy
  const topHalfP = pPct !== null && pPct >= TOP_HALF
  if (topHalfP && topHalfI && trendDirection !== 'Declining') return 'Volume opportunity'

  // 7. Monitor
  if (
    trendDirection === 'Volatile' ||
    (gapPct != null && gapPct >= 40 && gapPct <= 70 && spend > 200)
  ) return 'Monitor'

  // 8. Healthy
  if (topHalfP && topHalfI) return 'Healthy'

  // 9. Underperforming
  return 'Underperforming'
}
