import React, { useState } from 'react'

const SECTIONS = [
  {
    title: 'Core Performance',
    color: '#1E3A8A',
    metrics: [
      {
        name: 'Spend',
        formula: null,
        what: 'Total money paid to Meta to run your ads in the selected period.',
        interpret: 'Your input cost. Compare against Revenue and ROAS to judge efficiency.',
      },
      {
        name: 'Revenue',
        formula: 'Sum of purchase values',
        what: 'Total value of purchases attributed to your ads using Meta\'s default attribution window (7-day click + 1-day view).',
        interpret: 'Platform-reported sales. Expect some over-attribution vs actual incremental revenue.',
      },
      {
        name: 'ROAS (Return on Ad Spend)',
        formula: 'Revenue ÷ Spend',
        what: 'How much revenue you get back for every dollar spent on ads.',
        interpret: 'A ROAS of 3.0 means every $1 spent returned $3 in reported revenue. This is a platform number — it includes view-through and click-through credit and may overstate true return.',
      },
      {
        name: 'Purchases',
        formula: 'Count of purchase events',
        what: 'Number of purchase conversions attributed to your ads.',
        interpret: 'Your primary conversion count. Use alongside CPP and ROAS to judge campaign efficiency.',
      },
      {
        name: 'CPP / CPA (Cost Per Purchase)',
        formula: 'Spend ÷ Purchases',
        what: 'How much you paid, on average, for each purchase attributed to your ads.',
        interpret: 'Lower is better. Compare against your average order value and margin to judge profitability.',
      },
    ],
  },
  {
    title: 'Reach & Awareness',
    color: '#0F766E',
    metrics: [
      {
        name: 'Impressions',
        formula: 'Count of ad views',
        what: 'Total number of times your ads were displayed, including multiple views by the same person.',
        interpret: 'A volume metric. High impressions with low reach means the same people are seeing your ad repeatedly — watch frequency.',
      },
      {
        name: 'Reach',
        formula: 'Count of unique people who saw the ad',
        what: 'How many distinct people were exposed to your ads. Unlike impressions, repeat views don\'t count.',
        interpret: 'Tells you audience breadth. If reach is growing slowly but impressions are rising, your frequency is climbing.',
      },
      {
        name: 'CPM (Cost Per Mille)',
        formula: 'Spend ÷ Impressions × 1,000',
        what: 'How much it costs to get 1,000 impressions.',
        interpret: 'Meta\'s price for attention in your auction. Rising CPM means the auction is more competitive or your audience is saturating.',
      },
      {
        name: 'CTR (Click-Through Rate)',
        formula: 'Clicks ÷ Impressions × 100',
        what: 'The percentage of people who saw your ad and clicked on it.',
        interpret: 'A signal of creative and offer relevance. Below 1% is weak for most placements. Above 2% is strong. A sharp CTR drop is a classic fatigue signal.',
      },
      {
        name: 'Frequency',
        formula: 'Impressions ÷ Reach',
        what: 'Average number of times each unique person saw your ad in the selected period.',
        interpret: 'Above 3 means most people have seen the ad multiple times. Above 4 is a strong fatigue signal. In remarketing audiences, higher frequency is more acceptable.',
      },
      {
        name: 'CPC (Cost Per Click)',
        formula: 'Spend ÷ Clicks',
        what: 'How much you paid on average for each link click.',
        interpret: 'Useful for comparing creative efficiency. High CPC alongside high CTR means expensive traffic — check landing page conversion rates.',
      },
    ],
  },
  {
    title: 'Funnel Metrics',
    color: '#7C3AED',
    metrics: [
      {
        name: 'Add to Cart (ATC)',
        formula: 'Count of add-to-cart events',
        what: 'Number of times someone added a product to their cart after clicking your ad.',
        interpret: 'A mid-funnel signal. High ATCs with low purchases suggests a checkout or offer problem, not a traffic problem.',
      },
      {
        name: 'Cost per ATC',
        formula: 'Spend ÷ Add to Carts',
        what: 'How much you paid on average for each add-to-cart event.',
        interpret: 'A proxy for engagement efficiency before the checkout step. Useful when purchase volume is too low to optimise against.',
      },
      {
        name: 'Checkouts Initiated',
        formula: 'Count of initiate-checkout events',
        what: 'Number of times someone started the checkout process.',
        interpret: 'The step between ATC and purchase. High checkouts with low purchases points to payment friction — shipping costs, trust signals, or checkout UX.',
      },
      {
        name: 'Cost per Checkout',
        formula: 'Spend ÷ Checkouts Initiated',
        what: 'How much you paid on average for each checkout initiation.',
        interpret: 'Compare to CPP to understand your checkout-to-purchase conversion rate.',
      },
      {
        name: 'ATC → Purchase Rate',
        formula: 'Purchases ÷ Add to Carts',
        what: 'The percentage of cart additions that converted into a completed purchase.',
        interpret: 'Below 30% suggests a checkout or offer problem. Above 50% means your bottom funnel is strong.',
      },
      {
        name: 'Checkout → Purchase Rate',
        formula: 'Purchases ÷ Checkouts Initiated',
        what: 'The percentage of checkout starts that completed as purchases.',
        interpret: 'Isolates payment-step drop-off. Low rate here points to friction at checkout — unexpected costs, limited payment options, or trust issues.',
      },
    ],
  },
  {
    title: 'Video & Creative Engagement',
    color: '#B45309',
    metrics: [
      {
        name: '3-Second Views',
        formula: 'Count of video views ≥ 3 seconds',
        what: 'How many times your video was watched for at least 3 consecutive seconds.',
        interpret: 'The standard threshold for whether someone "stopped" on your ad vs scrolling past. Used to calculate Thumb Stop Rate.',
      },
      {
        name: 'Views to 25%',
        formula: 'Count of views reaching 25% completion',
        what: 'How many times your video was watched to at least the 25% mark.',
        interpret: 'A deeper engagement signal than 3-second views. Used to calculate Hook Rate and Hold Rate.',
      },
      {
        name: 'Thumb Stop Rate',
        formula: '3-Second Views ÷ Impressions',
        what: 'The percentage of people who saw your ad and watched at least 3 seconds of it.',
        interpret: 'Measures how well the first 3 seconds stop the scroll. Below 25% = weak opening. Above 30% = strong hook.',
      },
      {
        name: 'Hook Rate',
        formula: 'Views to 25% ÷ Impressions',
        what: 'The percentage of all people who saw your ad and made it at least 25% through.',
        interpret: 'Measures combined hook strength and early body. Below 15% means the creative is losing most people in the first few seconds.',
      },
      {
        name: 'Hold Rate',
        formula: 'Views to 25% ÷ 3-Second Views',
        what: 'Of the people who watched at least 3 seconds, how many continued to the 25% mark.',
        interpret: 'Isolates body quality from hook quality. High thumb-stop with low hold rate = great hook, weak body.',
      },
    ],
  },
  {
    title: 'Incrementality',
    color: '#166534',
    metrics: [
      {
        name: 'Incremental Revenue (iRevenue)',
        formula: 'Platform Revenue × Incremental Multiplier',
        what: 'The portion of revenue that would not have occurred if the ad had never run.',
        interpret: 'Always lower than platform revenue. The gap represents organic sales and attribution credit Meta gives itself. This is a better measure of true business impact.',
      },
      {
        name: 'Incremental ROAS (iROAS)',
        formula: 'Incremental Revenue ÷ Spend',
        what: 'How much truly incremental revenue each dollar of spend generates, adjusted for organic and over-attributed sales.',
        interpret: 'The most honest measure of ad performance. A platform ROAS of 4.0 with an iROAS of 2.2 means roughly half the reported revenue would have happened anyway.',
      },
      {
        name: 'Incremental Purchases',
        formula: 'Platform Purchases × Incremental Multiplier',
        what: 'Purchases that would not have happened without the ad — stripped of organic and view-through over-credit.',
        interpret: 'A more conservative and realistic conversion count. Use this for true CAC calculations.',
      },
      {
        name: 'NCAC (New Customer Acquisition Cost)',
        formula: 'Spend ÷ Incremental Purchases',
        what: 'How much it actually cost to generate one incremental purchase, after removing over-attributed conversions.',
        interpret: 'The true acquisition cost. Always higher than CPP. Compare against customer LTV to judge long-term profitability.',
      },
      {
        name: 'ROAS Gap',
        formula: '(Platform ROAS − iROAS) ÷ Platform ROAS × 100',
        what: 'The percentage difference between what Meta reports and the true incremental ROAS.',
        interpret: 'Below 25% = healthy. 25–60% = monitor. Above 60% = significant over-attribution, common in remarketing where Meta takes credit for organic converters.',
      },
      {
        name: 'Attribution Multiple',
        formula: 'Platform ROAS ÷ iROAS',
        what: 'How many times larger the platform-reported ROAS is compared to the true incremental ROAS.',
        interpret: '1.5× means Meta is over-reporting by 50%. Above 3× is a red flag — a large portion of your "ad-driven" revenue was happening organically.',
      },
    ],
  },
  {
    title: 'Creative Health',
    color: '#9D174D',
    metrics: [
      {
        name: 'Fatigue Score',
        formula: 'Frequency · CTR decline · Thumb-stop decline · Days active · ROAS decline',
        what: 'A 0–100 composite score measuring how worn-out a creative is. Each component compares the last 7 days vs the prior 7 days.',
        interpret: '0–30 = healthy. 31–60 = watch closely. 61–80 = refresh soon. 81–100 = kill candidate.',
      },
      {
        name: 'Saturation Score',
        formula: 'Reach growth slowdown · CPM rise · Frequency growth',
        what: 'A 0–100 score measuring how exhausted the target audience is, independent of creative fatigue.',
        interpret: 'A saturated audience means you\'ve shown this ad to most people who will respond. The fix is new audiences or broader targeting, not new creative. Above 70 = audience tapped out.',
      },
      {
        name: 'Engagement Score',
        formula: 'Normalised thumb-stop · hook rate · hold rate · CTR vs account medians',
        what: 'A 0–100 score for how well the creative earns and keeps attention relative to other ads in the account. 50 = exactly at the account median.',
        interpret: 'Below 40 = underperforming at capturing attention vs your own account average. Above 60 = strong engagement.',
      },
      {
        name: 'Creative Health',
        formula: 'Rule-based verdict: fatigue score · iROAS vs target · saturation · trend',
        what: 'A single-word verdict summarising what action to take with a creative.',
        interpret: 'Scale = increase budget. Healthy = leave it. Monitor = early warning signs. Refresh soon = prepare a replacement. Kill = performance broken down. Audience saturated = creative is fine, audience is not. Too new = insufficient data.',
      },
      {
        name: 'Trend Direction',
        formula: 'Rule-based label: last 7d vs prior 7d across ROAS, CTR, spend, frequency, CPM',
        what: 'A directional label describing what has been happening to this creative over the past week.',
        interpret: 'Improving = ROAS rising. Scaling well = spend and ROAS both rising. Stable = no significant change. Declining = ROAS and engagement falling. Fatiguing = frequency up, performance down. Saturating = CPM rising, reach plateauing. Volatile = inconsistent daily ROAS.',
      },
      {
        name: 'Spend Velocity',
        formula: 'Last 3 days spend ÷ Prior 3 days spend',
        what: 'Whether Meta\'s algorithm is pushing more or less budget to this ad recently.',
        interpret: 'Above 1.0 = Meta is scaling this ad. Below 1.0 = Meta is pulling back. A declining velocity without a budget change means the algorithm has found a better option or the creative is fatiguing.',
      },
    ],
  },
]

export default function GlossaryTab() {
  const [search, setSearch] = useState('')
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(SECTIONS.map(s => [s.title, false]))
  )

  const query = search.toLowerCase().trim()

  const filtered = SECTIONS.map(s => ({
    ...s,
    metrics: query
      ? s.metrics.filter(m =>
          m.name.toLowerCase().includes(query) ||
          m.what.toLowerCase().includes(query) ||
          m.interpret.toLowerCase().includes(query) ||
          (m.formula && m.formula.toLowerCase().includes(query))
        )
      : s.metrics,
  })).filter(s => s.metrics.length > 0)

  function toggleSection(title) {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }))
  }

  return (
    <div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1A1A1A', letterSpacing: '-0.02em', margin: 0 }}>Metric Glossary</h2>
          <p style={{ fontSize: 13, color: '#737373', margin: '4px 0 0' }}>What every metric means and how to act on it.</p>
        </div>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="#A3A3A3" strokeWidth="1.5" />
            <path d="M10 10l3 3" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30, paddingRight: search ? 28 : 12, paddingTop: 7, paddingBottom: 7, fontSize: 13, border: '1px solid #EFEFEC', borderRadius: 8, outline: 'none', fontFamily: 'inherit', color: '#1A1A1A', background: '#FFFFFF', width: 200 }}
            onFocus={e => e.currentTarget.style.borderColor = '#D4D4D4'}
            onBlur={e => e.currentTarget.style.borderColor = '#EFEFEC'}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {filtered.map(section => {
          const open = query ? true : openSections[section.title]
          return (
            <div key={section.title}>
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.title)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 14px', textAlign: 'left' }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 2, background: section.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1A1A1A' }}>{section.title}</span>
                <span style={{ fontSize: 11, color: '#A3A3A3' }}>{section.metrics.length}</span>
                <div style={{ flex: 1, height: 1, background: '#EFEFEC' }} />
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 180ms ease', flexShrink: 0 }}>
                  <path d="M2 4l4 4 4-4" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Metric list */}
              {open && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {section.metrics.map((m, i) => (
                    <div key={m.name} style={{ padding: '16px 0', borderTop: i === 0 ? 'none' : '1px solid #F5F5F4' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{m.name}</span>
                        {m.formula && (
                          <span style={{ fontSize: 11, color: '#737373', background: '#F5F5F4', padding: '2px 7px', borderRadius: 4, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                            {m.formula}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: '#404040', lineHeight: 1.6, margin: '0 0 6px' }}>{m.what}</p>
                      <p style={{ fontSize: 13, color: '#737373', lineHeight: 1.6, margin: 0 }}>
                        <span style={{ fontWeight: 500, color: '#A3A3A3', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 6 }}>How to read it</span>
                        {m.interpret}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <p style={{ fontSize: 13, color: '#A3A3A3', padding: '40px 0', textAlign: 'center' }}>No metrics match "{search}".</p>
        )}
      </div>
    </div>
  )
}
