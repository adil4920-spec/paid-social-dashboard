import React from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { groupByDate, computeMetrics, formatValue } from '../utils/metrics'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const BASE_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'top',
      labels: { usePointStyle: true, boxWidth: 8, font: { size: 12 }, color: '#6b7280' },
    },
  },
  scales: {
    x: {
      grid: { color: '#f3f4f6' },
      ticks: { font: { size: 11 }, color: '#9ca3af', maxTicksLimit: 10 },
    },
    y: {
      grid: { color: '#f3f4f6' },
      ticks: { font: { size: 11 }, color: '#9ca3af' },
    },
  },
}

function ChartCard({ title, children }) {
  return (
    <div className="card">
      <p className="text-sm font-semibold text-gray-700 mb-4">{title}</p>
      <div style={{ height: 240 }}>{children}</div>
    </div>
  )
}

export default function TrendsTab({ filteredRows, targets }) {
  const daily = groupByDate(filteredRows)
  const labels = daily.map((d) => {
    const dt = new Date(d.date)
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })

  const spends = daily.map((d) => +d.spend.toFixed(2))
  const revenues = daily.map((d) => +d.revenue.toFixed(2))
  const roasValues = daily.map((d) => {
    const m = computeMetrics(d)
    return +m.roas.toFixed(2)
  })
  const cosValues = daily.map((d) => {
    const m = computeMetrics(d)
    return +m.cos.toFixed(2)
  })

  const targetRoasLine = daily.map(() => targets.roas || null)
  const targetCosLine = daily.map(() => targets.cos || null)

  const revSpendData = {
    labels,
    datasets: [
      {
        label: 'Revenue',
        data: revenues,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.06)',
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Spend',
        data: spends,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.06)',
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.3,
        fill: true,
      },
    ],
  }

  const roasData = {
    labels,
    datasets: [
      {
        label: 'ROAS',
        data: roasValues,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.06)',
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Target',
        data: targetRoasLine,
        borderColor: '#6b7280',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
      },
    ],
  }

  const cosData = {
    labels,
    datasets: [
      {
        label: 'COS%',
        data: cosValues,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.06)',
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Target',
        data: targetCosLine,
        borderColor: '#6b7280',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
      },
    ],
  }

  const currencyOpts = {
    ...BASE_OPTS,
    plugins: {
      ...BASE_OPTS.plugins,
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString()}`,
        },
      },
    },
    scales: {
      ...BASE_OPTS.scales,
      y: {
        ...BASE_OPTS.scales.y,
        ticks: {
          ...BASE_OPTS.scales.y.ticks,
          callback: (v) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v),
        },
      },
    },
  }

  return (
    <div className="space-y-4">
      <ChartCard title="Daily Revenue vs Spend">
        <Line data={revSpendData} options={currencyOpts} />
      </ChartCard>
      <ChartCard title="ROAS Over Time">
        <Line data={roasData} options={BASE_OPTS} />
      </ChartCard>
      <ChartCard title="COS% Over Time">
        <Line data={cosData} options={BASE_OPTS} />
      </ChartCard>
    </div>
  )
}
