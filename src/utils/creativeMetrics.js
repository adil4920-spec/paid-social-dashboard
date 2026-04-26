import { FATIGUE_KILL, FATIGUE_REFRESH, SATURATION, MIN_SPEND } from '../lib/decision-logic/config.js'
import { addRoasPercentiles }    from '../lib/decision-logic/percentiles.js'
import { evaluateCreativeHealth } from '../lib/decision-logic/creativeHealth.js'

// ── Re-exports for backwards compat ──────────────────────────────────────────
export { FATIGUE_KILL, FATIGUE_REFRESH, SATURATION, MIN_SPEND }
export const MIN_SPEND_DEFAULT     = MIN_SPEND
export const FATIGUE_THRESHOLDS    = { healthy: 30, watch: FATIGUE_REFRESH }
export const SATURATION_THRESHOLDS = { healthy: 40, watch: SATURATION }

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── computeAdMetrics ─────────────────────────────────────────────────────────
// Computes all raw metrics for a single ad. Does NOT compute percentile-based
// health — call computeAdPercentiles() on the full array afterwards.
export function computeAdMetrics(adName, adRows, maxDate, medians) {
  const sorted = [...adRows].sort((a, b) => a.date.localeCompare(b.date))

  const firstDate = sorted[0]?.date ?? maxDate
  const daysActive = Math.max(1,
    Math.round((new Date(maxDate) - new Date(firstDate)) / 86400000) + 1
  )

  const T = sorted.reduce((a, r) => {
    a.spend       += r.spend
    a.revenue     += r.revenue
    a.impressions += r.impressions
    a.clicks      += r.clicks
    a.reach       += r.reach      || 0
    a.atc         += r.atc        || 0
    a.purchases   += r.purchases  || 0
    a.v3          += r.views3sec  || 0
    a.v25         += r.views25pct || 0
    a.freqWt      += (r.frequency || 0) * r.impressions
    return a
  }, { spend:0, revenue:0, impressions:0, clicks:0, reach:0, atc:0, purchases:0, v3:0, v25:0, freqWt:0 })

  const roas      = T.spend > 0       ? T.revenue / T.spend          : 0
  const cpa       = T.purchases > 0   ? T.spend   / T.purchases      : 0
  const ctr       = T.impressions > 0 ? T.clicks  / T.impressions    : 0
  const cpm       = T.impressions > 0 ? T.spend   / T.impressions * 1000 : 0
  const frequency = T.impressions > 0 ? T.freqWt  / T.impressions    : 0
  const thumbStop = T.impressions > 0 ? T.v3      / T.impressions    : 0
  const hookRate  = T.impressions > 0 ? T.v25     / T.impressions    : 0
  const holdRate  = T.v3 > 0          ? T.v25     / T.v3             : 0
  const atcRate   = T.atc > 0         ? T.purchases / T.atc          : 0

  function winAgg(rows) {
    const w = rows.reduce((a, r) => {
      a.spend       += r.spend
      a.revenue     += r.revenue
      a.impressions += r.impressions
      a.clicks      += r.clicks
      a.reach       += r.reach      || 0
      a.v3          += r.views3sec  || 0
      a.freqWt      += (r.frequency || 0) * r.impressions
      return a
    }, { spend:0, revenue:0, impressions:0, clicks:0, reach:0, v3:0, freqWt:0 })
    return {
      ...w,
      roas:      w.spend > 0       ? w.revenue / w.spend              : 0,
      ctr:       w.impressions > 0 ? w.clicks  / w.impressions        : 0,
      cpm:       w.impressions > 0 ? w.spend   / w.impressions * 1000 : 0,
      thumbStop: w.impressions > 0 ? w.v3      / w.impressions        : 0,
      frequency: w.impressions > 0 ? w.freqWt  / w.impressions        : 0,
    }
  }

  const l7 = winAgg(sorted.filter(r => r.date >= addDays(maxDate, -6)))
  const p7 = winAgg(sorted.filter(r => r.date >= addDays(maxDate, -13) && r.date <= addDays(maxDate, -7)))

  function pct(a, b) { return b > 0 ? (a - b) / b : 0 }

  const roasChg  = pct(l7.roas,      p7.roas)
  const ctrChg   = pct(l7.ctr,       p7.ctr)
  const thumbChg = pct(l7.thumbStop, p7.thumbStop)
  const spendChg = pct(l7.spend,     p7.spend)
  const cpmChg   = pct(l7.cpm,       p7.cpm)
  const freqChg  = pct(l7.frequency, p7.frequency)

  const l3 = sorted.filter(r => r.date >= addDays(maxDate, -2)).reduce((s, r) => s + r.spend, 0)
  const p3 = sorted.filter(r => r.date >= addDays(maxDate, -5) && r.date <= addDays(maxDate, -3)).reduce((s, r) => s + r.spend, 0)
  const spendVelocity = p3 > 0 ? l3 / p3 : l3 > 0 ? 2 : 1

  const fatigueScore = Math.round(
    Math.min(100, Math.max(0, (frequency - 1.5) / 3.5 * 100)) * 0.30 +
    (p7.ctr      > 0 ? Math.min(100, Math.max(0, ((p7.ctr      - l7.ctr)      / p7.ctr)      * 200)) : 0) * 0.25 +
    (p7.thumbStop > 0 ? Math.min(100, Math.max(0, ((p7.thumbStop - l7.thumbStop) / p7.thumbStop) * 200)) : 0) * 0.20 +
    Math.min(100, Math.max(0, (daysActive - 7) / 23 * 100)) * 0.15 +
    (p7.roas     > 0 ? Math.min(100, Math.max(0, ((p7.roas     - l7.roas)     / p7.roas)     * 200)) : 0) * 0.10
  )

  const saturationScore = Math.round(
    (p7.reach     > 0 ? Math.min(100, Math.max(0, (1 - l7.reach / p7.reach) * 100)) : 0) * 0.40 +
    (p7.cpm       > 0 ? Math.min(100, Math.max(0, ((l7.cpm - p7.cpm) / p7.cpm) * 200)) : 0) * 0.30 +
    (p7.frequency > 0 ? Math.min(100, Math.max(0, ((l7.frequency - p7.frequency) / p7.frequency) * 200)) : 0) * 0.30
  )

  function norm(v, med) { return Math.min(100, med > 0 ? (v / med) * 50 : 50) }
  const engagementScore = Math.round(
    norm(thumbStop, medians.thumbStop) * 0.25 +
    norm(hookRate,  medians.hookRate)  * 0.25 +
    norm(holdRate,  medians.holdRate)  * 0.25 +
    norm(ctr,       medians.ctr)       * 0.25
  )

  const l7Start = addDays(maxDate, -6)
  const dailyMap = {}
  for (const r of sorted.filter(r => r.date >= l7Start)) {
    if (!dailyMap[r.date]) dailyMap[r.date] = { s: 0, r: 0 }
    dailyMap[r.date].s += r.spend
    dailyMap[r.date].r += r.revenue
  }
  const sparkline = Array.from({ length: 7 }, (_, i) => {
    const d   = addDays(maxDate, -(6 - i))
    const day = dailyMap[d]
    return day && day.s > 0 ? day.r / day.s : null
  })

  const validRoas = sparkline.filter(v => v != null)
  let volatile = false
  if (validRoas.length >= 3) {
    const mean = validRoas.reduce((s, v) => s + v, 0) / validRoas.length
    const sd   = Math.sqrt(validRoas.reduce((s, v) => s + (v - mean) ** 2, 0) / validRoas.length)
    volatile = mean > 0 && sd / mean > 0.5
  }

  let trendDirection
  if      (daysActive < 4 || T.spend < MIN_SPEND)                                        trendDirection = 'New'
  else if (freqChg > 0.25 && ctrChg < -0.10 && roasChg < -0.15)                          trendDirection = 'Fatiguing'
  else if (cpmChg > 0.20 && l7.reach < p7.reach * 0.10)                                   trendDirection = 'Saturating'
  else if (spendChg > 0.25 && roasChg > -0.05)                                            trendDirection = 'Scaling well'
  else if (roasChg > 0.15 && freqChg < 0.50)                                              trendDirection = 'Improving'
  else if (volatile)                                                                        trendDirection = 'Volatile'
  else if (roasChg < -0.10 && (ctrChg < -0.10 || thumbChg < -0.10))                       trendDirection = 'Declining'
  else                                                                                      trendDirection = 'Stable'

  // p_roas_percentile is null here — set by computeAdPercentiles() after the full array is built
  return {
    ad_name: adName, spend: T.spend, daysActive, roas, cpa, ctr, cpm, frequency,
    thumbStop, hookRate, holdRate, atcRate, spendVelocity,
    fatigueScore, saturationScore, engagementScore,
    trendDirection,
    // creativeHealth is provisional; computeAdPercentiles() will finalise it
    creativeHealth: 'Too new',
    p_roas_percentile: null,
    sparkline,
    fatigueFlag:    adRows.some(r => r.fatigueFlag    === 'FATIGUED') ? 'FATIGUED' : 'OK',
    efficiencyFlag: adRows.some(r => r.efficiencyFlag === 'REVIEW')   ? 'REVIEW'   : 'OK',
  }
}

// ── computeAdPercentiles ──────────────────────────────────────────────────────
// Two-pass finalisation: adds p_roas_percentile and evaluates creativeHealth
// using the percentile-based logic. Call after building the full ad array.
export function computeAdPercentiles(adMetrics) {
  const withPct = addRoasPercentiles(adMetrics)
  return withPct.map(ad => ({
    ...ad,
    creativeHealth: evaluateCreativeHealth(ad),
  }))
}

// ── computeAccountMedians ─────────────────────────────────────────────────────
export function computeAccountMedians(adGroups) {
  const vals = Object.values(adGroups).map(rows => {
    const imp = rows.reduce((s, r) => s + r.impressions, 0)
    const v3  = rows.reduce((s, r) => s + (r.views3sec  || 0), 0)
    const v25 = rows.reduce((s, r) => s + (r.views25pct || 0), 0)
    const clk = rows.reduce((s, r) => s + r.clicks, 0)
    return {
      thumbStop: imp > 0 ? v3  / imp : 0,
      hookRate:  imp > 0 ? v25 / imp : 0,
      holdRate:  v3  > 0 ? v25 / v3  : 0,
      ctr:       imp > 0 ? clk / imp : 0,
    }
  })
  function med(arr) {
    const s = arr.filter(v => v > 0).sort((a, b) => a - b)
    return s.length ? s[Math.floor(s.length / 2)] : 0
  }
  return {
    thumbStop: med(vals.map(v => v.thumbStop)),
    hookRate:  med(vals.map(v => v.hookRate)),
    holdRate:  med(vals.map(v => v.holdRate)),
    ctr:       med(vals.map(v => v.ctr)),
  }
}
