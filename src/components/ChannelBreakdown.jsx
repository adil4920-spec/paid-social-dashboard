import React from 'react'
import { Doughnut, Bar } from 'react-chartjs-2'
import { groupByPlatform } from '../utils/metrics'
import { fmtValue } from '../utils/currency'

const COLORS = {
  Meta:      '#5b4fe9',
  TikTok:    '#ff7a59',
  Pinterest: '#d14a47',
  Unknown:   '#9ca3af',
}

const TABLE_COLS = [
  { key: 'platform',     label: 'Platform',  render: (v, row) => (
    <span className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[v] ?? '#9ca3af' }} />
      {v}
    </span>
  )},
  { key: 'spend',    label: 'Spend',    format: 'currency' },
  { key: 'revenue',  label: 'Revenue',  format: 'currency' },
  { key: 'roas',     label: 'ROAS',     format: 'decimal' },
  { key: 'cos',      label: 'COS%',     format: 'percent' },
  { key: 'ncac',     label: 'NCAC',     format: 'currency' },
  { key: 'cac',      label: 'CAC',      format: 'currency' },
]

export default function ChannelBreakdown({ filteredRows }) {
  const channels = groupByPlatform(filteredRows)
  const labels   = channels.map((c) => c.platform)
  const colors   = channels.map((c) => COLORS[c.platform] ?? '#9ca3af')

  const doughnutData = {
    labels,
    datasets: [{
      data: channels.map((c) => +c.spend.toFixed(2)),
      backgroundColor: colors,
      borderWidth: 2,
      borderColor: '#fff',
    }],
  }

  const barData = {
    labels,
    datasets: [{
      label: 'ROAS',
      data: channels.map((c) => +c.roas.toFixed(2)),
      backgroundColor: colors,
      borderRadius: 6,
      barThickness: 44,
    }],
  }

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, font: { size: 12 }, color: '#6b7280' } },
      tooltip: { callbacks: { label: (ctx) => {
        const total = ctx.dataset.data.reduce((a, b) => a + b, 0)
        const pct   = ((ctx.parsed / total) * 100).toFixed(1)
        return ` ${ctx.label}: $${ctx.parsed.toLocaleString()} (${pct}%)`
      }}},
    },
  }

  const barOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ROAS: ${ctx.parsed.y.toFixed(2)}x` } },
    },
    scales: {
      x: { grid: { display: false },   ticks: { font: { size: 12 }, color: '#6b7280' } },
      y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 }, color: '#9ca3af', callback: (v) => v + 'x' }, beginAtZero: true },
    },
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <p className="text-sm font-semibold text-gray-700 mb-4">Spend Split</p>
          <div style={{ height: 220 }}><Doughnut data={doughnutData} options={doughnutOpts} /></div>
        </div>
        <div className="card">
          <p className="text-sm font-semibold text-gray-700 mb-4">ROAS by Platform</p>
          <div style={{ height: 220 }}><Bar data={barData} options={barOpts} /></div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <p className="text-sm font-semibold text-gray-700 mb-4">Platform Breakdown</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {TABLE_COLS.map((c) => <th key={c.key} className="tbl-th">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => (
              <tr key={ch.platform} className="tbl-tr">
                {TABLE_COLS.map((col) => (
                  <td key={col.key} className="tbl-td">
                    {col.render
                      ? col.render(ch[col.key], ch)
                      : fmtValue(ch[col.key], col.format)
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
