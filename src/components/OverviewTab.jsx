import React, { useMemo } from 'react'
import MorningBriefing from './MorningBriefing'
import NorthStarCards  from './NorthStarCards'
import { buildDailyRows } from '../utils/insights'

function filterAnzPeriod(anzDaily, start, end) {
  return (anzDaily ?? []).filter(d => d.date >= start && d.date <= end)
}

export default function OverviewTab({ rows, metrics, targets, dateRange, pacerData }) {
  const anzPeriod = useMemo(
    () => filterAnzPeriod(pacerData?.anzDaily, dateRange.start, dateRange.end),
    [pacerData, dateRange]
  )

  const anzRevenue = useMemo(() => {
    const s = anzPeriod.reduce((a, d) => a + (d.revenue ?? 0), 0)
    return s > 0 ? s : null
  }, [anzPeriod])

  const anzMer = useMemo(() => {
    const rev   = anzPeriod.reduce((a, d) => a + (d.revenue ?? 0), 0)
    const spend = anzPeriod.reduce((a, d) => a + (d.spend   ?? 0), 0)
    return rev > 0 ? (spend / rev) * 100 : null
  }, [anzPeriod])

  // Revenue target only meaningful for "This month" preset (Pacer target is always MTD)
  const revTarget = dateRange.preset === 'thisMonth' ? (pacerData?.metrics?.revTarget?.[1] ?? null) : null

  const displayMetrics = {
    ...metrics,
    revenue: anzRevenue ?? metrics.revenue,
    mer:     anzMer     ?? metrics.mer,
  }
  const displayTargets = revTarget != null ? { ...targets, revenue: revTarget } : { ...targets, revenue: 0 }

  const daily = useMemo(() => buildDailyRows(
    rows.filter(r => r.date >= dateRange.start && r.date <= dateRange.end)
  ), [rows, dateRange])

  return (
    <div className="space-y-5">
      <MorningBriefing rows={rows} targets={displayTargets} pacerData={pacerData} />
      <NorthStarCards
        metrics={displayMetrics}
        targets={displayTargets}
        daily={daily}
        pacerData={pacerData}
        anzPeriod={anzPeriod}
      />
    </div>
  )
}
