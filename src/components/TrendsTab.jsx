import React, { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { groupByDate, computeMetrics, METRIC_DEFS, getStatus } from '../utils/metrics'
import { fmtValue } from '../utils/currency'

const STATUS_COLOR = {
  green:   '#22c55e',
  amber:   '#f59e0b',
  red:     '#ef4444',
  neutral: '#6b7280',
}

function fmtAxisValue(value, format) {
  if (format === 'currency') {
    if (value >= 1000) return 'A$' + (value / 1000).toFixed(1) + 'k'
    return 'A$' + value.toFixed(0)
  }
  if (format === 'percent') return value.toFixed(1) + '%'
  if (format === 'decimal') return value.toFixed(2) + 'x'
  return value.toFixed(0)
}

function buildOpts(def, lineColor) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        padding: 8,
        cornerRadius: 8,
        callbacks: {
          title: (items) => items[0]?.label ?? '',
          label: (ctx) => '  ' + fmtValue(ctx.parsed.y, def.format, 'AU'),
        },
      },
    },
    scales: {
      x: {
        grid: { color: '#f3f4f6', drawBorder: false },
        border: { display: false },
        ticks: { font: { size: 11, family: 'Inter' }, color: '#9ca3af', maxTicksLimit: 8, maxRotation: 0 },
      },
      y: {
        grid: { color: '#f3f4f6', drawBorder: false },
        border: { display: false },
        ticks: {
          font: { size: 11, family: 'Inter' },
          color: '#9ca3af',
          callback: (v) => fmtAxisValue(v, def.format),
        },
      },
    },
  }
}

export default function TrendsTab({ filteredRows, metrics, targets }) {
  const daily = useMemo(
    () => groupByDate(filteredRows).map((day) => ({ date: day.date, ...computeMetrics(day) })),
    [filteredRows]
  )

  const labels = daily.map((d) =>
    new Date(d.date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  )

  if (daily.length === 0) {
    return (
      <div className="card text-center py-16 text-[#9ca3af] text-sm">
        No data for the selected period.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {METRIC_DEFS.map((def) => {
        const actual    = metrics[def.key] ?? 0
        const target    = targets[def.key] ?? 0
        const status    = getStatus(def.key, actual, target, def.higherIsBetter)
        const lineColor = STATUS_COLOR[status]

        const chartData = {
          labels,
          datasets: [
            {
              data: daily.map((d) => d[def.key] ?? 0),
              borderColor: lineColor,
              backgroundColor: lineColor + '18',
              fill: true,
              tension: 0.35,
              pointRadius: 2,
              pointHoverRadius: 5,
              borderWidth: 2,
              pointBorderColor: lineColor,
              pointBackgroundColor: '#ffffff',
            },
          ],
        }

        return (
          <div key={def.key} className="card">
            <p className="metric-label mb-4">{def.label}</p>
            <div style={{ height: 176 }}>
              <Line data={chartData} options={buildOpts(def, lineColor)} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
