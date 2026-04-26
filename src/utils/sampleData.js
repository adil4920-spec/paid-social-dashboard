// Sample data — Meta AU — ad-level catalog with all computed fields
import { parseAdName } from './adName'

// fmt: PLR:[Pillar] | CAMP:[CampType] | RNG:[Range] | COL:[Collection] | PRNT:[Print] | TYP:[CreativeType] | [Description] | [Format] | [Date] | AUS
const AD_CATALOG = [
  // ── TOFU | Prospecting Broad ────────────────────────────────────────────
  {
    campaignName: 'ER | AUS | TOFU | Prospecting | Conversion | Purchase | CBO',
    adsetName: 'Prospecting – Broad', funnel: 'TOFU', contentPillar: 'UGC',
    adName: 'PLR:Community/UGC | CAMP:New Release | RNG:Swimwear | COL:Playa Blanca | TYP:LoFi | Playa Blanca Girls Jumping | Video | 20260129 | AUS',
    baseSpend: 48, baseRoas: 3.9, thumbStop: 0.34, hookRate: 0.26, iMult: 0.72,
    previewLink: 'https://www.facebook.com/ads/archive/render_ad/?id=demo_001',
  },
  {
    campaignName: 'ER | AUS | TOFU | Prospecting | Conversion | Purchase | CBO',
    adsetName: 'Prospecting – Broad', funnel: 'TOFU', contentPillar: 'UGC',
    adName: 'PLR:Community/UGC | CAMP:New Release | RNG:Swimwear | COL:Zuri Bahari | TYP:LoFi | Side By Side Trend | Video | 26032026 | AUS',
    baseSpend: 36, baseRoas: 3.1, thumbStop: 0.22, hookRate: 0.17, iMult: 0.65,
    previewLink: 'https://www.facebook.com/ads/archive/render_ad/?id=demo_002',
  },
  {
    campaignName: 'ER | AUS | TOFU | Prospecting | Conversion | Purchase | CBO',
    adsetName: 'Prospecting – Broad', funnel: 'TOFU', contentPillar: 'offer',
    adName: 'PLR:Brand Awareness | CAMP:TOF | RNG:Swimwear | COL:Cross Collection | TYP:Polished | Get $20 Off | Image | 13032026 | AUS',
    baseSpend: 28, baseRoas: 2.9, thumbStop: 0.14, hookRate: 0.10, iMult: 0.68,
    previewLink: 'https://www.facebook.com/ads/archive/render_ad/?id=demo_003',
  },
  {
    campaignName: 'ER | AUS | TOFU | Prospecting | Conversion | Purchase | CBO',
    adsetName: 'Prospecting – Broad', funnel: 'TOFU', contentPillar: 'UGC',
    adName: 'PLR:Campaign Content | CAMP:Hype | RNG:Swimwear | COL:Club Bonita | TYP:LoFi | Club Bonita Launch Reel | PAC Video | 01042026 | AUS',
    baseSpend: 42, baseRoas: 3.5, thumbStop: 0.30, hookRate: 0.23, iMult: 0.70,
  },
  // ── TOFU | LAL 2% ───────────────────────────────────────────────────────
  {
    campaignName: 'ER | AUS | TOFU | Prospecting | Conversion | Purchase | CBO',
    adsetName: 'LAL – 2% Buyers', funnel: 'TOFU', contentPillar: 'product',
    adName: 'PLR:Flat Lay | CAMP:New Release | RNG:Swimwear | COL:Zuri Bahari | PRNT:Zahána | TYP:Polished | Zahana Flatlay Prague | Image | 26032026 | AUS',
    baseSpend: 32, baseRoas: 3.3, thumbStop: 0.17, hookRate: 0.12, iMult: 0.62,
  },
  {
    campaignName: 'ER | AUS | TOFU | Prospecting | Conversion | Purchase | CBO',
    adsetName: 'LAL – 2% Buyers', funnel: 'TOFU', contentPillar: 'UGC',
    adName: 'PLR:Campaign Content | CAMP:Top Performers | RNG:Swimwear | COL:Cross Collection | TYP:LoFi | Collection Carousel UGC | Carousel - Image | 20260215 | AUS',
    baseSpend: 25, baseRoas: 3.6, thumbStop: 0.24, hookRate: 0.19, iMult: 0.71,
  },
  {
    campaignName: 'ER | AUS | TOFU | Prospecting | Conversion | Purchase | CBO',
    adsetName: 'LAL – 2% Buyers', funnel: 'TOFU', contentPillar: 'product',
    adName: "PLR:Detail Focused | CAMP:New Release | RNG:Swimwear | COL:Maison d'Amour | TYP:Polished | Maison Detail Shot | Image | 10042026 | AUS",
    baseSpend: 30, baseRoas: 3.2, thumbStop: 0.16, hookRate: 0.11, iMult: 0.63,
  },
  // ── MOFU | ATC Abandoners ───────────────────────────────────────────────
  {
    campaignName: 'ER | AUS | BOFU | Remarketing | Conversion | Purchase | ABO',
    adsetName: 'ATC Abandoners', funnel: 'MOFU', contentPillar: 'lifestyle',
    adName: 'PLR:Campaign Content | CAMP:Sale | RNG:Swimwear | COL:Cross Collection | PRNT:Limón | TYP:Polished | Archive Sale Limon | Image | 20260216 | AUS',
    baseSpend: 52, baseRoas: 6.4, thumbStop: 0.19, hookRate: 0.14, iMult: 0.76,
  },
  {
    campaignName: 'ER | AUS | BOFU | Remarketing | Conversion | Purchase | ABO',
    adsetName: 'ATC Abandoners', funnel: 'MOFU', contentPillar: 'UGC',
    adName: 'PLR:Brand Awareness | CAMP:New Release | RNG:Swimwear | COL:Zuri Bahari | PRNT:Mixed | TYP:Polished | Zuri Bahari Dessy Try On | Video | 24032026 | AUS',
    baseSpend: 40, baseRoas: 5.8, thumbStop: 0.29, hookRate: 0.22, iMult: 0.78,
  },
  {
    campaignName: 'ER | AUS | BOFU | Remarketing | Conversion | Purchase | ABO',
    adsetName: 'ATC Abandoners', funnel: 'MOFU', contentPillar: 'testimonial',
    adName: 'PLR:Community/UGC | CAMP:New Release | RNG:Swimwear | COL:Viva La Vida | TYP:LoFi | Viva La Vida UGC Try On | Video | 26032026 | AUS',
    baseSpend: 22, baseRoas: 4.8, thumbStop: 0.31, hookRate: 0.24, iMult: 0.74,
  },
  // ── MOFU | Warm Audience ────────────────────────────────────────────────
  {
    campaignName: 'ER | AUS | BOFU | Remarketing | Conversion | Purchase | ABO',
    adsetName: 'Warm Audience', funnel: 'MOFU', contentPillar: 'lifestyle',
    adName: 'PLR:Flat Lay | CAMP:BAU | RNG:Resort | COL:Sel De Mer | PRNT:Solara | TYP:Polished | Barcelona Malaga | PAC Video | 20251229 | AUS',
    baseSpend: 20, baseRoas: 4.5, thumbStop: 0.25, hookRate: 0.18, iMult: 0.64,
  },
  {
    campaignName: 'ER | AUS | BOFU | Remarketing | Conversion | Purchase | ABO',
    adsetName: 'Warm Audience', funnel: 'MOFU', contentPillar: 'product',
    adName: 'PLR:Flat Lay | CAMP:New Release | RNG:Swimwear | COL:Zuri Bahari | PRNT:Sarabi | TYP:Polished | Sarabi Flatlay Link Ad | Image | 26032026 | AUS',
    baseSpend: 15, baseRoas: 3.8, thumbStop: 0.13, hookRate: 0.09, iMult: 0.58,
  },
  // ── MOFU | High AOV ─────────────────────────────────────────────────────
  {
    campaignName: 'ER | AUS | BOFU | Remarketing | Conversion | Purchase | ABO',
    adsetName: 'High AOV Audience', funnel: 'MOFU', contentPillar: 'UGC',
    adName: 'PLR:Detail Focused | CAMP:Top Performers | RNG:Swimwear | COL:Cross Collection | PRNT:Mixed | TYP:LoFi | Most Loved Zocalo | Collection - Image | 6042026 | AUS',
    baseSpend: 18, baseRoas: 5.1, thumbStop: 0.27, hookRate: 0.20, iMult: 0.70,
  },
  {
    campaignName: 'ER | AUS | BOFU | Remarketing | Conversion | Purchase | ABO',
    adsetName: 'High AOV Audience', funnel: 'MOFU', contentPillar: 'product',
    adName: 'PLR:Campaign Content | CAMP:BAU | RNG:Swimwear | COL:Playa Blanca | TYP:Polished | Playa Blanca Static Hero | Image | 20260129 | AUS',
    baseSpend: 12, baseRoas: 3.2, thumbStop: 0.11, hookRate: 0.08, iMult: 0.55,
  },
  // ── TOFU | Resort & Jewellery ───────────────────────────────────────────
  {
    campaignName: 'ER | AUS | TOFU | Prospecting | Conversion | Purchase | CBO',
    adsetName: 'Prospecting – Broad', funnel: 'TOFU', contentPillar: 'product',
    adName: 'PLR:Flat Lay | CAMP:New Release | RNG:Resort | COL:Casa Del Sol | TYP:Polished | Casa Del Sol Campaign | Image | 15042026 | AUS',
    baseSpend: 26, baseRoas: 3.0, thumbStop: 0.15, hookRate: 0.11, iMult: 0.61,
  },
  {
    campaignName: 'ER | AUS | TOFU | Prospecting | Conversion | Purchase | CBO',
    adsetName: 'Prospecting – Broad', funnel: 'TOFU', contentPillar: 'UGC',
    adName: 'PLR:Campaign Content | CAMP:BAU - Partnership | RNG:Jewellery | COL:Océana | TYP:LoFi | Oceana Jewellery UGC | Video | 20042026 | AUS',
    baseSpend: 22, baseRoas: 2.8, thumbStop: 0.28, hookRate: 0.21, iMult: 0.67,
  },
]

function rnd(min, max) { return min + Math.random() * (max - min) }

export function generateSampleData() {
  const rows = []
  const today = new Date()

  for (let d = 89; d >= 0; d--) {
    const date = new Date(today)
    date.setDate(date.getDate() - d)
    const dateStr   = date.toISOString().split('T')[0]
    const dow       = date.getDay()
    const dowMult   = dow === 0 || dow === 6 ? 0.70 : 1.0
    const trend     = 1 + (89 - d) * 0.003

    for (const ad of AD_CATALOG) {
      const n        = rnd(0.82, 1.18)
      const spend    = +(ad.baseSpend * dowMult * trend * n).toFixed(2)
      const pRoas    = ad.baseRoas * rnd(0.88, 1.12)
      const revenue  = +(spend * pRoas).toFixed(2)

      const purchBase   = ad.funnel === 'TOFU' ? 4 : 8
      const purchases   = Math.max(0, Math.round(purchBase * dowMult * trend * rnd(0.7, 1.3)))
      const atc         = Math.max(purchases, Math.round(purchases * rnd(2.5, 5)))
      const checkouts   = Math.max(purchases, Math.round(purchases * rnd(1.2, 2.2)))

      // Incremental — 55–80% of platform
      const iMult       = ad.iMult * rnd(0.92, 1.08)
      const iRevenue    = +(spend * pRoas * iMult).toFixed(2)
      const iPurchases  = Math.max(0, Math.round(purchases * iMult))
      const iAtc        = Math.max(iPurchases, Math.round(atc * iMult))
      const iCheckouts  = Math.max(iPurchases, Math.round(checkouts * iMult))
      const iRoas       = spend > 0 ? iRevenue / spend : 0
      const iCpa        = iPurchases > 0 ? spend / iPurchases : 0

      // Engagement metrics
      const impressions = Math.round(rnd(800, 3500) * dowMult * trend)
      const clicks      = Math.round(impressions * rnd(0.005, 0.025))
      const ctr         = impressions > 0 ? clicks / impressions : 0
      const frequency   = ad.funnel === 'MOFU'
        ? rnd(2.8, 5.5) * (1 + (89 - d) * 0.008)
        : rnd(1.2, 2.8)
      const thumbStop   = ad.thumbStop * rnd(0.85, 1.15)
      const hookRate    = ad.hookRate  * rnd(0.85, 1.15)
      const views3sec  = Math.round(impressions * thumbStop)
      const views25pct = Math.round(impressions * hookRate)
      const reach      = Math.round(impressions * rnd(0.70, 0.88))

      // Rates
      const atcToPurchaseRate      = atc       > 0 ? purchases / atc       : 0
      const checkoutToPurchaseRate = checkouts > 0 ? purchases / checkouts : 0

      // Gap %
      const roasGapPct     = pRoas  > 0 ? ((pRoas - iRoas) / pRoas) * 100 : 0
      const purchaseGapPct = purchases > 0 ? ((purchases - iPurchases) / purchases) * 100 : 0
      const revenueGapPct  = revenue   > 0 ? ((revenue - iRevenue) / revenue) * 100 : 0

      // Flags
      const fatigueFlag    = (frequency > 3.5 && ctr < 0.008) ? 'FATIGUED' : 'OK'
      const efficiencyFlag = iRoas > 0 && iRoas < 2.0 ? 'REVIEW' : 'OK'

      // Parse ad name fields (same path as real data via useData.js)
      const parsed = parseAdName(ad.adName)

      rows.push({
        date: dateStr,
        funnel_stage:  ad.funnel,
        campaign_name: ad.campaignName,
        adsetName:     ad.adsetName,
        ad_name:       ad.adName,
        spend, revenue, purchases, impressions, clicks,
        frequency: +frequency.toFixed(2),
        atc, checkouts,
        iRevenue, iPurchases, iAtc, iCheckouts,
        iRoas:  +iRoas.toFixed(4),
        iCpa:   +iCpa.toFixed(2),
        thumbStopRatio: +thumbStop.toFixed(4),
        hookRate:       +hookRate.toFixed(4),
        roasGapPct:     +roasGapPct.toFixed(2),
        purchaseGapPct: +purchaseGapPct.toFixed(2),
        revenueGapPct:  +revenueGapPct.toFixed(2),
        atcToPurchaseRate:      +atcToPurchaseRate.toFixed(4),
        checkoutToPurchaseRate: +checkoutToPurchaseRate.toFixed(4),
        views3sec,
        views25pct,
        reach,
        fatigueFlag,
        efficiencyFlag,
        contentPillar:  ad.contentPillar,
        creativeFormat: parsed.format,
        previewLink:    ad.previewLink ?? null,
        // ad name parsed fields
        ...parsed,
      })
    }
  }

  return rows
}
