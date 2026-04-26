import {
  TOP_QUARTILE, TOP_HALF, BOTTOM_QUARTILE, BOTTOM_20,
  FATIGUE_KILL, FATIGUE_REFRESH, SATURATION,
  HIGH_SPEND, MIN_SPEND, MIN_DAYS_HIGH,
} from './config.js'

// Evaluate creative health for a single ad.
// `ad` must have: daysActive, spend, fatigueScore, saturationScore,
//                 trendDirection, spendVelocity, p_roas_percentile (may be null)
export function evaluateCreativeHealth(ad) {
  const {
    daysActive, spend, fatigueScore, saturationScore,
    trendDirection, spendVelocity,
    p_roas_percentile: pRoasPct,
  } = ad

  // 1. Too new
  if (daysActive < 4 || spend < MIN_SPEND) return 'Too new'

  // 2. Kill
  const bottom20   = pRoasPct !== null && pRoasPct <= BOTTOM_20
  const bottomQrt  = pRoasPct !== null && pRoasPct <= BOTTOM_QUARTILE
  if (
    fatigueScore > FATIGUE_KILL ||
    (bottom20   && daysActive >= MIN_DAYS_HIGH && spend >= HIGH_SPEND) ||
    (spendVelocity < 0.4 && bottomQrt)
  ) return 'Kill'

  // 3. Refresh soon
  if (
    (fatigueScore >= FATIGUE_REFRESH && fatigueScore <= FATIGUE_KILL) ||
    trendDirection === 'Fatiguing'
  ) return 'Refresh soon'

  // 4. Audience saturated
  if (saturationScore > SATURATION) return 'Audience saturated'

  // 5. Inconsistent
  if (trendDirection === 'Volatile') return 'Inconsistent'

  // 6. Scale
  const topQrt = pRoasPct !== null && pRoasPct >= TOP_QUARTILE
  if (
    topQrt &&
    fatigueScore < 30 &&
    daysActive >= MIN_DAYS_HIGH &&
    ['Improving', 'Stable', 'Scaling well'].includes(trendDirection) &&
    spendVelocity > 1.0
  ) return 'Scale'

  // 7. Monitor
  if (fatigueScore >= 50 && fatigueScore < FATIGUE_REFRESH) return 'Monitor'

  // 8. Healthy
  const topHalf = pRoasPct !== null && pRoasPct >= TOP_HALF
  if (topHalf && fatigueScore < 50) return 'Healthy'

  // 9. Underperforming (fallthrough)
  return 'Underperforming'
}
