import React from 'react'
import { filterByMonth, groupByDate, computeMetrics } from '../utils/metrics'

function Delta({ actual, target }) {
  if (!target) return <span className="text-gray-400">—</span>
  const pct = ((actual - target) / target) * 100
  const pos = pct >= 0
  return (
    <span className="text-xs font-semibold" style={{ color: pos ? '#0f9d73' : '#d14a47' }}>
      {pos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

export default function DailyLog({ rows, targets }) {
  const mtd   = filterByMonth(rows)
  const daily = groupByDate(mtd)

  if (daily.length === 0) {
    return (
      <div className="card text-sm text-center py-10 text-gray-400">
        No data for the current month yet.
      </div>
    )
  }

  const daysInMonth    = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const dailyRevTarget = (targets.revenue ?? 0) / daysInMonth
  const dailySpend     = (targets.spend   ?? 0) / daysInMonth

  return (
    <div className="card overflow-x-auto">
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm font-semibold text-gray-800">Daily Log — MTD</p>
        <span className="text-xs text-gray-400">{daily.length} days</span>
      </div>
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="border-b border-gray-100">
            {['Date','Revenue','vs Target','Spend','vs Budget','ROAS','Purchases','CPA','Impressions','Freq'].map((h) => (
              <th key={h} className="tbl-th">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...daily].reverse().map((day) => {
            const m = computeMetrics(day)
            return (
              <tr key={day.date} className="tbl-tr">
                <td className="tbl-td text-gray-400">
                  {new Date(day.date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </td>
                <td className="tbl-td font-semibold">${day.revenue.toLocaleString('en-AU', { maximumFractionDigits: 2 })}</td>
                <td className="tbl-td"><Delta actual={day.revenue} target={dailyRevTarget} /></td>
                <td className="tbl-td">${day.spend.toLocaleString('en-AU', { maximumFractionDigits: 2 })}</td>
                <td className="tbl-td"><Delta actual={dailySpend} target={day.spend} /></td>
                <td className="tbl-td">{m.roas.toFixed(2)}x</td>
                <td className="tbl-td">{day.purchases}</td>
                <td className="tbl-td">{m.cac > 0 ? '$' + m.cac.toFixed(2) : '—'}</td>
                <td className="tbl-td">{day.impressions.toLocaleString()}</td>
                <td className="tbl-td">{m.frequency.toFixed(2)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
