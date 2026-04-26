import React from 'react'
import { METRIC_DEFS, getStatus } from '../utils/metrics'
import { fmtValue } from '../utils/currency'

const STATUS_COLOR = {
  green:   '#22c55e',
  amber:   '#f59e0b',
  red:     '#ef4444',
  neutral: '#e5e7eb',
}

const STATUS_BADGE = {
  green:   { label: 'On Track',  cls: 'badge-green' },
  amber:   { label: 'Near',      cls: 'badge-amber' },
  red:     { label: 'Off Track', cls: 'badge-red'   },
  neutral: { label: '',          cls: ''             },
}

const OVERVIEW_KEYS = ['revenue', 'cos', 'gcos', 'acos', 'cac', 'ncac']

export default function SummaryCards({ metrics, targets, keys = OVERVIEW_KEYS }) {
  const defs = keys ? METRIC_DEFS.filter(d => keys.includes(d.key)) : METRIC_DEFS
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {defs.map((def) => {
        const actual = metrics[def.key] ?? 0
        const target = targets[def.key] ?? 0
        const status = getStatus(def.key, actual, target, def.higherIsBetter)
        const badge  = STATUS_BADGE[status]
        const pct    = target > 0 ? Math.min((actual / target) * 100, 100) : null

        return (
          <div key={def.key} className="card flex flex-col" style={{ minHeight: 168 }}>
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <span className="metric-label leading-tight">{def.label}</span>
              {badge.label && <span className={badge.cls}>{badge.label}</span>}
            </div>

            {/* Value */}
            <p className="text-[26px] font-bold tracking-tight text-[#111827] leading-none mb-1">
              {fmtValue(actual, def.format, 'AU')}
            </p>

            {/* Target + variance */}
            {target > 0 && (() => {
              const diff = def.higherIsBetter
                ? ((actual - target) / target) * 100
                : ((target - actual) / target) * 100
              const sign = diff >= 0 ? '+' : ''
              const varColor = status === 'green' ? '#22c55e' : status === 'amber' ? '#f59e0b' : '#ef4444'
              return (
                <p className="helper-text mb-3">
                  Target {fmtValue(target, def.format, 'AU')}
                  {' · '}
                  <span style={{ color: varColor, fontWeight: 600 }}>{sign}{diff.toFixed(1)}%</span>
                </p>
              )
            })()}

            {/* Attainment + progress bar */}
            {pct !== null && (
              <div className="mb-3">
                <div className="flex justify-end mb-1">
                  <span className="helper-text">{pct.toFixed(0)}%</span>
                </div>
                <div className="h-[5px] rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: STATUS_COLOR[status] }}
                  />
                </div>
              </div>
            )}

            {/* Definition — pushed to bottom */}
            <p className="helper-text mt-auto pt-1">{def.description}</p>
          </div>
        )
      })}
    </div>
  )
}
