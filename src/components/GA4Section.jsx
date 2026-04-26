import React from 'react'
import { Bar } from 'react-chartjs-2'
import { getGA4Data } from '../utils/ga4Data'

const SOURCE_COLORS = ['#5b4fe9', '#ff7a59', '#0f9d73', '#e8a02d', '#d14a47']

const CHART_DEFS = [
  { key: 'sessions',       label: 'Sessions by Source',     suffix: '',   fmt: (v) => v.toLocaleString() },
  { key: 'engagementRate', label: 'Engagement Rate (%)',    suffix: '%',  fmt: (v) => v.toFixed(1) + '%' },
  { key: 'bounceRate',     label: 'Bounce Rate (%)',        suffix: '%',  fmt: (v) => v.toFixed(1) + '%' },
  { key: 'conversions',    label: 'Conversions by Source',  suffix: '',   fmt: (v) => v.toLocaleString() },
  { key: 'revenue',        label: 'Revenue by Source ($)',  suffix: '',   fmt: (v) => '$' + v.toLocaleString() },
]

function GA4Chart({ title, data, labels, suffix, colors }) {
  const chartData = {
    labels,
    datasets: [{
      label: title,
      data,
      backgroundColor: colors,
      borderRadius: 6,
      barThickness: 36,
    }],
  }

  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y.toLocaleString()}${suffix}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#6b7280' } },
      y: {
        grid: { color: '#f3f4f6' },
        ticks: { font: { size: 11 }, color: '#9ca3af' },
        beginAtZero: true,
      },
    },
  }

  return (
    <div className="card">
      <p className="text-sm font-semibold text-gray-700 mb-4">{title}</p>
      <div style={{ height: 200 }}>
        <Bar data={chartData} options={opts} />
      </div>
    </div>
  )
}

export default function GA4Section({ days }) {
  const ga4 = getGA4Data(days)
  const labels = ga4.map((d) => d.source)
  const colors = ga4.map((_, i) => SOURCE_COLORS[i % SOURCE_COLORS.length])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold text-gray-700">Google Analytics 4</span>
        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-medium">Sample Data</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CHART_DEFS.map((def) => (
          <GA4Chart
            key={def.key}
            title={def.label}
            data={ga4.map((d) => d[def.key])}
            labels={labels}
            suffix={def.suffix}
            colors={colors}
          />
        ))}
      </div>
    </div>
  )
}
