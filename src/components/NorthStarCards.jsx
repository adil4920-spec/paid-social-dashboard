import React, { useState, useEffect } from 'react'
import { Line } from 'react-chartjs-2'
import { getStatus } from '../utils/metrics'
import { fmtValue } from '../utils/currency'

const STATUS_COLOR = {
  green:   '#16A34A',
  amber:   '#92400e',
  red:     '#DC2626',
  neutral: '#1A1A1A',
}

const STATUS_BADGE = {
  green:   { label: 'On Track',  cls: 'badge-green' },
  amber:   { label: 'Near',      cls: 'badge-amber' },
  red:     { label: 'Off Track', cls: 'badge-red'   },
  neutral: { label: '',          cls: ''             },
}

const DEFS = [
  { key: 'revenue',      label: 'Revenue',       format: 'currency', higherIsBetter: true,  dailyKey: 'revenue',      targetKey: 'revenue', statusKey: 'revenue' },
  { key: 'mer',          label: 'MER',            format: 'percent',  higherIsBetter: false, dailyKey: 'mer',          targetKey: 'cos',     statusKey: 'cos'     },
  { key: 'newCustomers', label: 'New Customers',  format: 'integer',  higherIsBetter: true,  dailyKey: 'newCustomers', targetKey: null,      statusKey: null      },
  { key: 'ncac',         label: 'NCAC',           format: 'currency', higherIsBetter: false, dailyKey: 'ncac',         targetKey: 'ncac',    statusKey: 'ncac'    },
]

// ── SVG sparkline ──────────────────────────────────────────────────────────
function Sparkline({ data, color, id }) {
  const vals = (data || []).filter(v => v != null && !isNaN(v))
  if (vals.length < 2) return <div style={{ height: 44 }} />
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const W = 200, H = 44, P = 2
  const pts = vals.map((v, i) => [
    P + (i / (vals.length - 1)) * (W - 2 * P),
    P + (1 - (v - min) / range) * (H - 2 * P),
  ])
  const line  = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const fill  = line + ` L${pts[pts.length-1][0].toFixed(1)},${H} L${P},${H} Z`
  const gid   = `sg-${id}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 44 }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Full-chart modal ───────────────────────────────────────────────────────
function Modal({ def, daily, color, onClose }) {
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  const labels = daily.map(d =>
    new Date(d.date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  )

  const chartData = {
    labels,
    datasets: [{
      data: daily.map(d => d[def.dailyKey] ?? null),
      borderColor: color,
      backgroundColor: color + '18',
      fill: true,
      tension: 0.35,
      pointRadius: 2,
      pointHoverRadius: 5,
      borderWidth: 2,
      pointBorderColor: color,
      pointBackgroundColor: '#ffffff',
      spanGaps: true,
    }],
  }

  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => '  ' + fmtValue(ctx.parsed.y, def.format, 'AU'),
        },
      },
    },
    scales: {
      x: {
        grid: { color: '#f3f4f6', drawBorder: false },
        border: { display: false },
        ticks: { font: { size: 11, family: 'Inter' }, color: '#9ca3af', maxTicksLimit: 10, maxRotation: 0 },
      },
      y: {
        grid: { color: '#f3f4f6', drawBorder: false },
        border: { display: false },
        ticks: {
          font: { size: 11, family: 'Inter' },
          color: '#9ca3af',
          callback: (v) => {
            if (def.format === 'currency') return v >= 1000 ? 'A$' + (v / 1000).toFixed(1) + 'k' : 'A$' + v.toFixed(0)
            if (def.format === 'percent')  return v.toFixed(1) + '%'
            return Math.round(v).toLocaleString()
          },
        },
      },
    },
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl p-6"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <p className="text-base font-semibold text-[#111827]">{def.label} — Daily Trend</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#6b7280] hover:bg-[#f3f4f6] transition-colors text-sm"
          >
            ✕
          </button>
        </div>
        <div style={{ height: 300 }}>
          <Line data={chartData} options={opts} />
        </div>
      </div>
    </div>
  )
}

// ── NorthStarCards ─────────────────────────────────────────────────────────
export default function NorthStarCards({ metrics, targets, daily, pacerData, anzPeriod }) {
  const [open, setOpen] = useState(null)

  // ANZ period rows passed from OverviewTab (already period-filtered, today excluded)
  const anzFiltered = anzPeriod ?? []

  // Check if real new customer data is available from the Pacer sheet
  const hasRealNC = anzFiltered.some(d => d.newCustomers != null && d.newCustomers > 0)

  // newCustomers = sum of daily new customer orders from Pacer ANZ
  // ncac = total spend / total new customers for the period
  const anzNewCustomers = hasRealNC
    ? anzFiltered.reduce((s, d) => s + (d.newCustomers ?? 0), 0)
    : null
  const anzNcac = (() => {
    const totalSpend = anzFiltered.reduce((s, d) => s + (d.spend ?? 0), 0)
    const totalNC    = anzFiltered.reduce((s, d) => s + (d.newCustomers ?? 0), 0)
    return hasRealNC && totalNC > 0 ? totalSpend / totalNC : null
  })()

  function val(def) {
    if (def.key === 'newCustomers') return anzNewCustomers ?? (metrics.iPurchases ?? 0)
    if (def.key === 'ncac')         return anzNcac ?? (metrics.ncac ?? 0)
    // mer is already computed as period-accurate anzMer in OverviewTab and passed via metrics
    return metrics[def.key] ?? 0
  }

  function tgt(def) {
    return def.targetKey ? (targets[def.targetKey] ?? 0) : 0
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        {DEFS.map(def => {
          const actual  = val(def)
          const target  = tgt(def)
          const status  = def.statusKey ? getStatus(def.statusKey, actual, target, def.higherIsBetter) : 'neutral'
          const badge   = STATUS_BADGE[status]
          const color   = STATUS_COLOR[status]

          const diff = target > 0
            ? (def.higherIsBetter ? ((actual - target) / target) * 100 : ((target - actual) / target) * 100)
            : null
          const varColor = status === 'green' ? '#22c55e' : status === 'amber' ? '#f59e0b' : '#ef4444'

          // Show Demo badge only when falling back to Meta incremental data (no Pacer NC data)
          const isDemo    = (def.key === 'newCustomers' || def.key === 'ncac') && !hasRealNC
          // Revenue, MER, New Customers, NCAC all come from Pacer ANZ daily
          const useAnz    = def.key === 'mer' || def.key === 'revenue' || def.key === 'newCustomers' || def.key === 'ncac'
          const sparkData = useAnz
            ? anzFiltered.map(d => d[def.dailyKey])
            : daily.map(d => d[def.dailyKey])

          return (
            <div
              key={def.key}
              className="card"
              style={{ display: 'flex', flexDirection: 'column', minHeight: 160, cursor: 'pointer' }}
              onClick={() => setOpen(def.key)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="metric-label">{def.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isDemo && (
                    <span style={{ fontSize: 10, fontWeight: 500, color: '#A3A3A3' }}>Demo</span>
                  )}
                  {badge.label && <span className={badge.cls}>{badge.label}</span>}
                </div>
              </div>

              <p style={{ fontSize: 28, fontWeight: 600, color: '#1A1A1A', lineHeight: 1, marginBottom: 6, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                {fmtValue(actual, def.format, 'AU')}
              </p>

              {diff != null && (
                <p style={{ fontSize: 12, color: '#A3A3A3', marginBottom: 12 }}>
                  vs {fmtValue(target, def.format, 'AU')} target
                  {' '}
                  <span style={{ color: status === 'green' ? '#16A34A' : status === 'red' ? '#DC2626' : '#A3A3A3', fontWeight: 500 }}>
                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                  </span>
                </p>
              )}

              <div style={{ marginTop: 'auto' }}>
                <Sparkline data={sparkData} color={color} id={def.key} />
              </div>
            </div>
          )
        })}
      </div>

      {open && (() => {
        const def      = DEFS.find(d => d.key === open)
        const actual   = val(def)
        const target   = tgt(def)
        const status   = def.statusKey ? getStatus(def.statusKey, actual, target, def.higherIsBetter) : 'neutral'
        const color    = STATUS_COLOR[status]
        const useAnz2    = def.key === 'mer' || def.key === 'revenue' || def.key === 'newCustomers' || def.key === 'ncac'
        const modalDaily = useAnz2
          ? anzFiltered.map(d => ({ date: d.date, [def.dailyKey]: d[def.dailyKey] }))
          : daily
        return <Modal def={def} daily={modalDaily} color={color} onClose={() => setOpen(null)} />
      })()}
    </>
  )
}
