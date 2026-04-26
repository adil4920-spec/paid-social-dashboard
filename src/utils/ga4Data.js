// Static sample GA4 data for the last 30 days grouped by source

const SOURCES = ['Organic', 'Paid Social', 'Email', 'Direct', 'Referral']
const BASE = {
  Organic:     { sessions: 8200,  engagementRate: 62, bounceRate: 38, conversions: 310, revenue: 48000 },
  'Paid Social':{ sessions: 14500, engagementRate: 55, bounceRate: 44, conversions: 620, revenue: 110000 },
  Email:       { sessions: 3800,  engagementRate: 72, bounceRate: 28, conversions: 280, revenue: 42000 },
  Direct:      { sessions: 5600,  engagementRate: 68, bounceRate: 32, conversions: 195, revenue: 31000 },
  Referral:    { sessions: 2100,  engagementRate: 58, bounceRate: 42, conversions: 88,  revenue: 13500 },
}

function n() { return 0.88 + Math.random() * 0.24 }

export function getGA4Data(days = 30) {
  return SOURCES.map((src) => {
    const b = BASE[src]
    const scale = days / 30
    return {
      source: src,
      sessions:        Math.round(b.sessions * scale * n()),
      engagementRate:  +(b.engagementRate * n()).toFixed(1),
      bounceRate:      +(b.bounceRate * n()).toFixed(1),
      conversions:     Math.round(b.conversions * scale * n()),
      revenue:         Math.round(b.revenue * scale * n()),
    }
  })
}
