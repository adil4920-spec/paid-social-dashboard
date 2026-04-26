import {
  TOP_QUARTILE, TOP_HALF, BOTTOM_20,
  SATURATION, FREQ_SATURATION, FREQ_HEALTHY_MAX,
  ROAS_GAP_AMBER, MIN_DAYS_HIGH, MIN_SPEND,
} from './config.js'

// Evaluate health for a single ad set.
// `adset` must have: daysActive, l7 (roas, cpa, frequency, spend, iRoas),
//                    roasGapPct, saturationScore, reachGrowth,
//                    trendDirection, p_roas_percentile, i_roas_percentile
export function evaluateAdsetHealth(adset) {
  const {
    daysActive,
    p_roas_percentile: pPct,
    i_roas_percentile: iPct,
    saturationScore, reachGrowth,
    roasGapPct: gapPct,
    trendDirection,
    l7 = {},
  } = adset
  const spend = l7.spend ?? 0
  const freq  = l7.frequency ?? 0

  // 1. Too new
  if (daysActive < 4 || spend < MIN_SPEND) return 'Too new'

  const bottom20Both = pPct !== null && pPct <= BOTTOM_20 &&
                       (iPct === null || iPct <= BOTTOM_20)

  // 2. Kill
  if (
    (saturationScore > SATURATION && freq > FREQ_SATURATION) ||
    (gapPct != null && gapPct > 80 && spend > 500)           ||
    (bottom20Both && daysActive >= MIN_DAYS_HIGH)
  ) return 'Kill'

  // 3. Restructure
  const topHalfP = pPct !== null && pPct >= TOP_HALF
  if (
    freq > FREQ_SATURATION ||
    (gapPct != null && gapPct > 70 && topHalfP)
  ) return 'Restructure'

  // 4. Refresh audience
  if (
    (saturationScore >= 60 && saturationScore <= SATURATION) ||
    (freq > 4 && (reachGrowth ?? 0) < 5)
  ) return 'Refresh audience'

  // 5. Cap too tight — strong platform + incremental rankings, very efficient CPA
  const topHalfI = iPct === null || iPct >= TOP_HALF
  if (topHalfP && topHalfI && (l7.cpa ?? 0) > 0 && (l7.cpa ?? 999) < 20) return 'Cap too tight'

  // 6. Scale
  const topQrtP = pPct !== null && pPct >= TOP_QUARTILE
  if (
    topQrtP &&
    topHalfI &&
    freq < FREQ_HEALTHY_MAX &&
    daysActive >= MIN_DAYS_HIGH &&
    ['Improving', 'Stable', 'Scaling well'].includes(trendDirection) &&
    (gapPct == null || gapPct < ROAS_GAP_AMBER)
  ) return 'Scale'

  // 7. Monitor
  if (
    trendDirection === 'Volatile' ||
    (gapPct != null && gapPct > ROAS_GAP_AMBER && gapPct <= 70)
  ) return 'Monitor'

  // 8. Healthy
  if (topHalfP && topHalfI && freq < FREQ_SATURATION) return 'Healthy'

  // 9. Underperforming
  return 'Underperforming'
}
