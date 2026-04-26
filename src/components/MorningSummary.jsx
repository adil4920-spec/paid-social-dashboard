import React from 'react'
import { buildMorningSummary, filterByMonth } from '../utils/metrics'

export default function MorningSummary({ rows, targets }) {
  const mtdRows = filterByMonth(rows)
  const bullets = buildMorningSummary(mtdRows, targets, rows)

  return (
    <div className="card">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-base">☀️</span>
        <span className="text-sm font-semibold text-gray-800">Morning Summary</span>
        <span className="ml-auto text-xs text-gray-400">MTD · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
      <ul className="space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="text-sm text-gray-700 leading-relaxed flex gap-2">
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
