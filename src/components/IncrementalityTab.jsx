import React, { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import { groupByCampaign, groupByAdset, aggregateRows, computeMetrics } from '../utils/metrics'
import { fmtValue } from '../utils/currency'

const FLAG_STYLE = {
  REVIEW: 'bg-red-50 text-red-700 border border-red-200',
  OK:     'bg-green-50 text-green-700 border border-green-200',
}

const FUNNEL_PILL = {
  TOFU: 'bg-indigo-50 text-indigo-700',
  MOFU: 'bg-orange-50 text-orange-700',
}

function GapBadge({ pct }) {
  const n = parseFloat(pct) || 0
  const color = n > 30 ? '#d14a47' : n > 15 ? '#e8a02d' : '#0f9d73'
  return <span style={{ color, fontWeight: 600 }}>{n.toFixed(1)}%</span>
}

function iRoasBadgeClass(iRoas) {
  if (iRoas >= 2.5) return 'bg-green-100 text-green-800'
  if (iRoas >= 1.5) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-700'
}

function shortCampaignLabel(name) {
  const parts = name.split(' | ').map((p) => p.trim())
  if (parts.length >= 4) return `${parts[2]} · ${parts[3]}`
  return name
}

const chartOpts = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12, padding: 12, color: '#6b7280' } },
    tooltip: {
      callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.x.toFixed(2)}x` },
    },
  },
  scales: {
    x: {
      grid: { color: '#f3f4f6' },
      ticks: { font: { size: 11 }, color: '#9ca3af', callback: (v) => v + 'x' },
    },
    y: {
      grid: { color: 'transparent' },
      ticks: { font: { size: 11 }, color: '#9ca3af' },
      afterFit(scale) { scale.width = 200 },
    },
  },
}

export default function IncrementalityTab({ filteredRows }) {
  const overall   = useMemo(() => computeMetrics(aggregateRows(filteredRows)), [filteredRows])
  const campaigns = useMemo(() => groupByCampaign(filteredRows), [filteredRows])
  const adsets    = useMemo(() => groupByAdset(filteredRows), [filteredRows])

  const funnelRows = useMemo(() => {
    const tofu = filteredRows.filter((r) => r.funnel_stage === 'TOFU')
    const mofu = filteredRows.filter((r) => r.funnel_stage === 'MOFU')
    return [
      { label: 'TOFU', ...computeMetrics(aggregateRows(tofu)) },
      { label: 'MOFU', ...computeMetrics(aggregateRows(mofu)) },
    ]
  }, [filteredRows])

  const chartData = {
    labels: campaigns.map((c) => shortCampaignLabel(c.campaign_name)),
    datasets: [
      { label: 'Platform ROAS',    data: campaigns.map((c) => +c.roas.toFixed(2)),  backgroundColor: '#7c6ef0', borderRadius: 3, barThickness: 16 },
      { label: 'Incremental ROAS', data: campaigns.map((c) => +c.iRoas.toFixed(2)), backgroundColor: '#ff7a59', borderRadius: 3, barThickness: 16 },
    ],
  }
  const chartH = Math.max(180, campaigns.length * 52)

  const totalAtc       = filteredRows.reduce((s, r) => s + (r.atc || 0), 0)
  const totalCheckouts = filteredRows.reduce((s, r) => s + (r.checkouts || 0), 0)
  const totalPurchases = filteredRows.reduce((s, r) => s + (r.purchases || 0), 0)
  const atcConv        = totalAtc       > 0 ? ((totalPurchases / totalAtc)       * 100).toFixed(1) : '—'
  const checkoutConv   = totalCheckouts > 0 ? ((totalPurchases / totalCheckouts) * 100).toFixed(1) : '—'

  return (
    <div className="space-y-4">

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-sm">
          <p className="metric-label mb-1">Platform ROAS</p>
          <p className="text-2xl font-semibold text-[#111827]">{overall.roas.toFixed(2)}x</p>
          <p className="text-xs mt-0.5 text-[#9ca3af]">Attributed</p>
        </div>
        <div className="card-sm">
          <p className="metric-label mb-1">Incremental ROAS</p>
          <p className={`text-2xl font-semibold rounded px-1 -ml-1 inline-block ${iRoasBadgeClass(overall.iRoas)}`}>
            {overall.iRoas.toFixed(2)}x
          </p>
          <p className="text-xs mt-0.5 text-[#9ca3af]">True value</p>
        </div>
        <div className="card-sm">
          <p className="metric-label mb-1">ROAS Gap</p>
          <p className="text-2xl font-semibold"><GapBadge pct={overall.roasGap} /></p>
          <p className="text-xs mt-0.5 text-[#9ca3af]">Platform over-reports by this %</p>
        </div>
        <div className="card-sm">
          <p className="metric-label mb-1">Incremental CPA</p>
          <p className="text-2xl font-semibold text-[#111827]">{fmtValue(overall.iCpa, 'currency', 'AU')}</p>
          <p className="text-xs mt-0.5 text-[#9ca3af]">True cost per purchase</p>
        </div>
      </div>

      {/* ── Purchase funnel ── */}
      <div className="card">
        <p className="text-sm font-semibold text-[#111827] mb-4">Purchase Funnel</p>
        <div className="flex items-center gap-0 divide-x divide-[#f3f4f6]">
          <FunnelStat label="Add to Cart"        value={totalAtc.toLocaleString()} />
          <FunnelConv rate={atcConv} />
          <FunnelStat label="Initiated Checkout" value={totalCheckouts.toLocaleString()} />
          <FunnelConv rate={checkoutConv} />
          <FunnelStat label="Purchases"          value={totalPurchases.toLocaleString()} />
        </div>
      </div>

      {/* ── TOFU vs MOFU ── */}
      <div className="grid grid-cols-2 gap-4">
        {funnelRows.map((f) => (
          <div key={f.label} className="card-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-[#111827]">{f.label}</p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${FUNNEL_PILL[f.label]}`}>
                {f.label === 'TOFU' ? 'Prospecting' : 'Remarketing'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs mb-0.5 text-[#9ca3af]">Platform</p>
                <p className="text-sm font-semibold text-[#111827]">{f.roas.toFixed(2)}x</p>
              </div>
              <div>
                <p className="text-xs mb-0.5 text-[#9ca3af]">Incremental</p>
                <p className={`text-sm font-semibold px-1.5 py-0.5 rounded ${iRoasBadgeClass(f.iRoas)}`}>{f.iRoas.toFixed(2)}x</p>
              </div>
              <div>
                <p className="text-xs mb-0.5 text-[#9ca3af]">Gap</p>
                <GapBadge pct={f.roasGap} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Campaign chart ── */}
      <div className="card">
        <p className="text-sm font-semibold text-[#111827] mb-4">Platform vs Incremental ROAS by Campaign</p>
        <div style={{ height: chartH }}>
          <Bar data={chartData} options={chartOpts} />
        </div>
      </div>

      {/* ── Ad set table ── */}
      <div className="card overflow-x-auto">
        <p className="text-sm font-semibold text-[#111827] mb-4">Ad Set Incrementality — ranked by iROAS</p>
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-100">
              {['Ad Set', 'Funnel', 'Spend', 'Plat. ROAS', 'iROAS', 'ROAS Gap', 'iRevenue', 'iPurchases', 'iCPA', 'Flag'].map((h) => (
                <th key={h} className="tbl-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...adsets].sort((a, b) => b.iRoas - a.iRoas).map((row) => (
              <tr key={row.adsetName} className="tbl-tr">
                <td className="tbl-td font-medium max-w-[180px] truncate text-[#111827]" title={row.adsetName}>{row.adsetName}</td>
                <td className="tbl-td">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${FUNNEL_PILL[row.funnel_stage] || FUNNEL_PILL.TOFU}`}>
                    {row.funnel_stage}
                  </span>
                </td>
                <td className="tbl-td">{fmtValue(row.spend, 'currency', 'AU')}</td>
                <td className="tbl-td">{row.roas.toFixed(2)}x</td>
                <td className="tbl-td">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${iRoasBadgeClass(row.iRoas)}`}>
                    {row.iRoas.toFixed(2)}x
                  </span>
                </td>
                <td className="tbl-td"><GapBadge pct={row.roasGap} /></td>
                <td className="tbl-td">{fmtValue(row.iRevenue, 'currency', 'AU')}</td>
                <td className="tbl-td">{(row.iPurchases || 0).toLocaleString()}</td>
                <td className="tbl-td">{row.iCpa > 0 ? fmtValue(row.iCpa, 'currency', 'AU') : '—'}</td>
                <td className="tbl-td">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border ${FLAG_STYLE[row.efficiencyFlag] || FLAG_STYLE.OK}`}>
                    {row.efficiencyFlag || 'OK'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}

function FunnelStat({ label, value }) {
  return (
    <div className="flex-1 text-center px-4 py-2">
      <p className="text-xl font-semibold text-[#111827]">{value}</p>
      <p className="text-xs mt-0.5 text-[#9ca3af]">{label}</p>
    </div>
  )
}

function FunnelConv({ rate }) {
  return (
    <div className="flex flex-col items-center justify-center px-3 py-2">
      <p className="text-xs font-semibold text-gray-500">{rate}%</p>
      <svg width="20" height="10" viewBox="0 0 20 10" fill="none" className="mt-0.5">
        <path d="M0 5h16M12 1l4 4-4 4" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}
