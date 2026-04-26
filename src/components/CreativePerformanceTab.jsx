import React, { useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { fmtValue } from '../utils/currency'
import { MIN_SPEND_DEFAULT, FATIGUE_THRESHOLDS, SATURATION_THRESHOLDS, computeAdMetrics, computeAdPercentiles, computeAccountMedians } from '../utils/creativeMetrics'
import { percentileBand, percentileColor } from '../lib/decision-logic/percentiles.js'

// ── Tooltip content ───────────────────────────────────────────────────────────
const TIPS = {
  ad_name:          'The ad\'s name in Meta Ads Manager.',
  creativeHealth:   'Overall verdict for this creative. Look here first — the other columns explain why. Combines fatigue score, ROAS vs target, and trend direction.',
  trendDirection:   'What\'s been happening over the last 7 days vs the prior 7 days. Improving, Scaling well, Stable, Volatile, Declining, Fatiguing, Saturating, or New.',
  sparkline:        'Daily ROAS for the last 7 days. Green = trending up, red = trending down, grey = flat.',
  spend:            'Total spend in the selected date range.',
  daysActive:       'Days since this ad first had impressions in the selected range. Older ads fatigue faster.',
  roas:             'Platform ROAS = revenue ÷ spend (7d click + 1d view attribution). Ranking shows percentile position within active ads in this account — Top 25% is green, Bottom 25% is red.',
  cpa:              'Platform cost per acquisition = spend ÷ purchases.',
  fatigueScore:     '0–100 composite. Higher = more fatigued. Frequency 30%, CTR decline vs prior 7d 25%, thumb-stop decline 20%, days active 15%, ROAS decline 10%. Above 60 = refresh. Above 80 = kill.',
  saturationScore:  '0–100 for audience exhaustion. Higher = saturated. Reach growth slowdown 40%, CPM rise 30%, frequency growth 30%. Above 70 = try new audiences, not new creative.',
  engagementScore:  '0–100 composite of thumb-stop, hook rate, hold rate, CTR — each normalised vs account median (50 = median). Below 40 = not earning attention.',
  frequency:        'Avg times each unique person saw this ad. Above 3 = monitor. Above 4 = likely fatiguing.',
  ctr:              'Clicks ÷ impressions. Below 1% is weak. Above 2% is strong.',
  thumbStop:        '3-second views ÷ impressions. Does the opening stop the scroll? Below 25% = weak hook.',
  hookRate:         'Views to 25% ÷ impressions. How many viewers made it 25% through. Below 15% = body not holding attention.',
  holdRate:         'Views to 25% ÷ 3-second views. Of people who stopped scrolling, how many engaged further. Below 50% = strong hook but weak body.',
  atcRate:          'Purchases ÷ add to carts. Bottom-funnel efficiency. Below 30% = checkout or offer issue.',
  spendVelocity:    'Last 3d spend ÷ prior 3d spend. >1 = Meta pushing more budget; <1 = pulling back. Implicit algorithmic signal of current performance.',
  fatigueFlag:      'Native flag: frequency high + CTR low threshold breached.',
  efficiencyFlag:   'Native flag: incremental ROAS below minimum threshold.',
}

// ── InfoTooltip ───────────────────────────────────────────────────────────────
function InfoTooltip({ content }) {
  const [pos, setPos] = useState(null)
  const timerRef = useRef(null)

  function show(e) {
    clearTimeout(timerRef.current)
    const r = e.currentTarget.getBoundingClientRect()
    setPos({ x: r.left + r.width / 2, y: r.top })
  }
  function hide() { timerRef.current = setTimeout(() => setPos(null), 120) }

  return (
    <>
      <span
        onMouseEnter={show} onMouseLeave={hide}
        style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 3, opacity: 0.4, cursor: 'default', color: '#737373', flexShrink: 0 }}
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 7v4.5M8 5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      {pos && createPortal(
        <div
          onMouseEnter={() => clearTimeout(timerRef.current)}
          onMouseLeave={hide}
          style={{
            position: 'fixed', left: pos.x, top: pos.y - 10,
            transform: 'translateX(-50%) translateY(-100%)',
            background: '#1A1A1A', color: '#F5F5F5',
            fontSize: 12, lineHeight: 1.55, padding: '8px 12px',
            borderRadius: 8, maxWidth: 280, zIndex: 9999,
            pointerEvents: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          }}
        >
          {content}
          <div style={{
            position: 'absolute', left: '50%', bottom: -4,
            transform: 'translateX(-50%) rotate(45deg)',
            width: 8, height: 8, background: '#1A1A1A',
          }} />
        </div>,
        document.body
      )}
    </>
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline7d({ values }) {
  const pts = values.map((v, i) => [i, v])
  const valid = pts.filter(([, v]) => v != null)
  if (valid.length < 2) return (
    <div style={{ width: 80, height: 24, display: 'flex', alignItems: 'center' }}>
      <span style={{ fontSize: 10, color: '#D4D4D4' }}>—</span>
    </div>
  )

  const vals = valid.map(([, v]) => v)
  const mid  = Math.floor(vals.length / 2)
  const avgA = vals.slice(0, mid).reduce((s, v) => s + v, 0) / (mid || 1)
  const avgB = vals.slice(mid).reduce((s, v) => s + v, 0) / (vals.length - mid || 1)
  const diff = avgB - avgA
  const color = Math.abs(diff) < avgA * 0.05 ? '#A3A3A3' : diff > 0 ? '#16A34A' : '#DC2626'

  const W = 80, H = 24, PX = 1, PY = 3
  const minV = Math.min(...vals), maxV = Math.max(...vals), rng = maxV - minV || 1
  const mapped = valid.map(([i, v]) => [
    PX + (i / (values.length - 1)) * (W - 2 * PX),
    PY + (1 - (v - minV) / rng) * (H - 2 * PY),
  ])
  let d = `M${mapped[0][0].toFixed(1)},${mapped[0][1].toFixed(1)}`
  for (let i = 1; i < mapped.length; i++) {
    d += ` L${mapped[i][0].toFixed(1)},${mapped[i][1].toFixed(1)}`
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H, display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Badges ────────────────────────────────────────────────────────────────────
const HEALTH_S = {
  'Scale':              { c: '#15803D', bg: '#DCFCE7', br: '#BBF7D0' },
  'Healthy':            { c: '#16A34A', bg: '#F0FDF4', br: '#D1FAE5' },
  'Monitor':            { c: '#92400E', bg: '#FEF3C7', br: '#FDE68A' },
  'Inconsistent':       { c: '#92400E', bg: '#FEF3C7', br: '#FDE68A' },
  'Refresh soon':       { c: '#C2410C', bg: '#FFF7ED', br: '#FED7AA' },
  'Audience saturated': { c: '#C2410C', bg: '#FFF7ED', br: '#FED7AA' },
  'Kill':               { c: '#B91C1C', bg: '#FEF2F2', br: '#FECACA' },
  'Underperforming':    { c: '#DC2626', bg: '#FEF2F2', br: '#FECACA' },
  'Too new':            { c: '#737373', bg: '#F5F5F5', br: '#E5E5E5' },
}

function HealthBadge({ value }) {
  const s = HEALTH_S[value] ?? HEALTH_S['Too new']
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '0.01em',
      color: s.c, background: s.bg, border: `1px solid ${s.br}`,
    }}>
      {value}
    </span>
  )
}

const TREND_C = {
  'Improving':    '#16A34A', 'Scaling well': '#16A34A',
  'Stable':       '#737373', 'New':          '#A3A3A3',
  'Volatile':     '#D97706',
  'Declining':    '#DC2626', 'Fatiguing':    '#DC2626', 'Saturating': '#DC2626',
}

function TrendBadge({ value }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 500, color: TREND_C[value] ?? '#737373', whiteSpace: 'nowrap' }}>
      {value}
    </span>
  )
}

// ── Score cell ────────────────────────────────────────────────────────────────
function ScoreCell({ value, lo, hi, invert = false }) {
  // invert=false: low is good (fatigue, saturation)
  // invert=true:  high is good (engagement)
  const n = Math.round(value)
  let color, bg
  if (!invert) {
    color = n <= lo ? '#16A34A' : n <= hi ? '#92400E' : '#DC2626'
    bg    = n <= lo ? 'rgba(22,163,74,0.09)' : n <= hi ? 'rgba(245,158,11,0.09)' : 'rgba(220,38,38,0.09)'
  } else {
    color = n >= hi ? '#16A34A' : n >= lo ? '#92400E' : '#DC2626'
    bg    = n >= hi ? 'rgba(22,163,74,0.09)' : n >= lo ? 'rgba(245,158,11,0.09)' : 'rgba(220,38,38,0.09)'
  }
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 4,
      fontSize: 12, fontWeight: 600, color, background: bg,
      fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'center',
    }}>
      {n}
    </span>
  )
}

// ── Column header ─────────────────────────────────────────────────────────────
function Th({ label, tip, sk, sort, onSort, style = {} }) {
  const active = sort.key === sk
  return (
    <th
      onClick={sk ? () => onSort(sk) : undefined}
      style={{
        padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap',
        fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em',
        color: active ? '#1A1A1A' : '#A3A3A3', cursor: sk ? 'pointer' : 'default',
        userSelect: 'none', ...style,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        {label}
        {tip && <InfoTooltip content={tip} />}
        {active && <span style={{ marginLeft: 2 }}>{sort.dir === -1 ? '↓' : '↑'}</span>}
      </span>
    </th>
  )
}

// ── Toggle pill ───────────────────────────────────────────────────────────────
function Toggle({ label, value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
        border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms ease',
        background: value ? '#1E3A8A' : 'transparent',
        color:      value ? '#FFFFFF'  : '#737373',
        borderColor: value ? '#1E3A8A' : '#EFEFEC',
      }}
    >
      {label}
    </button>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function CreativePerformanceTab({ filteredRows, picker }) {
  const [sort,           setSort]           = useState({ key: 'spend', dir: -1 })
  const [minSpend,       setMinSpend]       = useState(MIN_SPEND_DEFAULT)
  const [showFlagged,    setShowFlagged]    = useState(false)
  const [hideTooNew,     setHideTooNew]     = useState(false)
  const [search,         setSearch]         = useState('')

  const maxDate = useMemo(() =>
    filteredRows.reduce((m, r) => r.date > m ? r.date : m, '')
  , [filteredRows])

  // Group raw rows by ad_name
  const adGroups = useMemo(() => {
    const map = {}
    for (const r of filteredRows) {
      const k = r.ad_name || 'Unknown'
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return map
  }, [filteredRows])

  const medians = useMemo(() => computeAccountMedians(adGroups), [adGroups])

  // Compute per-ad metrics (two-pass: raw → percentiles + finalised health)
  const allAds = useMemo(() => {
    if (!maxDate) return []
    const raw = Object.entries(adGroups).map(([name, rows]) => computeAdMetrics(name, rows, maxDate, medians))
    return computeAdPercentiles(raw)
  }, [adGroups, maxDate, medians])

  // Filter
  const visible = useMemo(() => {
    let rows = allAds.filter(r => r.spend >= minSpend)
    if (search)      rows = rows.filter(r => r.ad_name.toLowerCase().includes(search.toLowerCase()))
    if (showFlagged) rows = rows.filter(r =>
      r.fatigueFlag === 'FATIGUED' || r.efficiencyFlag === 'REVIEW' ||
      ['Kill', 'Refresh soon'].includes(r.creativeHealth)
    )
    if (hideTooNew)  rows = rows.filter(r => r.creativeHealth !== 'Too new')
    return rows
  }, [allAds, minSpend, search, showFlagged, hideTooNew])

  // Sort
  const sorted = useMemo(() =>
    [...visible].sort((a, b) => {
      const ak = a[sort.key], bk = b[sort.key]
      if (typeof ak === 'string') return sort.dir * String(ak).localeCompare(String(bk ?? ''))
      return sort.dir * ((ak ?? 0) - (bk ?? 0))
    })
  , [visible, sort])

  function toggleSort(key) { setSort(s => ({ key, dir: s.key === key ? -s.dir : -1 })) }

  function freqColor(v) {
    return v > 4 ? '#DC2626' : v > 3 ? '#D97706' : '#1A1A1A'
  }
  function ctrColor(v) { return v < 0.01 ? '#DC2626' : '#1A1A1A' }
  function ratioColor(v, warn) { return v != null && v < warn ? '#DC2626' : '#1A1A1A' }
  function velocityColor(v) { return v < 0.5 ? '#DC2626' : v > 1.5 ? '#16A34A' : '#1A1A1A' }

  const pct = v => v != null ? (v * 100).toFixed(1) + '%' : '—'

  if (!maxDate) return (
    <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: '#A3A3A3' }}>No data in selected range.</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

          {/* Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg style={{ position: 'absolute', left: 8, pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="#A3A3A3" strokeWidth="1.5" />
              <path d="M10 10l3 3" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text" placeholder="Search ads" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                paddingLeft: 28, paddingRight: search ? 26 : 10, paddingTop: 5, paddingBottom: 5,
                fontSize: 12, border: '1px solid #EFEFEC', borderRadius: 6,
                outline: 'none', fontFamily: 'inherit', color: '#1A1A1A',
                background: '#FFFFFF', width: 200, transition: 'border-color 150ms ease',
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#D4D4D4'}
              onBlur={e => e.currentTarget.style.borderColor = '#EFEFEC'}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 7, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {/* Min spend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#737373' }}>Min spend</span>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <select value={minSpend} onChange={e => setMinSpend(+e.target.value)} style={{
                appearance: 'none', WebkitAppearance: 'none',
                padding: '5px 24px 5px 10px', fontSize: 12, fontFamily: 'inherit',
                border: '1px solid #EFEFEC', borderRadius: 6,
                background: 'transparent', color: '#1A1A1A', cursor: 'pointer', outline: 'none',
              }}>
                {[0, 25, 50, 100, 200, 500].map(v => <option key={v} value={v}>A${v}</option>)}
              </select>
              <svg style={{ position: 'absolute', right: 7, pointerEvents: 'none' }} width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <Toggle label="Flagged only" value={showFlagged} onChange={setShowFlagged} />
          <Toggle label="Hide too new"  value={hideTooNew}  onChange={setHideTooNew}  />
          <span style={{ fontSize: 12, color: '#A3A3A3' }}>{sorted.length} ads</span>
        </div>
        {picker}
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 'max-content' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
              <Th label="Ad Name"    tip={TIPS.ad_name}         sk="ad_name"        sort={sort} onSort={toggleSort} style={{ paddingLeft: 20, minWidth: 220 }} />
              <Th label="Health"     tip={TIPS.creativeHealth}  sk="creativeHealth" sort={sort} onSort={toggleSort} />
              <Th label="Trend"      tip={TIPS.trendDirection}  sk="trendDirection" sort={sort} onSort={toggleSort} />
              <Th label="7d ROAS"    tip={TIPS.sparkline}       sk={null}           sort={sort} onSort={toggleSort} />
              <Th label="Spend"      tip={TIPS.spend}           sk="spend"          sort={sort} onSort={toggleSort} />
              <Th label="Days"       tip={TIPS.daysActive}      sk="daysActive"     sort={sort} onSort={toggleSort} />
              <Th label="ROAS (rank)" tip={TIPS.roas}            sk="roas"           sort={sort} onSort={toggleSort} />
              <Th label="CPA"        tip={TIPS.cpa}             sk="cpa"            sort={sort} onSort={toggleSort} />
              <Th label="Fatigue"    tip={TIPS.fatigueScore}    sk="fatigueScore"   sort={sort} onSort={toggleSort} />
              <Th label="Saturation" tip={TIPS.saturationScore} sk="saturationScore" sort={sort} onSort={toggleSort} />
              <Th label="Engagement" tip={TIPS.engagementScore} sk="engagementScore" sort={sort} onSort={toggleSort} />
              <Th label="Freq"       tip={TIPS.frequency}       sk="frequency"      sort={sort} onSort={toggleSort} />
              <Th label="CTR"        tip={TIPS.ctr}             sk="ctr"            sort={sort} onSort={toggleSort} />
              <Th label="Thumb Stop" tip={TIPS.thumbStop}       sk="thumbStop"      sort={sort} onSort={toggleSort} />
              <Th label="Hook Rate"  tip={TIPS.hookRate}        sk="hookRate"       sort={sort} onSort={toggleSort} />
              <Th label="Hold Rate"  tip={TIPS.holdRate}        sk="holdRate"       sort={sort} onSort={toggleSort} />
              <Th label="ATC→Purch"  tip={TIPS.atcRate}         sk="atcRate"        sort={sort} onSort={toggleSort} />
              <Th label="Velocity"   tip={TIPS.spendVelocity}   sk="spendVelocity"  sort={sort} onSort={toggleSort} />
              <Th label="Fat. Flag"  tip={TIPS.fatigueFlag}     sk="fatigueFlag"    sort={sort} onSort={toggleSort} />
              <Th label="Eff. Flag"  tip={TIPS.efficiencyFlag}  sk="efficiencyFlag" sort={sort} onSort={toggleSort} style={{ paddingRight: 20 }} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: '1px solid #F5F5F4',
                  background: row.fatigueFlag === 'FATIGUED' ? 'rgba(220,38,38,0.025)' : undefined,
                }}
              >
                <td style={{ padding: '9px 12px 9px 20px', fontSize: 12, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap' }}>
                  {row.ad_name}
                </td>
                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                  <HealthBadge value={row.creativeHealth} />
                </td>
                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                  <TrendBadge value={row.trendDirection} />
                </td>
                <td style={{ padding: '9px 12px' }}>
                  <Sparkline7d values={row.sparkline} />
                </td>
                <td style={{ padding: '9px 12px', fontSize: 12, color: '#1A1A1A', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtValue(row.spend, 'currency', 'AU')}
                </td>
                <td style={{ padding: '9px 12px', fontSize: 12, color: '#737373', whiteSpace: 'nowrap' }}>
                  {row.daysActive}d
                </td>
                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: percentileColor(row.p_roas_percentile), fontVariantNumeric: 'tabular-nums' }}>
                      {row.roas ? row.roas.toFixed(2) : '—'}
                    </span>
                    {percentileBand(row.p_roas_percentile) && (
                      <span style={{
                        fontSize: 10, fontWeight: 500, padding: '1px 5px', borderRadius: 3,
                        color: percentileColor(row.p_roas_percentile),
                        background: percentileColor(row.p_roas_percentile) + '18',
                      }}>
                        {percentileBand(row.p_roas_percentile)}
                      </span>
                    )}
                  </span>
                </td>
                <td style={{ padding: '9px 12px', fontSize: 12, color: '#1A1A1A', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {row.cpa ? fmtValue(row.cpa, 'currency', 'AU') : '—'}
                </td>
                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                  <ScoreCell value={row.fatigueScore}    lo={FATIGUE_THRESHOLDS.healthy}    hi={FATIGUE_THRESHOLDS.watch}    />
                </td>
                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                  <ScoreCell value={row.saturationScore} lo={SATURATION_THRESHOLDS.healthy} hi={SATURATION_THRESHOLDS.watch} />
                </td>
                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                  <ScoreCell value={row.engagementScore} lo={40} hi={61} invert />
                </td>
                <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, color: freqColor(row.frequency), whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {row.frequency ? row.frequency.toFixed(2) : '—'}
                </td>
                <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: row.ctr < 0.01 ? 500 : 400, color: ctrColor(row.ctr), whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {pct(row.ctr)}
                </td>
                <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: row.thumbStop < 0.25 ? 500 : 400, color: ratioColor(row.thumbStop, 0.25), whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {pct(row.thumbStop)}
                </td>
                <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: row.hookRate < 0.15 ? 500 : 400, color: ratioColor(row.hookRate, 0.15), whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {pct(row.hookRate)}
                </td>
                <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: row.holdRate < 0.50 ? 500 : 400, color: ratioColor(row.holdRate, 0.50), whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {pct(row.holdRate)}
                </td>
                <td style={{ padding: '9px 12px', fontSize: 12, color: '#1A1A1A', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {row.atcRate ? pct(row.atcRate) : '—'}
                </td>
                <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 500, color: velocityColor(row.spendVelocity), whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {row.spendVelocity ? row.spendVelocity.toFixed(2) + '×' : '—'}
                </td>
                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                  {row.fatigueFlag === 'FATIGUED'
                    ? <span style={{ fontSize: 11, fontWeight: 500, color: '#DC2626', background: 'rgba(220,38,38,0.08)', padding: '1px 6px', borderRadius: 4 }}>Fatigued</span>
                    : <span style={{ fontSize: 11, color: '#A3A3A3' }}>—</span>
                  }
                </td>
                <td style={{ padding: '9px 20px 9px 12px', whiteSpace: 'nowrap' }}>
                  {row.efficiencyFlag === 'REVIEW'
                    ? <span style={{ fontSize: 11, fontWeight: 500, color: '#D97706', background: 'rgba(217,119,6,0.08)', padding: '1px 6px', borderRadius: 4 }}>Review</span>
                    : <span style={{ fontSize: 11, color: '#A3A3A3' }}>—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#A3A3A3' }}>No ads match the current filters.</p>
          </div>
        )}
      </div>
    </div>
  )
}
