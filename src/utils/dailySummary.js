import {
  TOP_QUARTILE, TOP_HALF, BOTTOM_20,
  FATIGUE_KILL, FATIGUE_REFRESH, SATURATION, FREQ_SATURATION, FREQ_HEALTHY_MAX,
  ROAS_GAP_AMBER, ROAS_GAP_GENUINE,
  HIGH_SPEND, MIN_SPEND, MIN_DAYS_HIGH, MIN_DAYS_MED,
  MEANINGFUL_CHANGE,
} from '../lib/decision-logic/config.js'
import { addRoasPercentiles, addIncrementalPercentiles, percentileBand } from '../lib/decision-logic/percentiles.js'
import { evaluateAdsetHealth }    from '../lib/decision-logic/adsetHealth.js'
import { evaluateCampaignHealth } from '../lib/decision-logic/campaignHealth.js'
import { roasGapLabel }           from '../lib/decision-logic/incrementality.js'

// ── Re-export legacy DS shape so existing imports don't break ─────────────────
export const DS = {
  TARGET_ROAS: null, TARGET_CPA: null,  // removed — methodology is now target-free
  FATIGUE_KILL, FATIGUE_REFRESH, SATURATION, FREQ_SATURATION, FREQ_HEALTHY_MAX,
  CONF_HIGH_DAYS: MIN_DAYS_HIGH, CONF_MED_DAYS: MIN_DAYS_MED, CONF_HIGH_SPEND: 300,
  CONCENTRATION_PCT: 50,
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function pctChg(a, b) { return b > 0 ? (a - b) / b * 100 : 0 }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)) }

// ── winAgg — includes incremental ────────────────────────────────────────────
export function winAgg(rows) {
  if (!rows.length) return {
    spend: 0, revenue: 0, purchases: 0, impressions: 0, clicks: 0,
    reach: 0, atc: 0, checkouts: 0, freqSum: 0,
    iRevenue: 0, iPurchases: 0,
    roas: 0, cpa: 0, cpm: 0, ctr: 0, frequency: 0, atcRate: 0, checkoutRate: 0,
    iRoas: 0, roasGapPct: null,
  }
  const t = rows.reduce((a, r) => {
    a.spend       += r.spend
    a.revenue     += r.revenue
    a.purchases   += r.purchases
    a.impressions += r.impressions
    a.clicks      += r.clicks
    a.reach       += r.reach       || 0
    a.atc         += r.atc         || 0
    a.checkouts   += r.checkouts   || 0
    a.freqSum     += (r.frequency  || 0) * r.impressions
    a.iRevenue    += r.iRevenue    || 0
    a.iPurchases  += r.iPurchases  || 0
    return a
  }, { spend:0, revenue:0, purchases:0, impressions:0, clicks:0, reach:0, atc:0, checkouts:0, freqSum:0, iRevenue:0, iPurchases:0 })

  const iRoas      = t.spend > 0 && t.iRevenue > 0 ? t.iRevenue / t.spend : 0
  const pRoas      = t.spend > 0 ? t.revenue / t.spend : 0
  const roasGapPct = pRoas > 0 && iRoas > 0 ? ((pRoas - iRoas) / pRoas) * 100 : null

  return {
    ...t,
    roas:        pRoas,
    iRoas,
    roasGapPct,
    cpa:         t.purchases > 0   ? t.spend     / t.purchases         : 0,
    cpm:         t.impressions > 0 ? t.spend     / t.impressions * 1000 : 0,
    ctr:         t.impressions > 0 ? t.clicks    / t.impressions       : 0,
    frequency:   t.impressions > 0 ? t.freqSum   / t.impressions       : 0,
    atcRate:     t.atc > 0         ? t.purchases / t.atc               : 0,
    checkoutRate:t.checkouts > 0   ? t.purchases / t.checkouts         : 0,
  }
}

// ── Adset trend direction (l7 vs p7) ─────────────────────────────────────────
function adsetTrend(l7, p7) {
  const roasChg = pctChg(l7.roas, p7.roas)
  const ctrChg  = pctChg(l7.ctr,  p7.ctr)
  const freqChg = pctChg(l7.frequency, p7.frequency)
  const cpmChg  = pctChg(l7.cpm, p7.cpm)
  if (freqChg > 25 && ctrChg < -10 && roasChg < -15) return 'Fatiguing'
  if (cpmChg > 20 && l7.reach < p7.reach * 0.10)     return 'Saturating'
  if (roasChg > 15)                                   return 'Scaling well'
  if (roasChg > MEANINGFUL_CHANGE)                    return 'Improving'
  if (roasChg < -MEANINGFUL_CHANGE && ctrChg < -10)   return 'Declining'
  return 'Stable'
}

// ── computeWindowData ─────────────────────────────────────────────────────────
export function computeWindowData(rows, maxDate) {
  if (!maxDate) {
    return { accountL7: winAgg([]), accountP7: winAgg([]), adsetData: [], campaignData: [] }
  }

  const l7Start = addDays(maxDate, -6)
  const p7Start = addDays(maxDate, -13)
  const p7End   = addDays(maxDate, -7)

  const accountL7 = winAgg(rows.filter(r => r.date >= l7Start && r.date <= maxDate))
  const accountP7 = winAgg(rows.filter(r => r.date >= p7Start && r.date <= p7End))

  // ── Per-adset ──────────────────────────────────────────────────────────────
  const adsetMap = {}
  for (const r of rows) {
    const k = r.adsetName || 'Unknown'
    if (!adsetMap[k]) adsetMap[k] = { name: k, funnel: r.funnel_stage, campaign: r.campaign_name, rows: [] }
    adsetMap[k].rows.push(r)
  }

  let adsetData = Object.values(adsetMap).map(g => {
    const gL7  = winAgg(g.rows.filter(r => r.date >= l7Start && r.date <= maxDate))
    const gP7  = winAgg(g.rows.filter(r => r.date >= p7Start && r.date <= p7End))
    const all  = winAgg(g.rows)
    const days = new Set(g.rows.map(r => r.date)).size

    const reachGrowth = pctChg(gL7.reach, gP7.reach)
    const cpmChg      = pctChg(gL7.cpm,   gP7.cpm)
    const saturationScore = Math.round(
      clamp(cpmChg * 2, 0, 100) * 0.40 +
      clamp((all.frequency - 2) / 3 * 100, 0, 100) * 0.30 +
      clamp(gL7.reach < gP7.reach ? (gP7.reach - gL7.reach) / (gP7.reach || 1) * 100 : 0, 0, 100) * 0.30
    )

    return {
      name: g.name, funnel: g.funnel, campaign: g.campaign,
      daysActive: days, all, l7: gL7, p7: gP7,
      reachGrowth, saturationScore,
      roasGapPct: gL7.roasGapPct,
      iRoas: gL7.iRoas,
      trendDirection: adsetTrend(gL7, gP7),
    }
  }).sort((a, b) => b.l7.spend - a.l7.spend)

  // Add percentile rankings to adsets
  adsetData = addRoasPercentiles(adsetData, {
    getRoas:  a => a.l7.roas,
    getCpa:   a => a.l7.cpa,
    getSpend: a => a.l7.spend,
  })
  adsetData = addIncrementalPercentiles(adsetData, {
    getIRoas: a => a.l7.iRoas,
    getSpend: a => a.l7.spend,
  })

  // Evaluate adset health
  adsetData = adsetData.map(a => ({ ...a, adset_health: evaluateAdsetHealth(a) }))

  // ── Per-campaign ───────────────────────────────────────────────────────────
  const campMap = {}
  for (const r of rows) {
    const k = r.campaign_name || 'Unknown'
    if (!campMap[k]) campMap[k] = { name: k, funnel: r.funnel_stage, rows: [] }
    campMap[k].rows.push(r)
  }

  const totalL7Spend     = accountL7.spend  || 1
  const totalL7iPurchases = accountL7.iPurchases || 1
  const totalL7Purchases  = accountL7.purchases  || 1

  let campaignData = Object.values(campMap).map(g => {
    const gL7  = winAgg(g.rows.filter(r => r.date >= l7Start && r.date <= maxDate))
    const gP7  = winAgg(g.rows.filter(r => r.date >= p7Start && r.date <= p7End))
    const all  = winAgg(g.rows)
    const days = new Set(g.rows.map(r => r.date)).size

    const spendSharePct      = gL7.spend      / totalL7Spend      * 100
    const iPurchaseSharePct  = gL7.iPurchases / totalL7iPurchases * 100
    const purchaseSharePct   = gL7.purchases  / totalL7Purchases  * 100

    const roasChg = pctChg(gL7.roas, gP7.roas)
    let trendDirection
    if      (roasChg > 15)                          trendDirection = 'Scaling well'
    else if (roasChg > MEANINGFUL_CHANGE)           trendDirection = 'Improving'
    else if (roasChg < -MEANINGFUL_CHANGE)          trendDirection = 'Declining'
    else                                            trendDirection = 'Stable'

    return {
      name: g.name, funnel: g.funnel, daysActive: days, all, l7: gL7, p7: gP7,
      spendSharePct, iPurchaseSharePct, purchaseSharePct,
      roasGapPct: gL7.roasGapPct,
      iRoas: gL7.iRoas,
      trendDirection,
    }
  }).sort((a, b) => b.all.spend - a.all.spend)

  // Add percentile rankings to campaigns
  campaignData = addRoasPercentiles(campaignData, {
    getRoas:  c => c.l7.roas,
    getCpa:   c => c.l7.cpa,
    getSpend: c => c.l7.spend,
  })
  campaignData = addIncrementalPercentiles(campaignData, {
    getIRoas: c => c.l7.iRoas,
    getSpend: c => c.l7.spend,
  })

  // Evaluate campaign health (passes adsets belonging to each campaign)
  campaignData = campaignData.map(c => ({
    ...c,
    campaign_health: evaluateCampaignHealth(
      c,
      adsetData.filter(a => a.campaign === c.name)
    ),
  }))

  return { accountL7, accountP7, adsetData, campaignData }
}

// ── Confidence ────────────────────────────────────────────────────────────────
export function calculateConfidence(daysActive, criteriaMet, spend) {
  if (daysActive >= MIN_DAYS_HIGH && criteriaMet >= 2 && spend >= 300) return 'HIGH'
  if (daysActive >= MIN_DAYS_MED  || criteriaMet >= 1) return 'MED'
  return 'LOW'
}

// ── Detail generators ─────────────────────────────────────────────────────────
function adScaleDetail(ad, sc) {
  const band = percentileBand(ad.p_roas_percentile) ?? 'ranked'
  const lines = []
  lines.push(`ROAS ${ad.roas.toFixed(2)}x — ${band} among active ads with A$${Math.round(ad.spend)} spend across ${ad.daysActive} days.`)
  if (ad.fatigueScore < 30) {
    lines.push(`Fatigue score ${ad.fatigueScore}/100 is healthy (below 30), meaning creative engagement is holding week-over-week.`)
  }
  if (ad.spendVelocity > 1.2) {
    lines.push(`Spend velocity ${ad.spendVelocity.toFixed(2)}x — Meta's algorithm is actively increasing delivery, a leading signal of auction competitiveness.`)
  }
  if (sc.includes('trend')) {
    lines.push(`7-day trend is ${ad.trendDirection} — ROAS and engagement moving in the right direction.`)
  }
  if (ad.frequency < 2.5) {
    lines.push(`Frequency ${ad.frequency.toFixed(2)} — audience not yet over-exposed, room to scale before diminishing returns.`)
  }
  return lines.join(' ')
}

function adCutDetail(ad, cc) {
  const band = percentileBand(ad.p_roas_percentile) ?? 'bottom ranked'
  const lines = []
  if (cc.includes('fatigue>80') || (cc.includes('health=Kill') && ad.fatigueScore > FATIGUE_KILL)) {
    lines.push(`Fatigue score ${ad.fatigueScore}/100 exceeds the kill threshold. CTR and thumb-stop have dropped sharply week-over-week, signalling the audience has over-indexed on this creative.`)
  } else if (cc.includes('health=Kill')) {
    lines.push(`ROAS ${ad.roas.toFixed(2)}x is ${band} among active ads with A$${Math.round(ad.spend)} spend over ${ad.daysActive} days — no path to recovery at current performance level.`)
  }
  if (ad.spendVelocity < 0.5) {
    lines.push(`Spend velocity ${ad.spendVelocity.toFixed(2)}x — Meta's algorithm is already pulling back before this manual pause, a leading indicator of continued decline.`)
  }
  if (cc.includes('fatiguing')) {
    lines.push(`Trend is Fatiguing — frequency rising, CTR falling week-over-week. Pausing now preserves budget for a refreshed version of this concept.`)
  }
  if (!lines.length) {
    lines.push(`ROAS ${ad.roas.toFixed(2)}x and fatigue score ${ad.fatigueScore}/100 place this ad in the ${band} of active ads — below acceptable thresholds for continued spend.`)
  }
  return lines.join(' ')
}

function adsetScaleDetail(a) {
  const band  = percentileBand(a.p_roas_percentile) ?? 'top ranked'
  const iBand = percentileBand(a.i_roas_percentile)
  const gap   = a.roasGapPct
  const lines = []
  lines.push(`Platform ROAS ${a.l7.roas.toFixed(2)}x — ${band} among active ad sets.`)
  if (iBand) lines.push(`Incremental ROAS ${a.l7.iRoas.toFixed(2)}x (${iBand})${gap != null ? `, gap ${gap.toFixed(0)}% (${roasGapLabel(gap)})` : ''} — confirms genuine performance, not just attribution noise.`)
  if (a.reachGrowth > 10) lines.push(`Reach growing ${a.reachGrowth.toFixed(0)}% week-over-week — audience pool is expanding with frequency at ${a.l7.frequency.toFixed(2)}.`)
  if (a.l7.cpa > 0 && a.l7.cpa < 30) lines.push(`CPA A$${a.l7.cpa.toFixed(0)} has headroom — room to grow budget without hitting cost ceiling.`)
  return lines.join(' ')
}

function adsetCutDetail(a) {
  const lines = []
  if (a.l7.frequency > FREQ_SATURATION) {
    lines.push(`Frequency ${a.l7.frequency.toFixed(2)}x over 7 days exceeds the ${FREQ_SATURATION}x saturation threshold. Audience is over-exposed — continued delivery degrades performance and brand experience.`)
  }
  if (a.saturationScore > SATURATION) {
    lines.push(`Saturation score ${a.saturationScore}/100 — reach contracting while CPM rises, the signature of an exhausted audience pool.`)
  }
  if (a.roasGapPct != null && a.roasGapPct > 70) {
    lines.push(`ROAS gap ${a.roasGapPct.toFixed(0)}% — Meta is heavily over-claiming credit. Incremental ROAS ${a.l7.iRoas.toFixed(2)}x is the real performance signal; the ad set is not generating proportional new business.`)
  }
  if (!lines.length) {
    lines.push(`Performance has deteriorated below acceptable thresholds over the last 7 days — both platform and incremental signals below account median.`)
  }
  return lines.join(' ')
}

function campScaleDetail(c) {
  const band  = percentileBand(c.p_roas_percentile) ?? 'top ranked'
  const iBand = percentileBand(c.i_roas_percentile)
  const lines = []
  if (c.iPurchaseSharePct > c.spendSharePct + 5) {
    const gap = (c.iPurchaseSharePct - c.spendSharePct).toFixed(0)
    lines.push(`Generating ${c.iPurchaseSharePct.toFixed(0)}% of incremental purchases on ${c.spendSharePct.toFixed(0)}% of spend — ${gap}pt incremental surplus. Budget allocation is not keeping up with this campaign's actual contribution.`)
  } else {
    lines.push(`Platform ROAS ${c.l7.roas.toFixed(2)}x — ${band} among active campaigns.`)
  }
  if (iBand) lines.push(`Incremental ROAS ${c.l7.iRoas.toFixed(2)}x (${iBand}) confirms the uplift is genuine, not attributed demand capture.`)
  return lines.join(' ')
}

function campCutDetail(c) {
  const lines = []
  if (c.spendSharePct > c.iPurchaseSharePct + 5) {
    const gap = (c.spendSharePct - c.iPurchaseSharePct).toFixed(0)
    lines.push(`Consuming ${c.spendSharePct.toFixed(0)}% of spend but only generating ${c.iPurchaseSharePct.toFixed(0)}% of incremental purchases — ${gap}pt incremental deficit. Budget here is not converting to real new business.`)
  }
  if (c.roasGapPct != null && c.roasGapPct > 60) {
    lines.push(`ROAS gap ${c.roasGapPct.toFixed(0)}% — significant platform over-claim. Meta is crediting this campaign for demand it didn't generate.`)
  }
  if (c.l7.roas < 1.2) {
    lines.push(`Platform ROAS ${c.l7.roas.toFixed(2)}x at current spend — even before accounting for attribution inflation, the headline number is weak.`)
  }
  if (!lines.length) {
    lines.push(`Campaign is consuming a disproportionate share of budget relative to its incremental contribution over the last 7 days.`)
  }
  return lines.join(' ')
}

// ── generateScaleCutDecisions ─────────────────────────────────────────────────
export function generateScaleCutDecisions(adMetrics, adsetData, campaignData) {
  // ── Ads ───────────────────────────────────────────────────────────────────
  const adScale = [], adCut = []
  for (const ad of adMetrics) {
    if (ad.creativeHealth === 'Scale') {
      const sc   = ['health=Scale']
      if (ad.spendVelocity > 1.2) sc.push('velocity')
      if (['Improving', 'Scaling well'].includes(ad.trendDirection)) sc.push('trend')
      if (ad.frequency < 2.5) sc.push('freq headroom')
      const conf = calculateConfidence(ad.daysActive, sc.length, ad.spend)
      const mult = sc.length >= 3 ? [0.25, 0.40] : [0.15, 0.25]
      const daily = ad.spend / Math.max(ad.daysActive, 1)
      adScale.push({
        name: ad.ad_name, type: 'ad', daysActive: ad.daysActive, spend: ad.spend,
        current: `Running ${ad.daysActive}d · A$${Math.round(daily)}/day avg`,
        action: `Increase budget +${Math.round(mult[0]*100)}-${Math.round(mult[1]*100)}%`,
        why: `roas ${ad.roas.toFixed(2)}x (${percentileBand(ad.p_roas_percentile) ?? '—'}) · fatigue ${ad.fatigueScore} · freq ${ad.frequency.toFixed(2)}`,
        confidence: conf, criteriaMet: sc,
        detail: adScaleDetail(ad, sc),
      })
    }
    if (['Kill', 'Underperforming'].includes(ad.creativeHealth) && ad.spend > MIN_SPEND) {
      const cc = [ad.creativeHealth === 'Kill' ? 'health=Kill' : 'underperforming']
      if (ad.fatigueScore > FATIGUE_KILL)  cc.push('fatigue>80')
      if (ad.spendVelocity < 0.4)          cc.push('velocity<0.4')
      if (ad.trendDirection === 'Fatiguing') cc.push('fatiguing')
      const conf = calculateConfidence(ad.daysActive, cc.length, ad.spend)
      adCut.push({
        name: ad.ad_name, type: 'ad', daysActive: ad.daysActive, spend: ad.spend,
        current: `Running ${ad.daysActive}d · A$${Math.round(ad.spend / Math.max(ad.daysActive,1))}/day avg`,
        action: ad.spend > HIGH_SPEND ? 'Pause — replace with refreshed creative' : 'Pause',
        why: `roas ${ad.roas.toFixed(2)}x (${percentileBand(ad.p_roas_percentile) ?? '—'}) · fatigue ${ad.fatigueScore} · velocity ${ad.spendVelocity.toFixed(2)}x`,
        confidence: conf, criteriaMet: cc,
        detail: adCutDetail(ad, cc),
      })
    }
  }

  // ── Ad sets ───────────────────────────────────────────────────────────────
  const adsetScale = [], adsetCut = []
  for (const a of adsetData) {
    const band  = percentileBand(a.p_roas_percentile)
    const iBand = percentileBand(a.i_roas_percentile)
    const gap   = a.roasGapPct

    if (['Scale', 'Cap too tight'].includes(a.adset_health)) {
      const sc   = [a.adset_health === 'Scale' ? 'health=Scale' : 'cap too tight']
      if (a.reachGrowth > 10) sc.push('reach growing')
      if (gap != null && gap < ROAS_GAP_GENUINE) sc.push('incremental confirmed')
      const conf = calculateConfidence(a.daysActive, sc.length, a.l7.spend)
      const action = a.adset_health === 'Cap too tight'
        ? 'Raise budget cap — algorithm under-delivering relative to performance'
        : 'Increase budget 20-30%'
      adsetScale.push({
        name: a.name, type: 'adset', daysActive: a.daysActive, spend: a.l7.spend,
        current: `A$${Math.round(a.l7.spend / 7)}/day (7d avg)`,
        action,
        why: `p_roas ${a.l7.roas.toFixed(2)}x (${band ?? '—'}) · i_roas ${a.l7.iRoas > 0 ? a.l7.iRoas.toFixed(2) + 'x' : 'n/a'} (${iBand ?? '—'}) · gap ${gap != null ? gap.toFixed(0) + '%' : 'n/a'}`,
        platform: { roas: a.l7.roas, cpa: a.l7.cpa, band },
        incremental: { iRoas: a.l7.iRoas, iBand, gapPct: gap, label: roasGapLabel(gap) },
        confidence: conf, criteriaMet: sc,
        detail: adsetScaleDetail(a),
      })
    }
    if (['Kill', 'Restructure', 'Underperforming'].includes(a.adset_health) && a.l7.spend > MIN_SPEND) {
      const cc   = [`health=${a.adset_health}`]
      if (a.l7.frequency > FREQ_SATURATION) cc.push(`freq ${a.l7.frequency.toFixed(1)}`)
      if (gap != null && gap > ROAS_GAP_AMBER) cc.push(`gap ${gap.toFixed(0)}%`)
      const conf = calculateConfidence(a.daysActive, cc.length, a.l7.spend)
      let action = 'Pause'
      if (a.adset_health === 'Restructure') action = 'Restructure — audience or bid strategy'
      else if (a.l7.frequency > FREQ_SATURATION) action = 'Pause — refresh audience'
      else if (gap != null && gap > 70) action = 'Reduce budget — attribution inflated'
      adsetCut.push({
        name: a.name, type: 'adset', daysActive: a.daysActive, spend: a.l7.spend,
        current: `A$${Math.round(a.l7.spend / 7)}/day (7d avg)`,
        action,
        why: `p_roas ${a.l7.roas.toFixed(2)}x (${band ?? '—'}) · i_roas ${a.l7.iRoas > 0 ? a.l7.iRoas.toFixed(2) + 'x' : 'n/a'} (${iBand ?? '—'}) · gap ${gap != null ? gap.toFixed(0) + '%' : 'n/a'}`,
        platform: { roas: a.l7.roas, cpa: a.l7.cpa, band },
        incremental: { iRoas: a.l7.iRoas, iBand, gapPct: gap, label: roasGapLabel(gap) },
        confidence: conf, criteriaMet: cc,
        detail: adsetCutDetail(a),
      })
    }
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────
  const campScale = [], campCut = []
  for (const c of campaignData) {
    const band  = percentileBand(c.p_roas_percentile)
    const iBand = percentileBand(c.i_roas_percentile)

    if (['Scale', 'Volume opportunity'].includes(c.campaign_health)) {
      const sc   = [`health=${c.campaign_health}`]
      if (c.iPurchaseSharePct > c.spendSharePct + 5) sc.push('incremental winner')
      const conf = calculateConfidence(c.daysActive, sc.length, c.l7.spend)
      campScale.push({
        name: c.name, type: 'campaign', daysActive: c.daysActive, spend: c.l7.spend,
        current: `A$${Math.round(c.l7.spend / 7)}/day (7d avg)`,
        action: 'Increase budget 20-30%',
        why: `p_roas ${c.l7.roas.toFixed(2)}x (${band ?? '—'}) · spend ${c.spendSharePct.toFixed(0)}% · i_purch ${c.iPurchaseSharePct.toFixed(0)}%`,
        platform: { roas: c.l7.roas, band },
        incremental: { iRoas: c.l7.iRoas, iBand, gapPct: c.roasGapPct, label: roasGapLabel(c.roasGapPct) },
        confidence: conf, criteriaMet: sc,
        detail: campScaleDetail(c),
      })
    }
    if (['Defund', 'Restructure', 'Investigate attribution'].includes(c.campaign_health) && c.l7.spend > MIN_SPEND) {
      const cc   = [`health=${c.campaign_health}`]
      if (c.roasGapPct != null && c.roasGapPct > 60) cc.push(`gap ${c.roasGapPct.toFixed(0)}%`)
      const conf = calculateConfidence(c.daysActive, cc.length, c.l7.spend)
      let action = 'Reduce budget 20-30%'
      if (c.campaign_health === 'Restructure')            action = 'Restructure — review ad set mix'
      else if (c.campaign_health === 'Investigate attribution') action = 'Audit — platform numbers don\'t match incremental'
      campCut.push({
        name: c.name, type: 'campaign', daysActive: c.daysActive, spend: c.l7.spend,
        current: `A$${Math.round(c.l7.spend / 7)}/day (7d avg)`,
        action,
        why: `p_roas ${c.l7.roas.toFixed(2)}x (${band ?? '—'}) · spend ${c.spendSharePct.toFixed(0)}% · i_purch ${c.iPurchaseSharePct.toFixed(0)}%`,
        platform: { roas: c.l7.roas, band },
        incremental: { iRoas: c.l7.iRoas, iBand, gapPct: c.roasGapPct, label: roasGapLabel(c.roasGapPct) },
        confidence: conf, criteriaMet: cc,
        detail: campCutDetail(c),
      })
    }
  }

  const top5 = arr => arr.slice(0, 5)
  return {
    ads:       { scale: top5(adScale.sort((a,b) => b.spend-a.spend)),   cut: top5(adCut.sort((a,b) => b.spend-a.spend)) },
    adsets:    { scale: top5(adsetScale.sort((a,b) => b.spend-a.spend)), cut: top5(adsetCut.sort((a,b) => b.spend-a.spend)) },
    campaigns: { scale: top5(campScale.sort((a,b) => b.spend-a.spend)),  cut: top5(campCut.sort((a,b) => b.spend-a.spend)) },
  }
}

// ── Impact score helper ───────────────────────────────────────────────────────
function impact(spendExposure, entityCount, isAccountWide, isHighPriority = false) {
  let s = 50
  if (isHighPriority)    s += 20
  if (spendExposure > 1000) s += 15
  if (entityCount >= 5)  s += 10
  if (isAccountWide)     s += 10
  return Math.min(100, s)
}

// ── Pattern detectors ─────────────────────────────────────────────────────────
function detectFunnelImbalance(adsetData) {
  const bofu = adsetData.filter(a => a.funnel === 'MOFU')
  const tofu = adsetData.filter(a => a.funnel === 'TOFU')
  if (!bofu.length || !tofu.length) return null
  const avgBofuFreq  = bofu.reduce((s, a) => s + a.l7.frequency, 0) / bofu.length
  const avgTofuReach = tofu.reduce((s, a) => s + a.reachGrowth, 0)  / tofu.length
  if (!(avgBofuFreq > 4 && avgTofuReach > 15)) return null
  const spendExposure = bofu.reduce((s, a) => s + a.l7.spend, 0)
  return {
    pattern_name: 'Funnel imbalance', pattern_icon: '⚖️',
    observation: `BOFU ad sets averaging ${avgBofuFreq.toFixed(1)}x frequency — the retargeting pool may be exhausted. Meanwhile TOFU reach is growing ${avgTofuReach.toFixed(0)}% week-over-week, generating demand that isn't converting efficiently downstream.`,
    plays: [
      'Build a new MOFU ad set targeting recent video viewers (3s+) and 30d engaged users to bridge TOFU acquisition and exhausted BOFU',
      'Narrow BOFU exclusion windows from 180d to 60d to refresh the retargeting pool',
      'Test a higher-AOV cross-sell offer in BOFU — existing creative may be hitting buyers who already converted on the main offer',
    ],
    impact_score: impact(spendExposure, bofu.length + tofu.length, true),
    affected_entity_count: bofu.length + tofu.length, spend_exposure: spendExposure,
  }
}

function detectConcentrationRisk(adMetrics) {
  if (!adMetrics.length) return null
  const totalSpend = adMetrics.reduce((s, a) => s + a.spend, 0)
  if (!totalSpend) return null
  const top3Spend = [...adMetrics].sort((a, b) => b.spend - a.spend).slice(0, 3).reduce((s, a) => s + a.spend, 0)
  const top3Pct   = top3Spend / totalSpend * 100
  if (top3Pct < 50) return null
  return {
    pattern_name: 'Creative concentration risk', pattern_icon: '🎯',
    observation: `Top 3 ads account for ${top3Pct.toFixed(0)}% of spend across ${adMetrics.length} active ads. If these fatigue simultaneously, there is no backstop to absorb the spend.`,
    plays: [
      'Brief 3-5 new concepts based on top performer hooks and formats — leverage what is working',
      'Activate any dormant winning concepts at A$50-100/day to build performance signal as backstop',
      'Document why top performers work (hook, claim, format) so the next round inherits the pattern',
    ],
    impact_score: impact(top3Spend, adMetrics.length, true, true),
    affected_entity_count: 3, spend_exposure: top3Spend,
  }
}

function detectVolumeDropEfficiencyHolding(accountL7, accountP7) {
  const purchChg = pctChg(accountL7.purchases, accountP7.purchases)
  const roasChg  = pctChg(accountL7.roas, accountP7.roas)
  if (!(purchChg < -10 && Math.abs(roasChg) <= 5)) return null
  return {
    pattern_name: 'Volume drop, efficiency holding', pattern_icon: '📉',
    observation: `Purchases down ${Math.abs(purchChg).toFixed(0)}% week-over-week while ROAS is flat (${roasChg > 0 ? '+' : ''}${roasChg.toFixed(1)}%). Offer and creative are working but the addressable pool is shrinking.`,
    plays: [
      'Open prospecting — test a broader Advantage+ set with no audience suggestions to expand addressable reach',
      'Audit exclusion windows — long windows progressively shrink the addressable pool over time',
      'Refresh lookalike seeds (e.g. last 30d purchasers) to inject new audience signal',
    ],
    impact_score: impact(accountL7.spend, 0, true),
    affected_entity_count: 0, spend_exposure: accountL7.spend,
  }
}

function detectEfficiencyDropVolumeHolding(accountL7, accountP7) {
  const roasChg  = pctChg(accountL7.roas, accountP7.roas)
  const purchChg = pctChg(accountL7.purchases, accountP7.purchases)
  if (!(roasChg < -10 && Math.abs(purchChg) <= 5)) return null
  const cpmChg = pctChg(accountL7.cpm, accountP7.cpm)
  return {
    pattern_name: 'Efficiency drop, volume holding', pattern_icon: '⚡',
    observation: `ROAS down ${Math.abs(roasChg).toFixed(0)}% week-over-week while purchase volume is flat. More spend per purchase points to audience quality decline or rising auction costs${cpmChg > 10 ? ` — CPM is up ${cpmChg.toFixed(0)}%` : ''}.`,
    plays: [
      `${cpmChg > 15 ? 'CPM up ' + cpmChg.toFixed(0) + '% — this is an auction cost issue, not just creative' : 'Check CPM trend — rising CPM explains a ROAS drop without creative changes'}`,
      'Check creative fatigue scores — rising fatigue lowers relevance and pushes CPM up independently',
      'Tighten cost caps by 10-15% to force the algorithm toward more efficient delivery',
    ],
    impact_score: impact(accountL7.spend, 0, true, true),
    affected_entity_count: 0, spend_exposure: accountL7.spend,
  }
}

function detectFunnelRateDrop(adsetData) {
  const drops = adsetData.filter(a => {
    const atcChg      = pctChg(a.l7.atcRate,      a.p7.atcRate)
    const checkoutChg = pctChg(a.l7.checkoutRate,  a.p7.checkoutRate)
    return (atcChg < -20 || checkoutChg < -20) && a.p7.atcRate > 0
  })
  if (drops.length < 3) return null
  const spendExposure = drops.reduce((s, a) => s + a.l7.spend, 0)
  return {
    pattern_name: 'Account-wide funnel rate drop', pattern_icon: '🚨',
    observation: `${drops.length} ad sets showing >20% week-over-week drop in ATC-to-purchase or checkout-to-purchase rates. Ads are earning add-to-carts but conversions are breaking off-platform — this is not a creative problem.`,
    plays: [
      'Check site analytics for checkout drop-off, payment errors, or stock issues',
      'Verify the pixel is firing correctly, especially the Purchase event',
      'Check for recent price changes, shipping policy changes, or offer expiry',
      'Pause aggressive scaling until the rate recovers — more spend on a leaky funnel wastes budget',
    ],
    impact_score: impact(spendExposure, drops.length, true, true),
    affected_entity_count: drops.length, spend_exposure: spendExposure,
  }
}

function detectFreqSaturationCluster(adsetData) {
  const saturated = adsetData.filter(a => a.l7.frequency > 4.5)
  if (saturated.length < 3) return null
  const campCounts = {}
  for (const a of saturated) campCounts[a.campaign] = (campCounts[a.campaign] || 0) + 1
  const clustered = Object.values(campCounts).some(c => c >= 3)
  const spendExposure = saturated.reduce((s, a) => s + a.l7.spend, 0)
  return {
    pattern_name: 'Frequency saturation cluster', pattern_icon: '🔁',
    observation: `${saturated.length} ad sets averaging 4.5x+ frequency${clustered ? ', concentrated within the same campaign' : ''}. Showing the same ads more often is degrading performance, not improving it.`,
    plays: [
      'Build new audience seeds in this segment (different lookalike sources, broader geo, different interest stack)',
      'Reduce budget on saturated ad sets and reallocate to fresher audiences',
      'Refresh creative on saturated ad sets — new creative can re-engage a frequency-tired audience',
    ],
    impact_score: impact(spendExposure, saturated.length, clustered),
    affected_entity_count: saturated.length, spend_exposure: spendExposure,
  }
}

function detectSpendVelocityDivergence(adMetrics, accountL7, accountP7) {
  const slowAds = adMetrics.filter(a => a.spendVelocity < 0.5 && a.spend > MIN_SPEND)
  if (slowAds.length < 3) return null
  const accountPacing = accountP7.spend > 0 ? accountL7.spend / accountP7.spend : 1
  if (accountPacing < 0.85) return null
  const spendExposure = slowAds.reduce((s, a) => s + a.spend, 0)
  return {
    pattern_name: 'Spend velocity divergence', pattern_icon: '📊',
    observation: `${slowAds.length} ads with spend velocity below 0.5 while account-level spend is on pace at ${accountPacing.toFixed(2)}x. Meta is pulling back on these ads before manual fatigue flags trigger.`,
    plays: [
      'Investigate the pulled-back ads — they are losing algorithm confidence even before manual flags trigger',
      'Check if these ads share a common element (concept, format, audience) that may need refresh',
      'Do not rescue ads the algorithm is killing — this is usually a leading indicator of upcoming fatigue',
    ],
    impact_score: impact(spendExposure, slowAds.length, false),
    affected_entity_count: slowAds.length, spend_exposure: spendExposure,
  }
}

// ── NEW: Incrementality patterns ──────────────────────────────────────────────
function detectAttributionInflationCluster(adsetData, campaignData, accountL7) {
  const inflated = [...adsetData, ...campaignData].filter(e =>
    (e.roasGapPct ?? 0) > 70 && (e.l7?.spend ?? e.all?.spend ?? 0) > 100
  )
  if (inflated.length < 3) return null
  const totalSpend = accountL7.spend || 1
  const combinedSpend = inflated.reduce((s, e) => s + (e.l7?.spend ?? 0), 0)
  if (combinedSpend / totalSpend < 0.25) return null
  return {
    pattern_name: 'Attribution inflation cluster', pattern_icon: '🪞',
    observation: `${inflated.length} ad sets or campaigns with roas_gap above 70% — combined ${(combinedSpend / totalSpend * 100).toFixed(0)}% of account spend. Meta is over-claiming credit on a significant share of budget; these entities are catching demand that would have converted anyway.`,
    plays: [
      'Audit the inflated entities — usually retargeting or BOFU pools catching warm demand',
      'Reduce budget on highest-gap entities and reallocate to incremental performers (lower roas_gap)',
      'Don\'t trust scaling decisions on platform metrics alone for these segments — use i_roas as the signal',
    ],
    impact_score: impact(combinedSpend, inflated.length, true, true),
    affected_entity_count: inflated.length, spend_exposure: combinedSpend,
  }
}

function detectHiddenIncrementalWinner(adsetData, campaignData) {
  const entities = [...adsetData, ...campaignData]
  const winners = entities.filter(e =>
    (e.i_roas_percentile ?? 0) >= TOP_QUARTILE &&
    (e.iPurchaseSharePct ?? 0) > (e.spendSharePct ?? 0) + 10
  )
  if (winners.length === 0) return null
  const spendExposure = winners.reduce((s, e) => s + (e.l7?.spend ?? 0), 0)
  return {
    pattern_name: 'Hidden incremental winner', pattern_icon: '💎',
    observation: `${winners.length} entity${winners.length > 1 ? 'ies' : 'y'} in the top 25% for incremental ROAS but receiving less budget than their incremental purchase share warrants. These are genuine lift generators being under-funded relative to their real contribution.`,
    plays: [
      'Increase budget on hidden incremental winners — their platform numbers may not look top-tier but their actual lift is',
      'These are usually broad TOFU prospecting or new-customer-focused campaigns — prime scale candidates',
      'Use i_roas_percentile as the primary signal for budget allocation, not p_roas alone',
    ],
    impact_score: impact(spendExposure, winners.length, false, true),
    affected_entity_count: winners.length, spend_exposure: spendExposure,
  }
}

function detectPlatformOnlyScalingTrap(adsetData, campaignData, accountL7, accountP7) {
  // Entities that scaled recently (spend up >25% w/w) but i_roas is falling
  const recentlyScaled = [...adsetData, ...campaignData].filter(e => {
    const l7Spend = e.l7?.spend ?? 0
    const p7Spend = e.p7?.spend ?? 0
    return p7Spend > 0 && (l7Spend - p7Spend) / p7Spend > 0.25 &&
           (e.roasGapPct ?? 0) > ROAS_GAP_AMBER
  })
  if (recentlyScaled.length < 2) return null
  const spendExposure = recentlyScaled.reduce((s, e) => s + (e.l7?.spend ?? 0), 0)
  return {
    pattern_name: 'Platform-only scaling trap', pattern_icon: '⚠️',
    observation: `${recentlyScaled.length} entities recently scaled (spend up >25%) but with roas_gap above ${ROAS_GAP_AMBER}%. Recent budget increases are generating more Meta-attributed revenue, but incremental performance is not keeping pace.`,
    plays: [
      'Pause scaling and audit incrementality before further increases',
      'Meta is likely finding more attribution opportunities at higher spend, not new customers',
      'Test a holdout or geo-experiment to verify true lift before continuing scale',
    ],
    impact_score: impact(spendExposure, recentlyScaled.length, false, true),
    affected_entity_count: recentlyScaled.length, spend_exposure: spendExposure,
  }
}

export function runPatternDetectors(adMetrics, adsetData, campaignData, accountL7, accountP7) {
  const results = [
    detectFunnelImbalance(adsetData),
    detectConcentrationRisk(adMetrics),
    detectVolumeDropEfficiencyHolding(accountL7, accountP7),
    detectEfficiencyDropVolumeHolding(accountL7, accountP7),
    detectFunnelRateDrop(adsetData),
    detectFreqSaturationCluster(adsetData),
    detectSpendVelocityDivergence(adMetrics, accountL7, accountP7),
    detectAttributionInflationCluster(adsetData, campaignData, accountL7),
    detectHiddenIncrementalWinner(adsetData, campaignData),
    detectPlatformOnlyScalingTrap(adsetData, campaignData, accountL7, accountP7),
  ].filter(Boolean).sort((a, b) => b.impact_score - a.impact_score)
  return results.slice(0, 5)
}

// ── Account state ─────────────────────────────────────────────────────────────
export function getAccountState(score) {
  if (score >= 70) return 'HEALTHY'
  if (score >= 50) return 'MONITOR'
  if (score >= 30) return 'ISSUES TO ADDRESS'
  return 'DEEP WORK DAY'
}

export const STATE_COLORS = {
  'HEALTHY':           { color: '#15803D', bg: '#DCFCE7', border: '#BBF7D0' },
  'MONITOR':           { color: '#92400E', bg: '#FEF3C7', border: '#FDE68A' },
  'ISSUES TO ADDRESS': { color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  'DEEP WORK DAY':     { color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
}

// ── Narrative ─────────────────────────────────────────────────────────────────
export function generateHeadline(accountL7, accountP7, patterns) {
  const roasChg  = pctChg(accountL7.roas,      accountP7.roas)
  const purchChg = pctChg(accountL7.purchases,  accountP7.purchases)
  const cpmChg   = pctChg(accountL7.cpm,        accountP7.cpm)
  const parts    = []

  if (Math.abs(roasChg) <= 5)  parts.push('ROAS holding')
  else parts.push(roasChg > 0  ? 'ROAS improving' : 'ROAS dropping')

  if      (purchChg > 10)  parts.push('volume growing')
  else if (purchChg < -10) parts.push('volume softening')

  if (cpmChg > 20) parts.push('CPM rising')

  const top = patterns[0]
  if (top && parts.length < 3) parts.push(top.pattern_name.toLowerCase())

  return parts.slice(0, 3).join(', ')
}

export function generateNarrative(accountL7, accountP7, healthScore, patterns, campaignData) {
  const AU$ = v => `A$${v.toFixed(2)}`
  const roasChg  = pctChg(accountL7.roas,       accountP7.roas)
  const purchChg = pctChg(accountL7.purchases,   accountP7.purchases)
  const cpmChg   = pctChg(accountL7.cpm,         accountP7.cpm)
  const ctrChg   = pctChg(accountL7.ctr,         accountP7.ctr)
  const freqChg  = pctChg(accountL7.frequency,   accountP7.frequency)
  const spendChg = pctChg(accountL7.spend,        accountP7.spend)
  const shortName = n => (n.split(' | ').slice(2).join(' · ') || n).slice(0, 40)

  // ── S1: ROAS headline with explanation ───────────────────────────────────
  let roasVerb, roasWhy
  if (Math.abs(roasChg) <= 3) {
    roasVerb = 'holding steady'
    roasWhy  = `CPM ${cpmChg > 5 ? `up ${cpmChg.toFixed(0)}% — auctions getting more expensive` : cpmChg < -5 ? `down ${Math.abs(cpmChg).toFixed(0)}% — favourable auction conditions` : 'flat'}, CTR ${Math.abs(ctrChg) <= 3 ? 'holding' : ctrChg > 0 ? `up ${ctrChg.toFixed(0)}%` : `down ${Math.abs(ctrChg).toFixed(0)}%`}`
  } else if (roasChg > 0) {
    roasVerb = `up ${roasChg.toFixed(0)}% week-on-week`
    if (cpmChg < -5 && ctrChg >= -3) roasWhy = `CPM dropped ${Math.abs(cpmChg).toFixed(0)}% — cheaper impressions are the main driver, creative engagement is holding`
    else if (ctrChg > 5) roasWhy = `CTR improved ${ctrChg.toFixed(0)}% — better creative engagement driving more efficient traffic`
    else if (spendChg > 10) roasWhy = `spend up ${spendChg.toFixed(0)}% with ROAS improving — algorithm finding efficient inventory`
    else roasWhy = `CPM ${cpmChg > 0 ? `up ${cpmChg.toFixed(0)}%` : `down ${Math.abs(cpmChg).toFixed(0)}%`}, CTR ${ctrChg > 0 ? `up ${ctrChg.toFixed(0)}%` : `down ${Math.abs(ctrChg).toFixed(0)}%`} — net improvement`
  } else {
    roasVerb = `down ${Math.abs(roasChg).toFixed(0)}% week-on-week`
    if (cpmChg > 10 && ctrChg >= -3) roasWhy = `CPM rose ${cpmChg.toFixed(0)}% — auction costs are up, which is the primary drag; creative engagement is not the issue`
    else if (ctrChg < -10 && cpmChg <= 5) roasWhy = `CTR dropped ${Math.abs(ctrChg).toFixed(0)}% — creative is losing engagement, not a CPM or auction problem`
    else if (freqChg > 20 && ctrChg < -5) roasWhy = `frequency up ${freqChg.toFixed(0)}% alongside falling CTR — classic fatigue signal; same audience seeing ads too often`
    else if (cpmChg > 5 && ctrChg < -5) roasWhy = `CPM up ${cpmChg.toFixed(0)}% and CTR down ${Math.abs(ctrChg).toFixed(0)}% simultaneously — both auction pressure and creative fatigue contributing`
    else roasWhy = `CPM ${cpmChg > 0 ? `up ${cpmChg.toFixed(0)}%` : `flat`}, CTR ${ctrChg < 0 ? `down ${Math.abs(ctrChg).toFixed(0)}%` : 'flat'}, frequency at ${accountL7.frequency.toFixed(2)}`
  }
  const s1 = `ROAS is ${roasVerb} at ${accountL7.roas.toFixed(2)}x (${AU$(accountL7.spend)} spend, ${Math.round(accountL7.purchases)} purchases). ${roasWhy.charAt(0).toUpperCase() + roasWhy.slice(1)}.`

  // ── S2: Purchase volume context ───────────────────────────────────────────
  let s2 = ''
  if (Math.abs(purchChg) > 5) {
    const dir = purchChg > 0 ? `up ${purchChg.toFixed(0)}%` : `down ${Math.abs(purchChg).toFixed(0)}%`
    if (purchChg < -5 && cpmChg > 10) s2 = `Purchases ${dir} week-on-week — the drop is consistent with rising CPM squeezing reach and volume, not a conversion rate problem.`
    else if (purchChg < -5 && ctrChg < -10) s2 = `Purchases ${dir} — weaker CTR means fewer people are clicking through to purchase; check whether the creative is still resonant or if a refresh is due.`
    else if (purchChg > 10 && spendChg < 5) s2 = `Purchases ${dir} without a meaningful spend increase — the account is converting more efficiently this week.`
    else if (purchChg > 10 && spendChg > 10) s2 = `Purchases ${dir} with spend also ${spendChg > 0 ? 'up' : 'down'} ${Math.abs(spendChg).toFixed(0)}% — volume growth is budget-driven rather than efficiency-driven.`
    else s2 = `Purchases ${dir} week-on-week.`
  }

  // ── S3: Campaign breakdown ────────────────────────────────────────────────
  let s3 = ''
  if (campaignData.length > 0) {
    const active = campaignData.filter(c => c.l7.spend > 50)
    if (active.length >= 2) {
      const bySpend = [...active].sort((a, b) => b.l7.spend - a.l7.spend)
      const biggest = bySpend[0]
      const spendShare = biggest.spendSharePct ?? (biggest.l7.spend / accountL7.spend * 100)
      const byRoas   = [...active].sort((a, b) => b.l7.roas - a.l7.roas)
      const best     = byRoas[0]
      const worst    = byRoas[byRoas.length - 1]
      const roasRange = best.l7.roas > 0 && worst.l7.roas > 0 && best !== worst

      let campaignSentence = `${shortName(biggest.name)} is absorbing ${spendShare.toFixed(0)}% of spend at ${biggest.l7.roas.toFixed(2)}x ROAS`
      if (roasRange && best.name !== biggest.name) {
        campaignSentence += `; strongest performer is ${shortName(best.name)} at ${best.l7.roas.toFixed(2)}x`
      }
      if (roasRange && worst.l7.roas < accountL7.roas * 0.7) {
        campaignSentence += `; ${shortName(worst.name)} is dragging at ${worst.l7.roas.toFixed(2)}x`
      }
      s3 = campaignSentence + '.'
    }
  }

  // ── S4: Pattern or frequency note ────────────────────────────────────────
  let s4 = ''
  const top = patterns[0]
  if (top) {
    s4 = `Key signal: ${top.pattern_name} — ${top.observation.split('.')[0].toLowerCase()}.`
  } else if (accountL7.frequency > 3.5) {
    s4 = `Average frequency is ${accountL7.frequency.toFixed(2)} — above 3.5 is a fatigue risk; monitor CTR trend at the ad level.`
  }

  // ── S5: Incremental ───────────────────────────────────────────────────────
  let s5 = ''
  const gap = accountL7.roasGapPct
  if (gap != null && gap > 0) {
    const iRoas = accountL7.iRoas
    if (gap >= ROAS_GAP_AMBER) {
      s5 = `Attribution gap is ${gap.toFixed(0)}% — platform reports ${accountL7.roas.toFixed(2)}x but incremental ROAS is ${iRoas > 0 ? iRoas.toFixed(2) + 'x' : 'unavailable'}. Meta is likely taking credit for organic conversions; check view-through windows and retargeting overlap.`
    } else if (gap >= ROAS_GAP_GENUINE) {
      s5 = `Attribution gap at ${gap.toFixed(0)}% — some over-reporting present but within a manageable range.`
    }
  }

  return [s1, s2, s3, s4, s5].filter(Boolean)
}
