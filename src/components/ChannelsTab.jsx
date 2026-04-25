import React from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { groupByChannel, formatValue } from '../utils/metrics'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const CHANNEL_COLORS = {
  Meta: '#6366f1',
  TikTok: '#ec4899',
  Pinterest: '#e11d48',
  Unknown: '#9ca3af',
}

function getColor(channel) {
  return CHANNEL_COLORS[channel] ?? '#9ca3af'
}

const TABLE_COLS = [
  { key: 'channel', label: 'Channel', format: null },
  { key: 'spend', label: 'Spend', format: 'currency' },
  { key: 'revenue', label: 'Revenue', format: 'currency' },
  { key: 'roas', label: 'ROAS', format: 'decimal' },
  { key: 'cos', label: 'COS%', format: 'percent' },
  { key: 'ncac', label: 'NCAC', format: 'currency' },
  { key: 'cac', label: 'CAC', format: 'currency' },
]

export default function ChannelsTab({ filteredRows }) {
  const channels = groupByChannel(filteredRows)

  const doughnutData = {
    labels: channels.map((c) => c.channel),
    datasets: [
      {
        data: channels.map((c) => +c.spend.toFixed(2)),
        backgroundColor: channels.map((c) => getColor(c.channel)),
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  }

  const barData = {
    labels: channels.map((c) => c.channel),
    datasets: [
      {
        label: 'ROAS',
        data: channels.map((c) => +c.roas.toFixed(2)),
        backgroundColor: channels.map((c) => getColor(c.channel)),
        borderRadius: 6,
        barThickness: 40,
      },
    ],
  }

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: { usePointStyle: true, boxWidth: 8, font: { size: 12 }, color: '#6b7280' },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0)
            const pct = ((ctx.parsed / total) * 100).toFixed(1)
            return ` ${ctx.label}: $${ctx.parsed.toLocaleString()} (${pct}%)`
          },
        },
      },
    },
  }

  const barOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ROAS: ${ctx.parsed.y}x` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 12 }, color: '#6b7280' } },
      y: {
        grid: { color: '#f3f4f6' },
        ticks: { font: { size: 11 }, color: '#9ca3af', callback: (v) => v + 'x' },
        beginAtZero: true,
      },
    },
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <p className="text-sm font-semibold text-gray-700 mb-4">Spend by Channel</p>
          <div style={{ height: 220 }}>
            <Doughnut data={doughnutData} options={doughnutOpts} />
          </div>
        </div>
        <div className="card">
          <p className="text-sm font-semibold text-gray-700 mb-4">ROAS by Channel</p>
          <div style={{ height: 220 }}>
            <Bar data={barData} options={barOpts} />
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <p className="text-sm font-semibold text-gray-700 mb-4">Channel Breakdown</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {TABLE_COLS.map((col) => (
                <th key={col.key} className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 pr-4 last:pr-0">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => (
              <tr key={ch.channel} className="border-b border-gray-50 last:border-0">
                {TABLE_COLS.map((col) => (
                  <td key={col.key} className="py-2.5 pr-4 last:pr-0 font-medium text-gray-800">
                    {col.format
                      ? formatValue(ch[col.key], col.format)
                      : <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getColor(ch.channel) }} />
                          {ch.channel}
                        </span>
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
