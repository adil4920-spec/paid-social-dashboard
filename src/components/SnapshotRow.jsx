import React from 'react'
import { aggregateRows, computeMetrics, formatValue, METRIC_DEFS } from '../utils/metrics'

function getDayRows(rows, daysBack) {
  const d = new Date()
  d.setDate(d.getDate() - daysBack)
  const dateStr = d.toISOString().split('T')[0]
  return rows.filter((r) => r.date === dateStr)
}

function Delta({ current, prev, format, higherIsBetter }) {
  if (!prev || prev === 0) return null
  const diff = ((current - prev) / Math.abs(prev)) * 100
  const isGood = higherIsBetter ? diff >= 0 : diff <= 0
  const sign = diff >= 0 ? '+' : ''
  return (
    <span className={`text-xs font-medium ${isGood ? 'text-green-600' : 'text-red-500'}`}>
      {sign}{diff.toFixed(1)}%
    </span>
  )
}

const SNAPSHOT_METRICS = ['revenue', 'spend', 'roas', 'cos']

export default function SnapshotRow({ rows }) {
  const todayRows = getDayRows(rows, 0)
  const yesterdayRows = getDayRows(rows, 1)

  const todayMetrics = computeMetrics(aggregateRows(todayRows))
  const yestMetrics = computeMetrics(aggregateRows(yesterdayRows))

  const hasTodayData = todayRows.length > 0

  return (
    <div className="card-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Today vs Yesterday
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {SNAPSHOT_METRICS.map((key) => {
          const def = METRIC_DEFS.find((d) => d.key === key)
          return (
            <div key={key}>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{def.label}</p>
              <p className="text-lg font-semibold text-gray-900 mt-0.5">
                {hasTodayData ? formatValue(todayMetrics[key], def.format) : '—'}
              </p>
              {hasTodayData && (
                <Delta
                  current={todayMetrics[key]}
                  prev={yestMetrics[key]}
                  format={def.format}
                  higherIsBetter={def.higherIsBetter}
                />
              )}
              {!hasTodayData && (
                <span className="text-xs text-gray-400">No data yet</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
