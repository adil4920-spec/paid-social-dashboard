import React from 'react'

// REGIONS order in CSV: ['US', 'AU', 'UK', 'ROW', 'GLOBAL']
// ANZ = AU = index 1

const ANZ_METRICS = [
  { key: 'revActual',     label: 'Revenue MTD',   fmt: '$'                                    },
  { key: 'revTarget',     label: 'Rev Target',    fmt: '$'                                    },
  { key: 'revVsTarget',   label: 'Rev vs Target', fmt: 'pct', signed: true, variance: 'rev'  },
  { key: 'spendActual',   label: 'Spend MTD',     fmt: '$'                                    },
  { key: 'spendBudget',   label: 'Budget',        fmt: '$'                                    },
  { key: 'spendVsBudget', label: 'Spend vs Budget', fmt: 'pct', signed: true, variance: 'spend' },
  { key: 'roas',          label: 'ROAS',          fmt: 'x'                                    },
  { key: 'mer',           label: 'MER %',         fmt: 'pct'                                  },
]

function fmtVal(n, format, signed = false) {
  if (n === null || n === undefined) return '—'
  const sign = signed && n > 0 ? '+' : ''
  if (format === 'pct') return sign + n.toFixed(1) + '%'
  if (format === 'x')   return n.toFixed(2) + 'x'
  if (format === '$')   return 'A$' + Math.round(Math.abs(n)).toLocaleString()
  return String(n)
}

function varianceColor(n, type) {
  if (n === null) return '#9ca3af'
  if (type === 'rev') {
    if (n >= 0)   return '#22c55e'
    if (n >= -10) return '#f59e0b'
    return '#ef4444'
  }
  // spend vs budget: over is bad
  if (n > 15)  return '#ef4444'
  if (n < -15) return '#f59e0b'
  return '#22c55e'
}

function SummaryCard({ label, value, sub, color }) {
  return (
    <div className="card-sm flex flex-col gap-1">
      <p className="metric-label">{label}</p>
      <p className="text-[22px] font-bold tracking-tight text-[#111827] leading-none"
         style={color ? { color } : {}}>
        {value}
      </p>
      {sub && <p className="helper-text">{sub}</p>}
    </div>
  )
}

export default function PacerTab({ pacerData }) {
  if (!pacerData) {
    return <div className="card text-center py-16 helper-text">Loading pacer data…</div>
  }
  if (!pacerData.metrics.revActual) {
    return <div className="card text-center py-16 helper-text">Pacer data unavailable.</div>
  }

  const { metrics, daysElapsed, daysInMonth } = pacerData
  const monthPct = daysElapsed && daysInMonth ? (daysElapsed / daysInMonth) * 100 : null

  // ANZ = AU = index 1 in [US, AU, UK, ROW, GLOBAL]
  const anz = (key) => metrics[key]?.[1] ?? null

  return (
    <div className="space-y-4">

      {/* ── Month progress bar ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="metric-label">April 2026 — Month Progress</span>
          {daysElapsed != null && (
            <span className="helper-text">Day {daysElapsed} of {daysInMonth} · {(100 - monthPct).toFixed(0)}% remaining</span>
          )}
        </div>
        {monthPct != null && (
          <div className="h-[5px] rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${monthPct}%`, background: '#5b4fe9' }} />
          </div>
        )}
      </div>

      {/* ── ANZ summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          label="ANZ Revenue MTD"
          value={fmtVal(anz('revActual'), '$')}
          sub={`vs ${fmtVal(anz('revTarget'), '$')} target`}
          color={varianceColor(anz('revVsTarget'), 'rev')}
        />
        <SummaryCard
          label="ANZ Rev vs Target"
          value={fmtVal(anz('revVsTarget'), 'pct', true)}
          sub="month-to-date"
          color={varianceColor(anz('revVsTarget'), 'rev')}
        />
        <SummaryCard
          label="ANZ Spend MTD"
          value={fmtVal(anz('spendActual'), '$')}
          sub={`of ${fmtVal(anz('spendBudget'), '$')} budget`}
        />
        <SummaryCard
          label="ANZ MER"
          value={fmtVal(anz('mer'), 'pct')}
          sub="target 18%"
          color={anz('mer') != null ? (anz('mer') <= 18 ? '#22c55e' : anz('mer') <= 22 ? '#f59e0b' : '#ef4444') : undefined}
        />
      </div>

      {/* ── ANZ metrics breakdown ── */}
      <div className="card">
        <p className="metric-label mb-4">ANZ — MTD Breakdown</p>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
              <th className="tbl-th">Metric</th>
              <th className="tbl-th text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {ANZ_METRICS.map((row) => {
              const val = anz(row.key)
              return (
                <tr key={row.key} className="tbl-tr">
                  <td className="tbl-td text-[#6b7280]">{row.label}</td>
                  <td className="tbl-td text-right font-semibold">
                    {row.variance ? (
                      <span style={{ color: varianceColor(val, row.variance), fontWeight: 600 }}>
                        {fmtVal(val, row.fmt, row.signed)}
                      </span>
                    ) : (
                      <span className="text-[#111827]">{fmtVal(val, row.fmt)}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}
