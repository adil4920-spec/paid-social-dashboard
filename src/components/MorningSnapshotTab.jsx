import React, { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Line } from 'react-chartjs-2'
import {
  aggregateRows, computeMetrics, groupByDate, groupByField, groupByAdset,
  filterByDateRange, DEFAULT_TARGETS,
} from '../utils/metrics'
import { parseAdName } from '../utils/adName'
import { computeAdMetrics, computeAdPercentiles, computeAccountMedians, MIN_SPEND_DEFAULT } from '../utils/creativeMetrics'
import { computeWindowData } from '../utils/dailySummary'

// ── helpers ─────────────────────────────────────────────────────────────────
function filterMtd(rows) {
  const now = new Date()
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return rows.filter(r => r.date.startsWith(prefix))
}

function getMaxDate(rows) {
  if (!rows.length) return null
  return rows.reduce((max, r) => r.date > max ? r.date : max, rows[0].date)
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)) }

const AU$ = v => 'A$' + Math.round(v || 0).toLocaleString('en-AU')
const AU$2 = v => 'A$' + (v || 0).toFixed(2)

function adShortName(fullName) {
  const p = parseAdName(fullName)
  if (p.description) return p.format ? `${p.description} · ${p.format}` : p.description
  return fullName.slice(0, 50)
}

// ── Creative status modal ─────────────────────────────────────────────────────
function CreativeModal({ cs, onClose }) {
  const groups = [
    { label: 'Kill',         ads: [...cs.kill].sort((a, b) => b.spend - a.spend),           color: '#B91C1C', bg: 'rgba(220,38,38,0.05)',   hint: 'Fatigue score above kill threshold, bottom-quartile ROAS with meaningful spend, or consistently underperforming — pause these' },
    { label: 'Refresh soon', ads: [...cs.refresh].sort((a, b) => b.fatigueScore - a.fatigueScore), color: '#C2410C', bg: 'rgba(217,119,6,0.05)',   hint: 'Fatigue score in refresh range or audience saturated — update creative before it hits the kill threshold' },
    { label: 'Monitor',      ads: [...cs.monitor].sort((a, b) => b.spend - a.spend),         color: '#92400E', bg: 'rgba(245,158,11,0.05)',  hint: 'Fatigue score building or delivery inconsistent — not yet actionable but worth watching daily' },
    { label: 'Scale',        ads: [...cs.scale].sort((a, b) => b.roas - a.roas),             color: '#15803D', bg: 'rgba(22,163,74,0.05)',    hint: 'Top-quartile ROAS, low fatigue, positive trend and spend velocity — increase budget on these' },
  ].filter(g => g.ads.length > 0)

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #EFEFEC', width: '100%', maxWidth: 640, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #EFEFEC', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>Creative Status</h3>
            <p style={{ fontSize: 12, color: '#A3A3A3', margin: '3px 0 0' }}>MTD · classified by incremental ROAS, frequency and efficiency</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#A3A3A3', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* Modal body */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groups.map(g => (
            <div key={g.label}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: g.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{g.label}</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: '#A3A3A3' }}>{g.ads.length} ad{g.ads.length !== 1 ? 's' : ''} — {g.hint}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {g.ads.map(a => (
                  <div key={a.ad_name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 12px', borderRadius: 8, background: g.bg, border: `1px solid ${g.color}22` }}>
                    <span style={{ fontSize: 12, color: '#1A1A1A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.ad_name}>
                      {adShortName(a.ad_name)}
                    </span>
                    <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: '#737373' }}>ROAS <strong style={{ color: '#1A1A1A' }}>{a.roas.toFixed(2)}x</strong></span>
                      <span style={{ fontSize: 11, color: '#737373' }}>Freq <strong style={{ color: '#1A1A1A' }}>{a.frequency.toFixed(2)}</strong></span>
                      <span style={{ fontSize: 11, color: '#737373' }}>{AU$(a.spend)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {cs.tooNew.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Too New</span>
                <span style={{ fontSize: 11, color: '#A3A3A3' }}>{cs.tooNew.length} ad{cs.tooNew.length !== 1 ? 's' : ''} — under A$20 spend, not enough data yet</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {cs.tooNew.map(a => (
                  <div key={a.ad_name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(115,115,115,0.05)', border: '1px solid #EFEFEC' }}>
                    <span style={{ fontSize: 12, color: '#737373', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.ad_name}>
                      {adShortName(a.ad_name)}
                    </span>
                    <span style={{ fontSize: 11, color: '#A3A3A3' }}>{AU$(a.spend)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── SVG donut ────────────────────────────────────────────────────────────────
function DonutGauge({ score }) {
  const r = 36, cx = 50, cy = 50
  const C = 2 * Math.PI * r
  const fill = C * clamp(score / 100, 0, 1)
  const color = score >= 70 ? '#16a34a' : score >= 45 ? '#d97706' : '#dc2626'
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F0F0EE" strokeWidth="9" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="9"
        strokeDasharray={`${fill.toFixed(1)} ${C.toFixed(1)}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle"
        fontSize="18" fontWeight="600" fill="#1A1A1A" fontFamily="inherit">
        {Math.round(score)}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle"
        fontSize="10" fill="#A3A3A3" fontFamily="inherit">/100</text>
    </svg>
  )
}

// ── Pacing chart ─────────────────────────────────────────────────────────────
function PacingChart({ mtdRows, budget }) {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const todayDay = now.getDate()
  const W = 400, H = 110, pL = 4, pR = 4, pT = 8, pB = 20
  const iW = W - pL - pR, iH = H - pT - pB

  const dailyByDay = {}
  for (const r of mtdRows) {
    const day = parseInt(r.date.slice(8), 10)
    dailyByDay[day] = (dailyByDay[day] || 0) + r.spend
  }

  let cum = 0
  const pts = []
  for (let d = 1; d <= todayDay - 1; d++) {
    cum += dailyByDay[d] || 0
    pts.push([d, cum])
  }

  const maxY = Math.max(budget || 1, (cum || 0) * 1.1, 1)
  const sx = d => pL + ((d - 1) / Math.max(daysInMonth - 1, 1)) * iW
  const sy = v => pT + iH - (v / maxY) * iH

  const idealPath = `M${sx(1).toFixed(1)},${sy(0).toFixed(1)} L${sx(daysInMonth).toFixed(1)},${sy(budget).toFixed(1)}`
  const actualPath = pts.length
    ? pts.map(([d, v], i) => `${i ? 'L' : 'M'}${sx(d).toFixed(1)},${sy(v).toFixed(1)}`).join(' ')
    : ''
  const areaPath = pts.length
    ? actualPath + ` L${sx(pts[pts.length - 1][0]).toFixed(1)},${(pT + iH).toFixed(1)} L${sx(1).toFixed(1)},${(pT + iH).toFixed(1)} Z`
    : ''

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 0.5, 1].map(f => (
        <line key={f} x1={pL} x2={W - pR} y1={sy(maxY * f)} y2={sy(maxY * f)} stroke="#F0F0EE" strokeWidth="1" />
      ))}
      <path d={idealPath} stroke="#D4D4D4" strokeWidth="1.5" strokeDasharray="5 3" fill="none" />
      {areaPath && <path d={areaPath} fill="rgba(30,58,138,0.06)" />}
      {actualPath && <path d={actualPath} stroke="#1E3A8A" strokeWidth="2" fill="none" strokeLinejoin="round" />}
      {pts.length > 0 && (
        <circle cx={sx(pts[pts.length - 1][0])} cy={sy(pts[pts.length - 1][1])} r="3.5" fill="#1E3A8A" />
      )}
      <text x={pL} y={sy(budget) - 3} fontSize="8" fill="#A3A3A3">{AU$(budget)}</text>
      {[1, Math.round(daysInMonth / 2), daysInMonth].map(d => (
        <text key={d} x={sx(d)} y={H - 4} textAnchor="middle" fontSize="9" fill="#A3A3A3">{d}</text>
      ))}
    </svg>
  )
}

// ── Expanded metric chart modal ───────────────────────────────────────────────
function ExpandedMetricChart({ metric, dates, onClose, periodLabel = '14-day' }) {
  const { label, values, color, fmt } = metric

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  const periodAvg = metric.periodValue ?? 0

  const labels = dates.map(d =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''
  )

  const chartData = {
    labels,
    datasets: [{
      data: values.map(v => v > 0 ? v : null),
      borderColor: color,
      backgroundColor: color + '14',
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 5,
      borderWidth: 2,
      pointBorderColor: color,
      pointBackgroundColor: '#ffffff',
      spanGaps: true,
    }],
  }

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1A1A1A', padding: 10, cornerRadius: 8,
        titleColor: '#A3A3A3', titleFont: { size: 11, family: 'Inter' },
        bodyColor: '#FFFFFF', bodyFont: { size: 13, weight: '600', family: 'Inter' },
        callbacks: { label: ctx => '  ' + fmt(ctx.parsed.y) },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { font: { size: 11, family: 'Inter' }, color: '#A3A3A3', maxTicksLimit: 10, maxRotation: 0 },
      },
      y: {
        grid: { color: '#F5F5F4' },
        border: { display: false },
        ticks: {
          font: { size: 11, family: 'Inter' }, color: '#A3A3A3',
          callback: v => fmt(v),
        },
      },
    },
  }

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 680, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', letterSpacing: '-0.01em', margin: 0 }}>{label}</p>
            <p style={{ fontSize: 13, color: '#A3A3A3', margin: '3px 0 0' }}>Daily trend · {periodLabel}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 24, fontWeight: 600, color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', margin: 0 }}>{fmt(periodAvg)}</p>
              <p style={{ fontSize: 11, color: '#A3A3A3', margin: '1px 0 0' }}>period avg</p>
            </div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #EFEFEC', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A3A3A3', fontSize: 14, flexShrink: 0 }}>✕</button>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #EFEFEC', margin: '16px 0' }} />
        <div style={{ height: 280 }}>
          <Line data={chartData} options={chartOpts} />
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values, color = '#1E3A8A', height = 28 }) {
  if (!values || values.length < 2) return <div style={{ width: 80, height }} />
  const W = 80
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const sy = v => height - 2 - ((v - min) / range) * (height - 4)
  const sx = i => (i / (values.length - 1)) * W
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ')
  return (
    <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`}>
      <path d={path} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </svg>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 12, color: '#A3A3A3', margin: '3px 0 0' }}>{subtitle}</p>}
    </div>
  )
}

function ScoreBar({ label, score }) {
  const color = score >= 70 ? '#16a34a' : score >= 45 ? '#d97706' : '#dc2626'
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#737373' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color }}>{Math.round(score)}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: '#F0F0EE', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${clamp(score, 0, 100)}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  )
}

const PRIORITY_STYLE = {
  HIGH: { bg: 'rgba(220,38,38,0.07)',   color: '#dc2626', border: 'rgba(220,38,38,0.15)'   },
  MED:  { bg: 'rgba(217,119,6,0.07)',   color: '#d97706', border: 'rgba(217,119,6,0.15)'   },
  LOW:  { bg: 'rgba(107,114,128,0.07)', color: '#6b7280', border: 'rgba(107,114,128,0.15)' },
}

function PriorityBadge({ level }) {
  const s = PRIORITY_STYLE[level] || PRIORITY_STYLE.LOW
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
      letterSpacing: '0.04em', flexShrink: 0, whiteSpace: 'nowrap',
    }}>{level}</span>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MorningSnapshotTab({ rows = [], targets = {}, dateRange = null }) {
  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const [showCreativeModal, setShowCreativeModal] = useState(false)
  const [expandedMetric,   setExpandedMetric]   = useState(null)

  const tgtRoas  = targets?.roas  ?? 3.5
  const tgtCac   = targets?.cac   ?? 35
  const tgtSpend = targets?.spend ?? 5000

  // ── Slices ──────────────────────────────────────────────────────────────
  const yesterday  = useMemo(() => getMaxDate(rows), [rows])
  const mtdRows    = useMemo(() => filterMtd(rows), [rows])
  const rangeRows  = useMemo(() => {
    if (dateRange?.start && dateRange?.end)
      return filterByDateRange(rows, dateRange.start, dateRange.end)
    if (!yesterday) return []
    return filterByDateRange(rows, addDays(yesterday, -13), yesterday)
  }, [rows, yesterday, dateRange])
  const l14Rows = rangeRows
  const yestRows   = useMemo(() => rows.filter(r => r.date === yesterday), [rows, yesterday])

  // ── Aggregates ────────────────────────────────────────────────────────────
  const mtdAgg  = useMemo(() => aggregateRows(mtdRows),  [mtdRows])
  const mtdM    = useMemo(() => computeMetrics(mtdAgg),  [mtdAgg])
  const yAgg    = useMemo(() => aggregateRows(yestRows), [yestRows])
  const yM      = useMemo(() => computeMetrics(yAgg),    [yAgg])

  // ── Pacing ────────────────────────────────────────────────────────────────
  const now = new Date()
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed  = Math.max(1, now.getDate() - 1)
  const monthPct     = daysElapsed / daysInMonth
  const idealSpend   = tgtSpend * monthPct
  const pacingRatio  = idealSpend > 0 ? mtdAgg.spend / idealSpend : 1
  const pacingPct    = (pacingRatio * 100).toFixed(0)

  // ── Per-ad creative health (same logic as Creative tab) ──────────────────
  const adGroups = useMemo(() => {
    const map = {}
    for (const r of mtdRows) {
      const k = r.ad_name || 'Unknown'
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return map
  }, [mtdRows])

  const medians = useMemo(() => computeAccountMedians(adGroups), [adGroups])

  const mtdAds = useMemo(() => {
    if (!yesterday) return []
    const raw = Object.entries(adGroups).map(([name, adRows]) => computeAdMetrics(name, adRows, yesterday, medians))
    return computeAdPercentiles(raw)
  }, [adGroups, yesterday, medians])

  // ── Per-adset / per-campaign health ──────────────────────────────────────
  const { adsetData, campaignData } = useMemo(
    () => computeWindowData(rows, yesterday),
    [rows, yesterday]
  )

  // ── M1: Account structure ─────────────────────────────────────────────────
  const campaigns = useMemo(() => groupByField(mtdRows, 'campaign_name'), [mtdRows])
  const adsets    = useMemo(() => groupByField(mtdRows, 'adsetName'),     [mtdRows])
  const topCamps  = campaigns.slice(0, 5)
  const topConc   = topCamps[0] && mtdAgg.spend > 0 ? (topCamps[0].spend / mtdAgg.spend) * 100 : 0
  const imbalanced = topConc > 60

  const campColors = ['#1E3A8A', '#3B82F6', '#93C5FD', '#BFDBFE', '#E0EAFF']

  // ── M2: Creative status (same health definitions as Creative tab) ─────────
  const cs = useMemo(() => {
    const buckets = { kill: [], scale: [], refresh: [], monitor: [], healthy: [], tooNew: [] }
    for (const a of mtdAds) {
      if      (['Kill', 'Underperforming'].includes(a.creativeHealth))              buckets.kill.push(a)
      else if (a.creativeHealth === 'Scale')                                        buckets.scale.push(a)
      else if (['Refresh soon', 'Audience saturated'].includes(a.creativeHealth))   buckets.refresh.push(a)
      else if (['Monitor', 'Inconsistent'].includes(a.creativeHealth))              buckets.monitor.push(a)
      else if (a.creativeHealth === 'Healthy')                                      buckets.healthy.push(a)
      else                                                                          buckets.tooNew.push(a)
    }
    const total = mtdAgg.spend || 1
    const spendPct = arr => arr.reduce((s, a) => s + a.spend, 0) / total * 100
    return {
      ...buckets,
      killPct:    spendPct(buckets.kill),
      scalePct:   spendPct(buckets.scale),
      refreshPct: spendPct(buckets.refresh),
      monitorPct: spendPct(buckets.monitor),
    }
  }, [mtdAds, mtdAgg.spend])

  // ── M3: Signals ───────────────────────────────────────────────────────────
  const l14Daily = useMemo(() =>
    groupByDate(l14Rows).map(d => ({ ...d, ...computeMetrics(d) })), [l14Rows])

  // Period aggregate — matches how CampaignTable computes its headline numbers
  const rangeM    = useMemo(() => computeMetrics(aggregateRows(l14Rows)), [l14Rows])
  const rangeDays = useMemo(() => Math.max(1, new Set(l14Rows.map(r => r.date)).size), [l14Rows])

  const l7 = l14Daily.slice(-7), p7 = l14Daily.slice(0, 7)
  const avg = (arr, k) => arr.length ? arr.reduce((s, d) => s + (d[k] || 0), 0) / arr.length : 0
  const l7Roas = avg(l7, 'roas'), p7Roas = avg(p7, 'roas')
  const l7Cpm  = avg(l7, 'cpm'),  p7Cpm  = avg(p7, 'cpm')
  const l7Ctr  = avg(l7, 'ctr'),  p7Ctr  = avg(p7, 'ctr')

  // ── Health score ──────────────────────────────────────────────────────────
  const pacingScore = clamp(100 - Math.abs(pacingRatio - 1) * 80, 0, 100)

  // Stability: inverse of ROAS coefficient of variation over 14d
  const roasVals14 = l14Daily.filter(d => d.roas > 0).map(d => d.roas)
  const rMean14    = roasVals14.length ? roasVals14.reduce((s, v) => s + v, 0) / roasVals14.length : 0
  const rCV        = rMean14 > 0
    ? Math.sqrt(roasVals14.reduce((s, v) => s + (v - rMean14) ** 2, 0) / roasVals14.length) / rMean14
    : 0
  const stabilityScore = clamp((1 - rCV * 2) * 100, 0, 100)

  // Trajectory: 7d vs prior 7d ROAS delta mapped to 0–100 (0% change = 50)
  const trajectoryScore = p7Roas > 0
    ? clamp(50 + ((l7Roas - p7Roas) / p7Roas) * 200, 0, 100)
    : 50

  // Creative: share of spend on Scale+Healthy ads
  const healthyAdSpend = mtdAds.filter(a => ['Scale', 'Healthy'].includes(a.creativeHealth)).reduce((s, a) => s + a.spend, 0)
  const creativeScore  = mtdAgg.spend > 0 ? clamp((healthyAdSpend / mtdAgg.spend) * 100, 0, 100) : 50

  // Structure: frequency health + spend concentration quality
  const freqScore      = mtdM.frequency < 2 ? 100 : mtdM.frequency < 2.5 ? 85 : mtdM.frequency < 3 ? 65 : mtdM.frequency < 3.5 ? 40 : 15
  const structureScore = Math.round(
    freqScore * 0.6 +
    clamp(100 - Math.max(0, topConc - 33) * 2, 0, 100) * 0.4
  )

  // Algorithm: average spend velocity across active ads
  const activeAds      = mtdAds.filter(a => a.spend >= MIN_SPEND_DEFAULT)
  const avgVelocity    = activeAds.length ? activeAds.reduce((s, a) => s + a.spendVelocity, 0) / activeAds.length : 1
  const algorithmScore = clamp(avgVelocity * 50, 0, 100)

  const healthScore = Math.round(
    0.20 * pacingScore    +
    0.20 * stabilityScore +
    0.20 * trajectoryScore +
    0.15 * creativeScore  +
    0.15 * structureScore +
    0.10 * algorithmScore
  )

  const l7Cpa  = avg(l7, 'cac'),  p7Cpa  = avg(p7, 'cac')
  const l7Freq = avg(l7, 'frequency'), p7Freq = avg(p7, 'frequency')
  const l7Spend = avg(l7, 'spend'), p7Spend = avg(p7, 'spend')

  const signals = []

  // ROAS — any meaningful decline
  if (p7Roas > 0 && l7Roas < p7Roas * 0.85)
    signals.push({ level: 'HIGH', msg: `ROAS down ${((1 - l7Roas / p7Roas) * 100).toFixed(0)}% week-on-week — ${l7Roas.toFixed(2)}x vs prior ${p7Roas.toFixed(2)}x` })
  else if (p7Roas > 0 && l7Roas < p7Roas * 0.93)
    signals.push({ level: 'MED', msg: `ROAS softening ${((1 - l7Roas / p7Roas) * 100).toFixed(0)}% — last 7d ${l7Roas.toFixed(2)}x vs prior ${p7Roas.toFixed(2)}x` })

  // Frequency
  if (mtdM.frequency >= 3.0)
    signals.push({ level: 'HIGH', msg: `Frequency ${mtdM.frequency.toFixed(2)} — audience fatigue risk, creative rotation needed` })
  else if (mtdM.frequency >= 2.5)
    signals.push({ level: 'MED', msg: `Frequency building at ${mtdM.frequency.toFixed(2)} — approaching fatigue threshold` })
  else if (p7Freq > 0 && l7Freq > p7Freq * 1.15)
    signals.push({ level: 'MED', msg: `Frequency rising ${(((l7Freq / p7Freq) - 1) * 100).toFixed(0)}% week-on-week — monitor for saturation` })

  // CPM
  if (p7Cpm > 0 && l7Cpm > p7Cpm * 1.20)
    signals.push({ level: 'HIGH', msg: `CPM up ${(((l7Cpm / p7Cpm) - 1) * 100).toFixed(0)}% vs prior 7d — significant inventory cost increase` })
  else if (p7Cpm > 0 && l7Cpm > p7Cpm * 1.08)
    signals.push({ level: 'MED', msg: `CPM up ${(((l7Cpm / p7Cpm) - 1) * 100).toFixed(0)}% vs prior 7d — inventory costs rising` })

  // CTR
  if (p7Ctr > 0 && l7Ctr < p7Ctr * 0.80)
    signals.push({ level: 'HIGH', msg: `CTR down ${((1 - l7Ctr / p7Ctr) * 100).toFixed(0)}% vs prior 7d — creative resonance dropping sharply` })
  else if (p7Ctr > 0 && l7Ctr < p7Ctr * 0.92)
    signals.push({ level: 'MED', msg: `CTR down ${((1 - l7Ctr / p7Ctr) * 100).toFixed(0)}% vs prior 7d — creative losing click-through` })

  // CPA
  if (p7Cpa > 0 && l7Cpa > p7Cpa * 1.20)
    signals.push({ level: 'HIGH', msg: `CPA up ${(((l7Cpa / p7Cpa) - 1) * 100).toFixed(0)}% vs prior 7d — ${AU$2(l7Cpa)} vs ${AU$2(p7Cpa)} — conversion efficiency declining` })
  else if (p7Cpa > 0 && l7Cpa > p7Cpa * 1.10)
    signals.push({ level: 'MED', msg: `CPA rising ${(((l7Cpa / p7Cpa) - 1) * 100).toFixed(0)}% — ${AU$2(l7Cpa)} last 7d vs ${AU$2(p7Cpa)} prior` })

  // Attribution gap
  if (mtdM.iRoas > 0 && mtdM.roasGap > 60)
    signals.push({ level: 'HIGH', msg: `ROAS gap ${mtdM.roasGap.toFixed(0)}% — only ${(100 - mtdM.roasGap).toFixed(0)}% of platform revenue verified incremental` })
  else if (mtdM.iRoas > 0 && mtdM.roasGap > 35)
    signals.push({ level: 'MED', msg: `Attribution gap ${mtdM.roasGap.toFixed(0)}% — platform ROAS ${mtdM.roas.toFixed(2)}x vs i-ROAS ${mtdM.iRoas.toFixed(2)}x` })

  // ROAS volatility
  if (rCV > 0.5)
    signals.push({ level: 'HIGH', msg: `ROAS highly volatile (CV ${(rCV * 100).toFixed(0)}%) — inconsistent day-to-day delivery` })
  else if (rCV > 0.3)
    signals.push({ level: 'MED', msg: `ROAS variance elevated (CV ${(rCV * 100).toFixed(0)}%) — delivery unstable` })

  // Spend delivery drop
  if (p7Spend > 0 && l7Spend < p7Spend * 0.75)
    signals.push({ level: 'HIGH', msg: `Daily spend down ${((1 - l7Spend / p7Spend) * 100).toFixed(0)}% vs prior 7d — delivery may be constrained` })
  else if (p7Spend > 0 && l7Spend < p7Spend * 0.88)
    signals.push({ level: 'MED', msg: `Spend delivery slowing ${((1 - l7Spend / p7Spend) * 100).toFixed(0)}% vs prior 7d — check budget caps` })

  // Kill/refresh pressure
  if (cs.killPct > 20)
    signals.push({ level: 'HIGH', msg: `${cs.killPct.toFixed(0)}% of spend on Kill-rated ads — significant budget being wasted` })
  else if (cs.killPct > 10)
    signals.push({ level: 'MED', msg: `${cs.killPct.toFixed(0)}% of spend going to underperforming ads marked Kill` })
  if (cs.refreshPct > 25)
    signals.push({ level: 'MED', msg: `${cs.refreshPct.toFixed(0)}% of spend on ads needing creative refresh` })

  signals.sort((a, b) => ({ HIGH: 0, MED: 1, LOW: 2 }[a.level] - ({ HIGH: 0, MED: 1, LOW: 2 }[b.level])))

  // ── M4: Ad set CPA ────────────────────────────────────────────────────────
  const topAdsets = adsets.slice(0, 6)

  // ── Priorities ────────────────────────────────────────────────────────────
  const pctLabel = p => p === null ? '' : p >= 75 ? 'top 25%' : p >= 50 ? 'top half' : p < 25 ? 'bottom 25%' : 'bottom half'

  const priorities = []

  // 1. Kill ads
  const killTop = [...cs.kill].sort((a, b) => b.spend - a.spend).slice(0, 4)
  if (killTop.length) {
    const detail = killTop.map(a => {
      const parts = [`${adShortName(a.ad_name)}: ROAS ${a.roas.toFixed(2)}x`, `fatigue ${a.fatigueScore}`]
      if (a.p_roas_percentile !== null) parts.push(pctLabel(a.p_roas_percentile))
      return parts.join(', ')
    }).join(' · ')
    priorities.push({
      level: 'HIGH',
      action: `Pause ${killTop.length} underperforming ad${killTop.length > 1 ? 's' : ''}`,
      reason: detail + `. These are burning budget with poor returns. Pausing frees spend for healthier creatives.`,
    })
  }

  // 2. Pacing
  if (pacingRatio < 0.70 && daysElapsed > 15)
    priorities.push({
      level: 'HIGH',
      action: `Severe underpacing — only ${pacingPct}% of ideal MTD spend reached`,
      reason: `${AU$(mtdAgg.spend)} spent vs ${AU$(idealSpend)} ideal with ${daysInMonth - daysElapsed} days left in the month. Check for restrictive budget caps, paused campaigns, or low bid competitiveness. Catching up may require temporary budget lifts.`,
    })
  else if (pacingRatio > 1.30)
    priorities.push({
      level: 'HIGH',
      action: `Overpacing at ${pacingPct}% — at risk of exhausting budget early`,
      reason: `Spending ahead of schedule. If this continues, the account may run out of budget before month-end, causing delivery gaps. Review daily budgets and consider pausing lower-ranked entities.`,
    })
  else if (pacingRatio < 0.80)
    priorities.push({
      level: 'MED',
      action: `Underpacing at ${pacingPct}% of ideal — delivery needs a nudge`,
      reason: `${AU$(mtdAgg.spend)} of ${AU$(tgtSpend)} monthly budget used with ${daysInMonth - daysElapsed} days left. Check for budget caps hitting too early in the day, low bids, or ad disapprovals limiting reach.`,
    })

  // 3. Attribution gap
  if (mtdM.iRoas > 0 && mtdM.roasGap > 60)
    priorities.push({
      level: 'HIGH',
      action: `Audit attribution — platform reporting ${mtdM.roasGap.toFixed(0)}% more revenue than incremental`,
      reason: `Platform ROAS ${mtdM.roas.toFixed(2)}x vs incremental ROAS ${mtdM.iRoas.toFixed(2)}x. Only ${(100 - mtdM.roasGap).toFixed(0)}% of claimed revenue is verified incremental. Check view-through attribution windows, cross-channel overlap, and which campaigns drive the gap.`,
    })
  else if (mtdM.iRoas > 0 && mtdM.roasGap > 35)
    priorities.push({
      level: 'MED',
      action: `Review attribution — ${mtdM.roasGap.toFixed(0)}% gap between platform and incremental ROAS`,
      reason: `Platform ROAS ${mtdM.roas.toFixed(2)}x vs incremental ROAS ${mtdM.iRoas.toFixed(2)}x. True ROI is likely lower than dashboards suggest. Consider tightening attribution windows or running a holdout test.`,
    })

  // 4. Frequency / audience fatigue
  if (mtdM.frequency >= 3.5)
    priorities.push({
      level: 'HIGH',
      action: `Creative refresh or audience expansion needed urgently`,
      reason: `Average frequency ${mtdM.frequency.toFixed(2)} — audiences are seeing the same ads repeatedly. This drives CPM up and CTR down. Upload new creative variants or open up new targeting to break the cycle.`,
    })
  else if (mtdM.frequency >= 2.8)
    priorities.push({
      level: 'MED',
      action: `Plan creative rotation — frequency is building towards fatigue`,
      reason: `Average frequency ${mtdM.frequency.toFixed(2)}, approaching the 3.0 warning threshold. Queue new ad variants now. Waiting until fatigue hits means a gap in performance before fresh creative gets traction.`,
    })

  // 5. ROAS decline
  if (p7Roas > 0 && l7Roas < p7Roas * 0.85)
    priorities.push({
      level: 'HIGH',
      action: `Investigate ROAS decline — down ${((1 - l7Roas / p7Roas) * 100).toFixed(0)}% week-on-week`,
      reason: `Last 7d ROAS ${l7Roas.toFixed(2)}x vs prior 7d ${p7Roas.toFixed(2)}x. Causes to investigate: creative fatigue, budget shifts to weaker campaigns, audience saturation, or seasonal drop in purchase intent. Don't wait — act before the gap widens.`,
    })
  else if (p7Roas > 0 && l7Roas < p7Roas * 0.90)
    priorities.push({
      level: 'MED',
      action: `ROAS softening — monitor closely and prepare to act`,
      reason: `Last 7d ${l7Roas.toFixed(2)}x vs prior 7d ${p7Roas.toFixed(2)}x (${((1 - l7Roas / p7Roas) * 100).toFixed(0)}% decline). Not yet critical but a second consecutive week of decline warrants a creative and audience review now.`,
    })

  // 6. Scale opportunities
  const scaleTop = [...cs.scale].sort((a, b) => b.roas - a.roas).slice(0, 3)
  if (scaleTop.length) {
    const detail = scaleTop.map(a =>
      `${adShortName(a.ad_name)}: ${a.roas.toFixed(2)}x ROAS, ${a.trendDirection.toLowerCase()}${a.p_roas_percentile !== null ? ` (${pctLabel(a.p_roas_percentile)})` : ''}`
    ).join(' · ')
    priorities.push({
      level: 'MED',
      action: `Scale budget on ${scaleTop.length} top-ranked ad${scaleTop.length > 1 ? 's' : ''}`,
      reason: detail + `. These ads are outperforming and still have room to scale before fatigue. Increase daily budgets or duplicate into broader audiences while momentum holds.`,
    })
  }

  // 7. CPM rising
  if (p7Cpm > 0 && l7Cpm > p7Cpm * 1.20)
    priorities.push({
      level: 'MED',
      action: `Review audience targeting — CPM up ${(((l7Cpm / p7Cpm) - 1) * 100).toFixed(0)}% vs prior 7d`,
      reason: `Rising CPM compresses margin even when ROAS holds steady. Consider broadening audiences to reduce competition, testing lookalikes at higher similarity thresholds, or shifting budget to campaigns with lower CPM.`,
    })

  // 8. CTR declining
  if (p7Ctr > 0 && l7Ctr < p7Ctr * 0.85)
    priorities.push({
      level: 'MED',
      action: `Test new ad creatives — CTR down ${((1 - l7Ctr / p7Ctr) * 100).toFixed(0)}% week-on-week`,
      reason: `Declining click-through rate signals that current ads are losing relevance in the feed. Lower CTR increases effective CPM and reduces Meta's delivery priority. Prioritise new hooks, different formats, or fresh angles.`,
    })

  // 9. ROAS volatility
  if (rCV > 0.50)
    priorities.push({
      level: 'MED',
      action: `Stabilise delivery — ROAS swinging ${(rCV * 100).toFixed(0)}% day-to-day`,
      reason: `High ROAS variance (coefficient of variation ${(rCV * 100).toFixed(0)}%) suggests inconsistent delivery. Common causes: budget exhausting mid-day, algo still in learning phase, or conversion tracking firing inconsistently. Check delivery insights and event quality.`,
    })

  // 10. Creative refresh
  if (cs.refresh.length) {
    const names = cs.refresh.slice(0, 3).map(a => adShortName(a.ad_name)).join(', ')
    const extra = cs.refresh.length > 3 ? ` +${cs.refresh.length - 3} more` : ''
    priorities.push({
      level: 'MED',
      action: `Queue creative refresh for ${cs.refresh.length} ad${cs.refresh.length > 1 ? 's' : ''} showing fatigue`,
      reason: `${names}${extra} — fatigue scores rising but still within tolerable range. Refresh now before they hit kill threshold. Swapping creative keeps the adset warm and avoids a learning reset.`,
    })
  }

  // 11. Campaigns: defund / restructure
  const defundCamps = campaignData.filter(c => ['Defund', 'Restructure'].includes(c.campaign_health))
    .sort((a, b) => b.l7.spend - a.l7.spend).slice(0, 3)
  if (defundCamps.length) {
    const detail = defundCamps.map(c =>
      `${c.name.slice(0, 40)}: ${c.campaign_health.toLowerCase()}, L7 ROAS ${c.l7.roas.toFixed(2)}x, ${c.spendSharePct.toFixed(0)}% of spend`
    ).join(' · ')
    priorities.push({
      level: 'HIGH',
      action: `${defundCamps.length} campaign${defundCamps.length > 1 ? 's' : ''} flagged for defund or restructure`,
      reason: detail + `. Spend share is out of proportion to incremental contribution. Shift budget to healthier campaigns or rebuild the ad set mix.`,
    })
  }

  // 12. Campaigns: attribution investigation
  const attrCamps = campaignData.filter(c => c.campaign_health === 'Investigate attribution')
    .sort((a, b) => b.l7.spend - a.l7.spend).slice(0, 2)
  if (attrCamps.length) {
    const detail = attrCamps.map(c =>
      `${c.name.slice(0, 40)}: platform ROAS ${c.l7.roas.toFixed(2)}x vs i-ROAS ${c.l7.iRoas > 0 ? c.l7.iRoas.toFixed(2) : '?'}x`
    ).join(' · ')
    priorities.push({
      level: 'HIGH',
      action: `Audit attribution on ${attrCamps.length} campaign${attrCamps.length > 1 ? 's' : ''} — platform numbers don't match incrementality`,
      reason: detail + `. High platform ROAS with low incremental ROAS suggests over-attribution. Check view-through windows, retargeting overlap, and whether the campaign is taking credit for organic conversions.`,
    })
  }

  // 13. Campaigns: scale / volume opportunity
  const scaleCamps = campaignData.filter(c => ['Scale', 'Volume opportunity'].includes(c.campaign_health))
    .sort((a, b) => b.l7.roas - a.l7.roas).slice(0, 3)
  if (scaleCamps.length) {
    const detail = scaleCamps.map(c =>
      `${c.name.slice(0, 40)}: ${c.l7.roas.toFixed(2)}x ROAS, ${c.campaign_health.toLowerCase()}`
    ).join(' · ')
    priorities.push({
      level: 'MED',
      action: `Scale or unlock volume on ${scaleCamps.length} strong campaign${scaleCamps.length > 1 ? 's' : ''}`,
      reason: detail + `. These campaigns are generating strong returns relative to their peers. Increase budgets, broaden audiences, or test new ad sets to capture more volume while efficiency holds.`,
    })
  }

  // 14. Ad sets: kill / restructure
  const killAdsets = adsetData.filter(a => ['Kill', 'Restructure'].includes(a.adset_health))
    .sort((a, b) => b.l7.spend - a.l7.spend).slice(0, 4)
  if (killAdsets.length) {
    const detail = killAdsets.map(a =>
      `${a.name.slice(0, 35)}: ${a.adset_health.toLowerCase()}, L7 ROAS ${a.l7.roas.toFixed(2)}x, freq ${a.l7.frequency.toFixed(1)}`
    ).join(' · ')
    priorities.push({
      level: 'HIGH',
      action: `${killAdsets.length} ad set${killAdsets.length > 1 ? 's' : ''} should be paused or rebuilt`,
      reason: detail + `. Poor ROAS ranking combined with high frequency or saturation signals — continuing to spend here dilutes account efficiency.`,
    })
  }

  // 15. Ad sets: refresh audience / cap too tight
  const refreshAdsets = adsetData.filter(a => a.adset_health === 'Refresh audience')
    .sort((a, b) => b.l7.spend - a.l7.spend).slice(0, 3)
  if (refreshAdsets.length) {
    const detail = refreshAdsets.map(a =>
      `${a.name.slice(0, 35)}: freq ${a.l7.frequency.toFixed(1)}, saturation ${a.saturationScore}`
    ).join(' · ')
    priorities.push({
      level: 'MED',
      action: `Refresh audience targeting on ${refreshAdsets.length} ad set${refreshAdsets.length > 1 ? 's' : ''}`,
      reason: detail + `. Reach is shrinking and CPM is rising — these ad sets have exhausted their current targeting pool. Expand lookalikes, add interest layers, or test new demographic segments.`,
    })
  }

  const capAdsets = adsetData.filter(a => a.adset_health === 'Cap too tight')
    .sort((a, b) => b.l7.roas - a.l7.roas).slice(0, 2)
  if (capAdsets.length) {
    const detail = capAdsets.map(a =>
      `${a.name.slice(0, 35)}: ${a.l7.roas.toFixed(2)}x ROAS, CPA ${AU$2(a.l7.cpa)}`
    ).join(' · ')
    priorities.push({
      level: 'MED',
      action: `Lift budget caps on ${capAdsets.length} high-performing ad set${capAdsets.length > 1 ? 's' : ''}`,
      reason: detail + `. Strong ROAS and efficient CPA but spend is being throttled. Raise daily budget or bid ceiling to let the algorithm deliver more volume while conditions are favourable.`,
    })
  }

  // 16. Ad sets: scale
  const scaleAdsets = adsetData.filter(a => a.adset_health === 'Scale')
    .sort((a, b) => b.l7.roas - a.l7.roas).slice(0, 3)
  if (scaleAdsets.length) {
    const detail = scaleAdsets.map(a =>
      `${a.name.slice(0, 35)}: ${a.l7.roas.toFixed(2)}x ROAS, ${a.trendDirection.toLowerCase()}`
    ).join(' · ')
    priorities.push({
      level: 'MED',
      action: `Scale budget on ${scaleAdsets.length} top-ranked ad set${scaleAdsets.length > 1 ? 's' : ''}`,
      reason: detail + `. Top-quartile ROAS, healthy frequency, positive trend. These ad sets are the account's current growth engine — incrementally increase budgets every 2–3 days to avoid triggering a new learning phase.`,
    })
  }

  // 17. Spend concentration
  if (imbalanced)
    priorities.push({
      level: 'LOW',
      action: `Redistribute budget — top campaign holds ${topConc.toFixed(0)}% of MTD spend`,
      reason: `High concentration creates a single point of failure. If that campaign gets a disapproval, audience saturation hit, or budget cap, the whole account delivery drops. Gradually shift 10–20% of budget into secondary campaigns.`,
    })

  // 18. Ads to watch
  const watchTop = cs.monitor.slice(0, 3)
  if (watchTop.length)
    priorities.push({
      level: 'LOW',
      action: `Monitor ${watchTop.length} ad${watchTop.length > 1 ? 's' : ''} trending towards underperformance`,
      reason: `${watchTop.map(a => adShortName(a.ad_name)).join(', ')} — metrics softening but not yet at kill threshold. Check again tomorrow; if trend continues, move to refresh or pause.`,
    })

  priorities.sort((a, b) => ({ HIGH: 0, MED: 1, LOW: 2 }[a.level] - ({ HIGH: 0, MED: 1, LOW: 2 }[b.level])))

  // ── Pulse tile colors ─────────────────────────────────────────────────────
  const paceColor    = pacingRatio > 1.15 ? '#dc2626' : pacingRatio < 0.80 ? '#d97706' : '#16a34a'
  const roasGapColor = mtdM.roasGap == null || mtdM.roasGap <= 0 ? '#A3A3A3'
                     : mtdM.roasGap < 25 ? '#16a34a' : mtdM.roasGap < 60 ? '#d97706' : '#dc2626'
  const hsColor      = healthScore >= 70 ? '#16a34a' : healthScore >= 45 ? '#d97706' : '#dc2626'

  const rangeLabel = useMemo(() => {
    if (!dateRange?.start || !dateRange?.end) return '14-day'
    const fmt = s => s.slice(5).replace('-', '/')
    return `${fmt(dateRange.start)} – ${fmt(dateRange.end)}`
  }, [dateRange])

  const l14Dates       = l14Daily.map(d => d.date)
  const roasSparkline  = l14Daily.map(d => d.roas)
  const ctrSparkline   = l14Daily.map(d => d.ctr)
  const cpmSparkline   = l14Daily.map(d => d.cpm)
  const freqSparkline  = l14Daily.map(d => d.frequency)
  const cpaSparkline   = l14Daily.map(d => d.cac)
  const spendSparkline = l14Daily.map(d => d.spend)
  const iRoasSparkline = l14Daily.map(d => d.iRoas)

  if (!rows.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ fontSize: 13, color: '#A3A3A3' }}>No data available.</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1A1A1A', letterSpacing: '-0.02em', margin: 0 }}>
            Morning Snapshot
          </h2>
          <p style={{ fontSize: 13, color: '#A3A3A3', marginTop: 4 }}>{today}</p>
        </div>
        <div style={{ padding: '7px 12px', borderRadius: 8, background: '#FAFAF9', border: '1px solid #EFEFEC', fontSize: 12, color: '#A3A3A3', lineHeight: 1.5, flexShrink: 0 }}>
          Numbers use attributed (platform-reported) data. Incrementality shown where available.
        </div>
      </div>

      {/* Action items */}
      {priorities.length > 0 && (
        <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
              Today's action items
            </p>
            <span style={{ fontSize: 11, color: '#A3A3A3' }}>{priorities.length} item{priorities.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {priorities.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 8, border: '1px solid #EFEFEC', background: '#FAFAF9' }}>
                <div style={{ paddingTop: 1, flexShrink: 0 }}>
                  <PriorityBadge level={p.level} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', lineHeight: 1.4 }}>{p.action}</span>
                  <span style={{ fontSize: 12, color: '#737373', lineHeight: 1.55 }}>{p.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account Pulse */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {[
          { label: 'Yesterday Spend',  value: AU$(yAgg.spend),            sub: `${yM.roas.toFixed(2)}x ROAS`,               color: '#1A1A1A'    },
          { label: 'MTD Pacing',       value: `${pacingPct}%`,            sub: `${AU$(mtdAgg.spend)} of ${AU$(idealSpend)}`, color: paceColor    },
          { label: 'MTD ROAS',         value: `${mtdM.roas.toFixed(2)}x`, sub: p7Roas > 0 ? `${l7Roas > p7Roas ? '+' : ''}${(((l7Roas - p7Roas) / p7Roas) * 100).toFixed(1)}% vs prior 7d` : 'Blended MTD', color: '#1A1A1A' },
          { label: 'ROAS Gap %',       value: mtdM.iRoas > 0 ? `${mtdM.roasGap.toFixed(0)}%` : '—', sub: mtdM.iRoas > 0 ? `i-ROAS ${mtdM.iRoas.toFixed(2)}x` : 'No incremental data', color: roasGapColor },
          { label: 'MTD Purchases',    value: mtdAgg.purchases.toLocaleString(), sub: `${AU$(mtdAgg.revenue)} revenue`,      color: '#1A1A1A'    },
        ].map(tile => (
          <div key={tile.label} className="card" style={{ padding: '16px 16px' }}>
            <p style={{ fontSize: 10, color: '#A3A3A3', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
              {tile.label}
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, color: tile.color, margin: 0, letterSpacing: '-0.02em' }}>
              {tile.value}
            </p>
            <p style={{ fontSize: 11, color: '#A3A3A3', margin: '4px 0 0' }}>{tile.sub}</p>
          </div>
        ))}
      </div>

      {/* Two-column body */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16, alignItems: 'start' }}>

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Pacing Chart */}
          <div className="card" style={{ padding: 20 }}>
            <SectionHeader
              title="MTD Spend Pacing"
              subtitle={`${AU$(mtdAgg.spend)} spent · ${AU$(Math.max(0, tgtSpend - mtdAgg.spend))} remaining of ${AU$(tgtSpend)} monthly budget`}
            />
            <PacingChart mtdRows={mtdRows} budget={tgtSpend} />
            <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="#1E3A8A" strokeWidth="2" /></svg>
                <span style={{ fontSize: 11, color: '#737373' }}>Actual</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="#D4D4D4" strokeWidth="1.5" strokeDasharray="4 2" /></svg>
                <span style={{ fontSize: 11, color: '#737373' }}>Ideal pace</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* M1: Account Structure */}
          <div className="card" style={{ padding: 20 }}>
            <SectionHeader title="Account Structure" subtitle="Active counts and spend concentration (MTD)" />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Campaigns', value: campaigns.length },
                { label: 'Ad Sets',   value: adsets.length   },
                { label: 'Ads',       value: mtdAds.length   },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center', padding: '10px 8px', background: '#FAFAF9', borderRadius: 8, border: '1px solid #EFEFEC' }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{item.value}</p>
                  <p style={{ fontSize: 11, color: '#A3A3A3', margin: '3px 0 0' }}>{item.label}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#737373' }}>Spend concentration</span>
              {imbalanced && <span style={{ fontSize: 11, color: '#d97706', fontWeight: 500 }}>⚠ Concentrated</span>}
            </div>
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
              {topCamps.map((c, i) => (
                <div key={i}
                  title={`${c.label}: ${mtdAgg.spend > 0 ? ((c.spend / mtdAgg.spend) * 100).toFixed(1) : 0}%`}
                  style={{ width: `${mtdAgg.spend > 0 ? (c.spend / mtdAgg.spend) * 100 : 0}%`, background: campColors[i], flexShrink: 0 }}
                />
              ))}
              <div style={{ flex: 1, background: '#F0F0EE' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
              {topCamps.slice(0, 3).map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: campColors[i], flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#737373' }}>
                    {c.label.split(' | ').slice(2, 4).join(' · ').slice(0, 28) || c.label.slice(0, 28)}{' '}
                    <strong style={{ color: '#1A1A1A' }}>{mtdAgg.spend > 0 ? ((c.spend / mtdAgg.spend) * 100).toFixed(0) : 0}%</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* M2: Creative Status — full width */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <SectionHeader title="Creative Status" subtitle="MTD ad classification by performance" />
          <button
            onClick={() => setShowCreativeModal(true)}
            style={{ flexShrink: 0, marginTop: 2, padding: '5px 12px', borderRadius: 6, border: '1px solid #EFEFEC', background: '#FAFAF9', fontSize: 12, color: '#1A1A1A', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
          >
            View ads
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Scale',   count: cs.scale.length,   color: '#15803D', bg: 'rgba(22,163,74,0.07)',   pct: cs.scalePct   },
            { label: 'Monitor', count: cs.monitor.length, color: '#92400E', bg: 'rgba(245,158,11,0.07)',  pct: cs.monitorPct },
            { label: 'Refresh', count: cs.refresh.length, color: '#C2410C', bg: 'rgba(217,119,6,0.07)',   pct: cs.refreshPct },
            { label: 'Kill',    count: cs.kill.length,    color: '#B91C1C', bg: 'rgba(220,38,38,0.07)',   pct: cs.killPct    },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 8, background: s.bg }}>
              <p style={{ fontSize: 24, fontWeight: 700, color: s.color, margin: 0 }}>{s.count}</p>
              <p style={{ fontSize: 11, color: s.color, margin: '3px 0 0', fontWeight: 500 }}>{s.label}</p>
              <p style={{ fontSize: 11, color: s.color, margin: '2px 0 0', opacity: 0.75 }}>{s.pct.toFixed(0)}% of spend</p>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: '#737373', margin: '0 0 6px' }}>Spend distribution</p>
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
          <div style={{ width: `${cs.scalePct}%`,   background: '#15803D', flexShrink: 0 }} />
          <div style={{ width: `${cs.monitorPct}%`, background: '#92400E', flexShrink: 0 }} />
          <div style={{ width: `${cs.refreshPct}%`, background: '#C2410C', flexShrink: 0 }} />
          <div style={{ width: `${cs.killPct}%`,    background: '#B91C1C', flexShrink: 0 }} />
          <div style={{ flex: 1, background: '#F0F0EE' }} />
        </div>

        {cs.tooNew.length > 0 && (
          <p style={{ fontSize: 11, color: '#A3A3A3', margin: '10px 0 0' }}>
            + {cs.tooNew.length} ad{cs.tooNew.length !== 1 ? 's' : ''} too new to classify (under A$20 spend)
          </p>
        )}
      </div>

      {showCreativeModal  && <CreativeModal cs={cs} onClose={() => setShowCreativeModal(false)} />}
      {expandedMetric     && <ExpandedMetricChart metric={expandedMetric} dates={l14Dates} onClose={() => setExpandedMetric(null)} periodLabel={rangeLabel} />}

      {/* M3: Optimisation Signals */}
      <div className="card" style={{ padding: 20 }}>
        <SectionHeader title="Optimisation Signals" subtitle={`${rangeLabel} trend analysis`} />

        {/* Signal alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {signals.length === 0 ? (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.2)' }}>
              <p style={{ fontSize: 12, color: '#16a34a', margin: 0, fontWeight: 500 }}>All clear — no significant signals detected</p>
              <p style={{ fontSize: 11, color: '#737373', margin: '3px 0 0' }}>ROAS, CTR, CPM, frequency and CPA are all within normal range for this period.</p>
            </div>
          ) : signals.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, background: '#FAFAF9', border: '1px solid #EFEFEC' }}>
              <PriorityBadge level={s.level} />
              <p style={{ fontSize: 12, color: '#737373', margin: 0, lineHeight: 1.5 }}>{s.msg}</p>
            </div>
          ))}
        </div>

        {/* Metric trends grid */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>{rangeLabel} trends</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
              {[
                { label: 'ROAS',        values: roasSparkline,  color: '#1E3A8A', fmt: v => v.toFixed(2) + 'x',  higherBetter: true,  periodValue: rangeM.roas },
                { label: 'CTR',         values: ctrSparkline,   color: '#0ea5e9', fmt: v => v.toFixed(2) + '%',  higherBetter: true,  periodValue: rangeM.ctr },
                { label: 'CPM',         values: cpmSparkline,   color: '#7c3aed', fmt: v => 'A$' + v.toFixed(2), higherBetter: false, periodValue: rangeM.cpm },
                { label: 'Frequency',   values: freqSparkline,  color: '#d97706', fmt: v => v.toFixed(2) + 'x',  higherBetter: false, periodValue: rangeM.frequency },
                { label: 'CPA',         values: cpaSparkline,   color: '#dc2626', fmt: v => v > 0 ? 'A$' + v.toFixed(2) : '—', higherBetter: false, periodValue: rangeM.cac },
                { label: 'Avg Daily Spend', values: spendSparkline, color: '#16a34a', fmt: v => 'A$' + Math.round(v).toLocaleString('en-AU'), higherBetter: null, periodValue: rangeM.spend / rangeDays },
                ...(iRoasSparkline.some(v => v > 0) ? [
                  { label: 'i-ROAS', values: iRoasSparkline, color: '#0891b2', fmt: v => v > 0 ? v.toFixed(2) + 'x' : '—', higherBetter: true, periodValue: rangeM.iRoas },
                ] : []),
              ].map(s => {
                const displayVal = s.periodValue ?? 0
                const n = s.values.length
                const l7vals = s.values.slice(-Math.min(7, n)).filter(v => v > 0)
                const p7vals = s.values.slice(-Math.min(14, n), -Math.min(7, n)).filter(v => v > 0)
                const l7avg  = l7vals.length ? l7vals.reduce((a, v) => a + v, 0) / l7vals.length : 0
                const p7avg  = p7vals.length ? p7vals.reduce((a, v) => a + v, 0) / p7vals.length : 0
                const trend  = p7avg > 0 && l7avg > 0 ? ((l7avg / p7avg) - 1) * 100 : 0
                const hasTrend   = p7avg > 0 && l7avg > 0
                const trendGood  = s.higherBetter === null ? null : s.higherBetter ? trend >= 0 : trend <= 0
                const trendColor = trendGood === null ? '#A3A3A3' : trendGood ? '#16a34a' : '#dc2626'
                return (
                  <div key={s.label}
                    onClick={() => setExpandedMetric(s)}
                    style={{ padding: '10px 12px', borderRadius: 8, background: '#FAFAF9', border: '1px solid #EFEFEC', cursor: 'pointer', transition: 'border-color 150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#D4D4D4'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#EFEFEC'}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <p style={{ fontSize: 10, color: '#A3A3A3', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                        <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{s.fmt(displayVal)}</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        {hasTrend && (
                          <>
                            <span style={{ fontSize: 10, fontWeight: 600, color: trendColor }}>
                              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
                            </span>
                            <span style={{ fontSize: 9, color: '#A3A3A3', letterSpacing: '0.03em' }}>L7 vs P7</span>
                          </>
                        )}
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ opacity: 0.3, marginTop: hasTrend ? 2 : 0 }}>
                          <path d="M1 10L10 1M10 1H5M10 1V6" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                    <Sparkline values={s.values} color={s.color} />
                  </div>
                )
              })}
            </div>
          </div>
      </div>

    </div>
  )
}
