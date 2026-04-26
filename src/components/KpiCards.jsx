import React, { useState } from 'react'
import { aggregateRows, computeMetrics, filterByRegion, METRIC_DEFS, getStatus, DEFAULT_TARGETS } from '../utils/metrics'
import { fmtValue } from '../utils/currency'

const STATUS = {
  green:   { cls: 'badge-green',  label: 'On Track' },
  amber:   { cls: 'badge-amber',  label: 'Near' },
  red:     { cls: 'badge-red',    label: 'Off Track' },
  neutral: { cls: '',             label: '' },
}

const BAR_COLOR = {
  green:   'bg-brand-sage',
  amber:   'bg-brand-mustard',
  red:     'bg-brand-danger',
  neutral: 'bg-gray-200',
}

const REGION_CURRENCY = { AU: 'AU', US: 'US', UK: 'UK', Global: 'Global' }

function MetricCard({ def, actual, target, region }) {
  const status = getStatus(def.key, actual, target, def.higherIsBetter)
  const sc     = STATUS[status]
  const pct    = target > 0 ? Math.min((actual / target) * 100, 110) : null
  const barW   = pct !== null ? Math.min(pct, 100) : 0

  return (
    <div className="card flex flex-col gap-2.5 min-w-0">
      <div className="flex items-start justify-between gap-1.5">
        <p className="metric-label truncate">{def.label}</p>
        {sc.label && <span className={sc.cls}>{sc.label}</span>}
      </div>
      <p className="metric-value leading-none">{fmtValue(actual, def.format, region)}</p>
      {target > 0 && (
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[11px] text-gray-400">Target {fmtValue(target, def.format, region)}</span>
            {pct !== null && <span className="text-[11px] font-medium text-gray-500">{pct.toFixed(0)}%</span>}
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${BAR_COLOR[status]}`} style={{ width: `${barW}%` }} />
          </div>
        </div>
      )}
      <p className="text-[11px] text-gray-400 leading-snug">{def.description}</p>
    </div>
  )
}

function RegionSection({ label, rows, targets, region, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const agg     = aggregateRows(rows)
  const metrics = computeMetrics(agg)
  const cur     = REGION_CURRENCY[region] ?? 'Global'

  const REGION_FLAGS = { AU: '🇦🇺', US: '🇺🇸', UK: '🇬🇧', Global: '🌍' }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 mb-3 group w-full text-left"
      >
        <span className="text-base">{REGION_FLAGS[region] ?? ''}</span>
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <svg
          className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${open ? '' : '-rotate-90'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {METRIC_DEFS.map((def) => (
            <MetricCard
              key={def.key}
              def={def}
              actual={metrics[def.key]}
              target={targets[def.key]}
              region={cur}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function KpiCards({ filteredRows, allRows, targets, regionFilter }) {
  const showRegions = !regionFilter || regionFilter === 'All'

  if (!showRegions) {
    const regionRows = filterByRegion(filteredRows, regionFilter)
    return (
      <RegionSection
        label={regionFilter}
        rows={regionRows}
        targets={targets}
        region={regionFilter}
        defaultOpen
      />
    )
  }

  return (
    <div className="space-y-6">
      <RegionSection label="Global" rows={filteredRows} targets={targets} region="Global" defaultOpen />
      {['AU', 'US', 'UK'].map((r) => (
        <RegionSection
          key={r}
          label={r}
          rows={filterByRegion(filteredRows, r)}
          targets={targets}
          region={r}
          defaultOpen={false}
        />
      ))}
    </div>
  )
}
