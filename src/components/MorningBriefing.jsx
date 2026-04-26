import React from 'react'
import { filterByMonth, aggregateRows, computeMetrics } from '../utils/metrics'

function fmt$(n) { return 'A$' + Math.round(n).toLocaleString('en-AU') }
function fmtPct(n) { return n.toFixed(1) + '%' }

export default function MorningBriefing({ rows, targets, pacerData }) {
  const anz      = (key) => pacerData?.metrics[key]?.[1] ?? null
  const mtdRows  = filterByMonth(rows)
  const m        = computeMetrics(aggregateRows(mtdRows))

  // Revenue from Shopify (Pacer); efficiency metrics from Meta spend
  const shopifyRev    = anz('revActual')
  const revTarget     = anz('revTarget') ?? targets.revenue ?? 0
  const revVsTarget   = anz('revVsTarget') // already a % from pacer
  const metaSpend     = m.spend

  const now   = new Date()
  const label = now.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

  const lines = []

  // Line 1: revenue vs target
  if (shopifyRev != null && revTarget > 0) {
    const pct  = revVsTarget != null ? revVsTarget : ((shopifyRev / revTarget) * 100 - 100)
    const icon = pct >= 0 ? '✅' : pct >= -10 ? '⚠️' : '🔴'
    const pace = pct >= 0 ? 'ahead of target' : pct >= -10 ? 'close to target' : 'behind target'
    lines.push(`${icon} ${fmt$(shopifyRev)} Shopify net sales MTD — ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs ${fmt$(revTarget)} target, ${pace}.`)
  }

  // Line 2: efficiency snapshot from Meta
  if (metaSpend > 0) {
    const cosIcon = targets.cos > 0 ? (m.cos <= targets.cos * 1.05 ? '✅' : m.cos <= targets.cos * 1.22 ? '⚠️' : '🔴') : '📊'
    lines.push(`${cosIcon} Meta spend ${fmt$(metaSpend)} — COS ${fmtPct(m.cos)}, CAC ${fmt$(m.cac)}, NCAC ${fmt$(m.ncac)}.`)
  }

  if (lines.length === 0) {
    lines.push('No data for the current month yet.')
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-3">
        <span className="metric-label">Morning Snapshot</span>
        <span className="helper-text">{label}</span>
      </div>
      <div className="space-y-1.5">
        {lines.map((line, i) => (
          <p key={i} className="text-sm leading-relaxed text-[#374151]">{line}</p>
        ))}
      </div>
    </div>
  )
}
