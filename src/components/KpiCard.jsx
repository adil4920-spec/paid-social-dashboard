import React from 'react'
import { formatValue, getStatus } from '../utils/metrics'

const STATUS_CONFIG = {
  green: { badge: 'badge-green', label: 'On Track' },
  amber: { badge: 'badge-amber', label: 'Near' },
  red: { badge: 'badge-red', label: 'Off Track' },
  neutral: { badge: '', label: '' },
}

export default function KpiCard({ def, actual, target }) {
  const status = getStatus(def.key, actual, target, def.higherIsBetter)
  const cfg = STATUS_CONFIG[status]
  const pct = target > 0 ? (actual / target) * 100 : null
  const progressWidth = pct !== null ? Math.min(pct, 100) : 0

  const progressColor =
    status === 'green' ? 'bg-green-500' : status === 'amber' ? 'bg-amber-400' : status === 'red' ? 'bg-red-500' : 'bg-gray-300'

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="metric-label">{def.label}</p>
          <p className="metric-value mt-1">{formatValue(actual, def.format)}</p>
        </div>
        {cfg.label && <span className={cfg.badge}>{cfg.label}</span>}
      </div>

      {target > 0 && (
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-400">Target: {formatValue(target, def.format)}</span>
            {pct !== null && (
              <span className="text-xs font-medium text-gray-600">{pct.toFixed(0)}%</span>
            )}
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${progressWidth}%` }}
            />
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 leading-snug">{def.description}</p>
    </div>
  )
}
