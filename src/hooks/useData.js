import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { generateSampleData } from '../utils/sampleData'
import { parseAdName } from '../utils/adName'

function normaliseFunnel(sheetValue, campaignName) {
  const v = (sheetValue ?? '').toUpperCase().trim()
  if (v === 'TOFU') return 'TOFU'
  if (v === 'MOFU' || v === 'BOFU') return 'MOFU'
  // fall back to inferring from campaign name
  const u = (campaignName ?? '').toUpperCase()
  if (u.includes('TOFU')) return 'TOFU'
  if (u.includes('BOFU') || u.includes('MOFU')) return 'MOFU'
  return 'TOFU'
}

// Sheet has 3 header rows: row1 = group labels, row2 = real column names, row3 = descriptions
// Strip rows 1 and 3 so Papaparse sees row2 as headers and row4+ as data
function stripExtraHeaderRows(chunk) {
  const lines = chunk.split('\n')
  if (lines.length < 3) return chunk
  lines.splice(0, 1) // remove group label row
  lines.splice(1, 1) // remove description row
  return lines.join('\n')
}

function normaliseRow(r) {
  const ad = parseAdName(r.ad_name)
  return {
    date:          (r.date ?? '').trim(),
    funnel_stage:  normaliseFunnel(r.funnel_stage, r.campaign_name),
    campaign_name: (r.campaign_name ?? '').trim(),
    adsetName:     (r.adset_name ?? '').trim(),
    ad_name:       (r.ad_name ?? '').trim(),
    spend:         parseFloat(r.spend)                 || 0,
    revenue:       parseFloat(r.p_revenue)             || 0,
    purchases:     parseInt(r.p_purchases, 10)         || 0,
    impressions:   parseInt(r.impressions, 10)         || 0,
    clicks:        parseInt(r.clicks, 10)              || 0,
    frequency:     parseFloat(r.frequency)             || 1,
    atc:           parseInt(r.p_atc, 10)               || 0,
    checkouts:     parseInt(r.p_initiate_checkout, 10) || 0,
    // Incrementality
    iRevenue:      parseFloat(r.i_revenue)             || 0,
    iPurchases:    parseInt(r.i_purchases, 10)         || 0,
    iAtc:          parseInt(r.i_atc, 10)               || 0,
    iCheckouts:    parseInt(r.i_initiate_checkout, 10) || 0,
    iRoas:         parseFloat(r.i_roas)                || 0,
    iCpa:          parseFloat(r.i_cpa)                 || 0,
    roasGapPct:    parseFloat(r['roas_gap_%'])         || 0,
    purchaseGapPct:parseFloat(r['purchase_gap_%'])     || 0,
    revenueGapPct: parseFloat(r['revenue_gap_%'])      || 0,
    // Creative engagement
    thumbStopRatio:         parseFloat(r.thumb_stop_ratio)          || 0,
    hookRate:               parseFloat(r.hook_rate)                  || 0,
    atcToPurchaseRate:      parseFloat(r.atc_to_purchase_rate)       || 0,
    checkoutToPurchaseRate: parseFloat(r.checkout_to_purchase_rate)  || 0,
    // Video funnel counts
    views3sec:   parseInt(r['3_sec_views'] ?? r['video_3_sec_watched_actions'] ?? 0, 10) || 0,
    views25pct:  parseInt(r['views_to_25%'] ?? r['video_p25_watched_actions'] ?? 0, 10)  || 0,
    reach:       parseInt(r.reach, 10) || 0,
    adId:        (r.ad_id ?? '').trim(),
    // Ad preview — try all common column name variants
    previewLink:   (r.preview_link ?? r['preview link'] ?? r['Preview Link'] ?? r['Preview_Link'] ?? r['preview_url'] ?? r['Preview URL'] ?? '').trim() || null,
    // Flags
    fatigueFlag:    (r.fatigue_flag    ?? 'OK').trim().toUpperCase(),
    efficiencyFlag: (r.efficiency_flag ?? 'OK').trim().toUpperCase(),
    // Creative taxonomy
    contentPillar:  (r.content_pillar ?? '').trim() || null,
    creativeFormat: (r.creative_type  ?? '').trim() || null,
    // Parsed ad name fields
    pillar:        ad.pillar,
    campType:      ad.campType,
    range:         ad.range,
    collection:    ad.collection,
    print:         ad.print,
    creativeType:  ad.creativeType,
    description:   ad.description,
    format:        ad.format,
    productionDate:ad.productionDate,
  }
}

function isValid(r) {
  // Keep rows with any activity — spend=0 rows can still have view-through attributed purchases
  return /^\d{4}-\d{2}-\d{2}$/.test(r.date) && (r.spend > 0 || r.purchases > 0 || r.revenue > 0)
}

export function useData() {
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)

  useEffect(() => {
    const url = import.meta.env.VITE_SHEETS_URL

    if (!url) {
      setRows(generateSampleData())
      setUsingDemo(true)
      setLoading(false)
      return
    }

    Papa.parse(url, {
      download:         true,
      header:           true,
      skipEmptyLines:   true,
      beforeFirstChunk: stripExtraHeaderRows,
      complete: ({ data }) => {
        try {
          console.log('[useData] raw rows:', data.length, '| cols:', Object.keys(data[0] || {}).join(', '))
          const parsed = data.map(normaliseRow).filter(isValid)
          console.log('[useData] valid rows after filter:', parsed.length, '| campaigns:', [...new Set(parsed.map(r => r.campaign_name))].length)
          if (parsed.length === 0) throw new Error('No valid rows')
          setRows(parsed)
        } catch (e) {
          console.warn('Sheet parse failed, using demo data:', e.message)
          setRows(generateSampleData())
          setUsingDemo(true)
        }
        setLoading(false)
      },
      error: (err) => {
        console.warn('Sheet fetch error:', err)
        setRows(generateSampleData())
        setUsingDemo(true)
        setLoading(false)
      },
    })
  }, [])

  return { rows, loading, usingDemo }
}
