import React, { useState, useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import { groupByField, groupByAd } from '../utils/metrics'
import { fmtValue } from '../utils/currency'

const DIMENSIONS = [
  { key: 'pillar',       label: 'Pillar'        },
  { key: 'campType',     label: 'Campaign Type' },
  { key: 'range',        label: 'Range'         },
  { key: 'collection',   label: 'Collection'    },
  { key: 'print',        label: 'Print'         },
  { key: 'creativeType', label: 'Creative Type' },
  { key: 'format',       label: 'Format'        },
]

const CHART_COLORS = [
  '#5b4fe9','#ff7a59','#0f9d73','#e8a02d','#d14a47',
  '#7c6ef0','#ff9a7a','#34c998','#f0b84a','#e06b68',
]

function trafficLight(row) {
  const iRoasOk     = (row.iRoas         || 0) >= 2.5
  const thumbStopOk = (row.thumbStopRatio || 0) >= 0.25
  const hookOk      = (row.hookRate       || 0) >= 0.20
  const score = [iRoasOk, thumbStopOk, hookOk].filter(Boolean).length
  if (score === 3) return 'green'
  if (score >= 1) return 'amber'
  return 'red'
}

const TL_STYLE = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red:   'bg-red-100 text-red-700',
}

const TL_DOT = {
  green: 'bg-green-500',
  amber: 'bg-amber-400',
  red:   'bg-red-500',
}

function chartOpts(horizontal, suffix = '', isCurrency = false) {
  return {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed[horizontal ? 'x' : 'y']
            return ` ${isCurrency ? '$' + v.toLocaleString('en-AU', { maximumFractionDigits: 2 }) : v.toFixed(2) + suffix}`
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: horizontal ? '#f3f4f6' : 'transparent' },
        ticks: {
          font: { size: 11 }, color: '#9ca3af',
          callback: horizontal && isCurrency ? (v) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) : undefined,
        },
      },
      y: {
        grid: { color: horizontal ? 'transparent' : '#f3f4f6' },
        ticks: { font: { size: 11 }, color: '#9ca3af' },
      },
    },
  }
}

function engagementChartOpts() {
  return {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx) => ` ${(ctx.parsed.x * 100).toFixed(1)}%` },
      },
    },
    scales: {
      x: {
        grid: { color: '#f3f4f6' },
        ticks: { font: { size: 11 }, color: '#9ca3af', callback: (v) => (v * 100).toFixed(0) + '%' },
      },
      y: { grid: { color: 'transparent' }, ticks: { font: { size: 11 }, color: '#9ca3af' } },
    },
  }
}

export default function CreativeTab({ filteredRows }) {
  const [dim, setDim] = useState('pillar')

  const groups = useMemo(() => groupByField(filteredRows, dim), [filteredRows, dim])
  const adRows = useMemo(() => groupByAd(filteredRows).slice(0, 10), [filteredRows])

  const labels     = groups.map((g) => g.label)
  const colors     = groups.map((_, i) => CHART_COLORS[i % CHART_COLORS.length])
  const horizontal = dim !== 'creativeType'
  const chartH     = Math.max(220, groups.length * (horizontal ? 44 : 60))

  const spendData = {
    labels,
    datasets: [{ label: 'Spend', data: groups.map((g) => +g.spend.toFixed(2)), backgroundColor: colors, borderRadius: 4, barThickness: horizontal ? 22 : 36 }],
  }
  const roasData = {
    labels,
    datasets: [{ label: 'ROAS', data: groups.map((g) => +g.roas.toFixed(2)), backgroundColor: colors, borderRadius: 4, barThickness: horizontal ? 22 : 36 }],
  }

  const topRoas  = groups.length ? groups.reduce((a, b) => a.roas > b.roas ? a : b) : null
  const topSpend = groups.length ? groups[0] : null

  const thumbData = {
    labels,
    datasets: [{ label: 'Thumb Stop', data: groups.map((g) => +(g.thumbStopRatio || 0)), backgroundColor: '#5b4fe9', borderRadius: 4, barThickness: 22 }],
  }
  const hookData = {
    labels,
    datasets: [{ label: 'Hook Rate', data: groups.map((g) => +(g.hookRate || 0)), backgroundColor: '#ff7a59', borderRadius: 4, barThickness: 22 }],
  }

  const fatiguedAds = adRows.filter((r) => r.fatigueFlag === 'FATIGUED')
  const dimLabel    = DIMENSIONS.find((d) => d.key === dim)?.label

  return (
    <div className="space-y-4">
      {/* ── Dimension picker ── */}
      <div className="card py-3 px-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wider mr-1 text-gray-400">Break down by</span>
          {DIMENSIONS.map((d) => (
            <button key={d.key} onClick={() => setDim(d.key)} className={`pill ${dim === d.key ? 'pill-on' : 'pill-off'}`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Highlight cards ── */}
      {groups.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card-sm">
            <p className="metric-label mb-1">Top Spend</p>
            <p className="text-base font-semibold truncate text-[#111827]" title={topSpend?.label}>{topSpend?.label}</p>
            <p className="text-sm mt-0.5 text-gray-400">{fmtValue(topSpend?.spend, 'currency', 'AU')}</p>
          </div>
          <div className="card-sm">
            <p className="metric-label mb-1">Best ROAS</p>
            <p className="text-base font-semibold truncate text-[#111827]" title={topRoas?.label}>{topRoas?.label}</p>
            <p className="text-sm mt-0.5 text-gray-400">{fmtValue(topRoas?.roas, 'decimal')}</p>
          </div>
          <div className="card-sm">
            <p className="metric-label mb-1">Total Groups</p>
            <p className="text-2xl font-semibold text-gray-900">{groups.length}</p>
            <p className="text-xs mt-0.5 text-gray-400">{dimLabel} values</p>
          </div>
          <div className="card-sm">
            <p className="metric-label mb-1">Blended ROAS</p>
            <p className="text-2xl font-semibold text-gray-900">
              {groups.length
                ? (groups.reduce((s, g) => s + g.revenue, 0) / Math.max(groups.reduce((s, g) => s + g.spend, 0), 1)).toFixed(2)
                : '—'}x
            </p>
            <p className="text-xs mt-0.5 text-gray-400">Across all {dimLabel?.toLowerCase()}s</p>
          </div>
        </div>
      )}

      {/* ── Spend & ROAS charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <p className="text-sm font-semibold mb-4 text-[#111827]">Spend by {dimLabel}</p>
          <div style={{ height: chartH }}>
            <Bar data={spendData} options={chartOpts(horizontal, '', true)} />
          </div>
        </div>
        <div className="card">
          <p className="text-sm font-semibold mb-4 text-[#111827]">ROAS by {dimLabel}</p>
          <div style={{ height: chartH }}>
            <Bar data={roasData} options={chartOpts(horizontal, 'x')} />
          </div>
        </div>
      </div>

      {/* ── Engagement metrics ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <p className="text-sm font-semibold mb-1 text-[#111827]">Thumb Stop by {dimLabel}</p>
          <p className="text-xs text-gray-400 mb-4">% of impressions that stopped scrolling — benchmark ≥25%</p>
          <div style={{ height: chartH }}>
            <Bar data={thumbData} options={engagementChartOpts()} />
          </div>
        </div>
        <div className="card">
          <p className="text-sm font-semibold mb-1 text-[#111827]">Hook Rate by {dimLabel}</p>
          <p className="text-xs text-gray-400 mb-4">% of impressions that watched ≥3 s — benchmark ≥20%</p>
          <div style={{ height: chartH }}>
            <Bar data={hookData} options={engagementChartOpts()} />
          </div>
        </div>
      </div>

      {/* ── Creative Leaderboard ── */}
      <div className="card overflow-x-auto">
        <p className="text-sm font-semibold mb-1 text-[#111827]">Creative Intelligence Leaderboard</p>
        <p className="text-xs text-gray-400 mb-4">Ads ranked by spend · traffic light = iRoas + thumb stop + hook rate</p>
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#f3f4f6]">
              {['', 'Ad', 'Pillar', 'Format', 'Spend', 'ROAS', 'iROAS', 'Thumb Stop', 'Hook Rate', 'ATCs', 'Freq', 'Fatigue'].map((h) => (
                <th key={h} className="tbl-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {adRows.map((row) => {
              const tl = trafficLight(row)
              return (
                <tr key={row.ad_name} className="tbl-tr">
                  <td className="tbl-td">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${TL_DOT[tl]}`} title={tl} />
                  </td>
                  <td className="tbl-td max-w-[220px]">
                    <span className="font-medium block truncate text-[#111827]" title={row.ad_name}>{row.ad_name}</span>
                    <span className="text-xs text-gray-400">{row.adsetName}</span>
                  </td>
                  <td className="tbl-td text-gray-600">{row.contentPillar || '—'}</td>
                  <td className="tbl-td capitalize text-gray-600">{row.creativeFormat || '—'}</td>
                  <td className="tbl-td">{fmtValue(row.spend, 'currency', 'AU')}</td>
                  <td className="tbl-td">{row.roas.toFixed(2)}x</td>
                  <td className="tbl-td">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${TL_STYLE[tl]}`}>
                      {(row.iRoas || 0).toFixed(2)}x
                    </span>
                  </td>
                  <td className="tbl-td">
                    <span style={{ color: (row.thumbStopRatio || 0) >= 0.25 ? '#0f9d73' : '#6b7280', fontWeight: (row.thumbStopRatio || 0) >= 0.25 ? 600 : 400 }}>
                      {((row.thumbStopRatio || 0) * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="tbl-td">
                    <span style={{ color: (row.hookRate || 0) >= 0.20 ? '#0f9d73' : '#6b7280', fontWeight: (row.hookRate || 0) >= 0.20 ? 600 : 400 }}>
                      {((row.hookRate || 0) * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="tbl-td">{(row.atc || 0).toLocaleString()}</td>
                  <td className="tbl-td">{(row.frequency || 0).toFixed(2)}</td>
                  <td className="tbl-td">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border ${
                      row.fatigueFlag === 'FATIGUED'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-green-50 text-green-700 border-green-200'
                    }`}>
                      {row.fatigueFlag || 'OK'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Fatigue tracker ── */}
      {fatiguedAds.length > 0 && (
        <div className="card border-l-4 border-red-400">
          <p className="text-sm font-semibold text-red-500 mb-1">⚠ Fatigue Alert — {fatiguedAds.length} ad{fatiguedAds.length > 1 ? 's' : ''} flagged</p>
          <p className="text-xs text-gray-400 mb-3">High frequency (&gt; 3.5) + low CTR (&lt; 0.8%) — consider refreshing creative</p>
          <div className="space-y-2">
            {fatiguedAds.map((row) => (
              <div key={row.ad_name} className="flex items-center gap-4 py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs shrink-0 w-24 text-gray-400">{row.funnel_stage}</span>
                <span className="text-sm font-medium flex-1 truncate text-[#111827]" title={row.ad_name}>{row.ad_name}</span>
                <span className="text-xs shrink-0 text-gray-400">Freq {(row.frequency || 0).toFixed(2)}</span>
                <span className="text-xs shrink-0 text-gray-400">CTR {(row.ctr || 0).toFixed(2)}%</span>
                <span className="text-xs shrink-0 text-gray-400">{fmtValue(row.spend, 'currency', 'AU')} spend</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Full breakdown table ── */}
      <div className="card overflow-x-auto">
        <p className="text-sm font-semibold mb-4 text-[#111827]">Full Breakdown — {dimLabel}</p>
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-[#f3f4f6]">
              {['Name', 'Spend', 'Revenue', 'ROAS', 'Purchases', 'CPA', 'ATCs', 'Impressions', 'CTR', 'Freq'].map((h) => (
                <th key={h} className="tbl-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((row) => (
              <tr key={row.label} className="tbl-tr">
                <td className="tbl-td font-medium text-[#111827]">{row.label}</td>
                <td className="tbl-td">{fmtValue(row.spend, 'currency', 'AU')}</td>
                <td className="tbl-td">{fmtValue(row.revenue, 'currency', 'AU')}</td>
                <td className="tbl-td">{fmtValue(row.roas, 'decimal')}</td>
                <td className="tbl-td">{fmtValue(row.purchases, 'integer')}</td>
                <td className="tbl-td">{fmtValue(row.cac, 'currency', 'AU')}</td>
                <td className="tbl-td">{fmtValue(row.atc, 'integer')}</td>
                <td className="tbl-td">{fmtValue(row.impressions, 'integer')}</td>
                <td className="tbl-td">{row.ctr ? row.ctr.toFixed(2) + '%' : '—'}</td>
                <td className="tbl-td">{row.frequency ? row.frequency.toFixed(2) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
