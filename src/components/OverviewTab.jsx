import React from 'react'
import KpiCard from './KpiCard'
import InsightBox from './InsightBox'
import { METRIC_DEFS } from '../utils/metrics'

export default function OverviewTab({ metrics, targets }) {
  return (
    <div className="space-y-6">
      <InsightBox metrics={metrics} targets={targets} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {METRIC_DEFS.map((def) => (
          <KpiCard
            key={def.key}
            def={def}
            actual={metrics[def.key]}
            target={targets[def.key]}
          />
        ))}
      </div>
    </div>
  )
}
