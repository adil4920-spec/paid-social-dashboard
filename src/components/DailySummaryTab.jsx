import React, { useMemo, useState } from 'react'
import {
  aggregateRows, computeMetrics, groupByDate, DEFAULT_TARGETS,
} from '../utils/metrics'
import { computeAdMetrics, computeAdPercentiles, computeAccountMedians, MIN_SPEND_DEFAULT } from '../utils/creativeMetrics'
import {
  DS, STATE_COLORS, getAccountState,
  computeWindowData, generateScaleCutDecisions, runPatternDetectors,
  generateHeadline, generateNarrative,
} from '../utils/dailySummary'
import { parseAdName } from '../utils/adName'

// ── Helpers ──────────────────────────────────────────────────────────────────
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function filterMtd(rows) {
  const now = new Date()
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return rows.filter(r => r.date.startsWith(prefix))
}

function getMaxDate(rows) {
  if (!rows.length) return null
  return rows.reduce((max, r) => r.date > max ? r.date : max, rows[0].date)
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)) }

const AU$ = v => 'A$' + Math.round(v || 0).toLocaleString('en-AU')

function adShortName(fullName) {
  const p = parseAdName(fullName)
  if (p.description) return p.format ? `${p.description} · ${p.format}` : p.description
  return fullName.slice(0, 50)
}

function shortCampaignName(name) {
  const parts = name.split(' | ')
  if (parts.length >= 3) return parts.slice(2, 4).join(' · ').slice(0, 40)
  return name.slice(0, 40)
}

function entityShortName(name, type) {
  if (type === 'campaign') return shortCampaignName(name)
  if (type === 'ad') return adShortName(name)
  return name.slice(0, 50)
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StateBadge({ state }) {
  const c = STATE_COLORS[state] || STATE_COLORS['MONITOR']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 6,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
      {state}
    </span>
  )
}

const CONF_STYLE = {
  HIGH: { color: '#15803D', bg: 'rgba(22,163,74,0.07)', border: 'rgba(22,163,74,0.2)' },
  MED:  { color: '#92400E', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)' },
  LOW:  { color: '#6b7280', bg: 'rgba(107,114,128,0.07)', border: 'rgba(107,114,128,0.15)' },
}

function ConfidenceBadge({ confidence }) {
  const s = CONF_STYLE[confidence] || CONF_STYLE.LOW
  return (
    <span style={{
      padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
      letterSpacing: '0.04em', color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>
      {confidence}
    </span>
  )
}

function DecisionCard({ item, action }) {
  const isScale = action === 'scale'
  const accentColor = isScale ? '#15803D' : '#B91C1C'
  const accentBg    = isScale ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)'
  const borderColor = isScale ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.12)'
  const AU$2 = v => 'A$' + (v || 0).toFixed(2)

  return (
    <div style={{
      padding: '13px 15px', borderRadius: 8,
      border: `1px solid ${borderColor}`,
      background: accentBg,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.35, flex: 1 }}
          title={item.name}
        >
          {entityShortName(item.name, item.type)}
        </span>
        <ConfidenceBadge confidence={item.confidence} />
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#A3A3A3' }}>{item.current}</span>
        <span style={{ fontSize: 10, color: '#D4D4D4' }}>→</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: accentColor }}>{item.action}</span>
      </div>

      {/* Platform + Incremental attribution rows for adsets/campaigns */}
      {item.platform && (
        <div style={{ display: 'flex', gap: 12, paddingTop: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#737373' }}>
            Platform: <strong style={{ color: '#1A1A1A' }}>{item.platform.roas?.toFixed(2) ?? '—'}x</strong>
            {item.platform.band && <span style={{ marginLeft: 4, color: '#A3A3A3' }}>({item.platform.band})</span>}
            {item.platform.cpa > 0 && <span style={{ marginLeft: 6, color: '#A3A3A3' }}> CPA {AU$2(item.platform.cpa)}</span>}
          </span>
          {item.incremental && item.incremental.iRoas > 0 && (
            <span style={{ fontSize: 11, color: '#737373' }}>
              Incremental: <strong style={{ color: '#1A1A1A' }}>{item.incremental.iRoas.toFixed(2)}x</strong>
              {item.incremental.iBand && <span style={{ marginLeft: 4, color: '#A3A3A3' }}>({item.incremental.iBand})</span>}
              {item.incremental.gapPct != null && (
                <span style={{
                  marginLeft: 6, fontSize: 10, fontWeight: 500, padding: '1px 5px', borderRadius: 3,
                  color: item.incremental.gapPct < 25 ? '#16A34A' : item.incremental.gapPct < 60 ? '#D97706' : '#DC2626',
                  background: item.incremental.gapPct < 25 ? 'rgba(22,163,74,0.1)' : item.incremental.gapPct < 60 ? 'rgba(217,119,6,0.1)' : 'rgba(220,38,38,0.1)',
                }}>
                  {item.incremental.gapPct.toFixed(0)}% gap · {item.incremental.label ?? ''}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {item.detail && (
        <p style={{
          fontSize: 12, color: '#555', lineHeight: 1.6, margin: 0,
          paddingTop: 6, borderTop: `1px solid ${borderColor}`,
        }}>
          {item.detail}
        </p>
      )}
    </div>
  )
}

function PatternCard({ pattern }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #EFEFEC', borderRadius: 10,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.2 }}>{pattern.pattern_icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{pattern.pattern_name}</span>
            {pattern.affected_entity_count > 0 && (
              <span style={{ fontSize: 11, color: '#A3A3A3' }}>{pattern.affected_entity_count} affected · {AU$(pattern.spend_exposure)}</span>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#737373', margin: 0, lineHeight: 1.5, display: expanded ? 'none' : '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {pattern.observation}
          </p>
        </div>
        <svg
          style={{ flexShrink: 0, marginTop: 2, transition: 'transform 150ms', transform: expanded ? 'rotate(180deg)' : 'none' }}
          width="14" height="14" viewBox="0 0 12 12" fill="none"
        >
          <path d="M2 4l4 4 4-4" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 12, color: '#737373', margin: 0, lineHeight: 1.6 }}>{pattern.observation}</p>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Plays</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pattern.plays.map((play, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 11, color: '#D4D4D4', flexShrink: 0, marginTop: 1 }}>›</span>
                  <span style={{ fontSize: 12, color: '#1A1A1A', lineHeight: 1.5 }}>{play}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NarrativeBlock({ text }) {
  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #EFEFEC', borderRadius: 10,
      display: 'flex', overflow: 'hidden',
    }}>
      <div style={{ width: 3, background: '#1E3A8A', flexShrink: 0, borderRadius: '10px 0 0 10px' }} />
      <p style={{ fontSize: 13, color: '#3D3D3D', lineHeight: 1.7, margin: 0, padding: '16px 18px' }}>
        {text}
      </p>
    </div>
  )
}

function CollapsibleCard({ title, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', borderBottom: open ? '1px solid #EFEFEC' : 'none',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', flex: 1 }}>{title}</span>
        {count != null && (
          <span style={{ fontSize: 11, color: '#A3A3A3' }}>{count} item{count !== 1 ? 's' : ''}</span>
        )}
        <svg
          style={{ flexShrink: 0, transition: 'transform 150ms', transform: open ? 'rotate(180deg)' : 'none' }}
          width="14" height="14" viewBox="0 0 12 12" fill="none"
        >
          <path d="M2 4l4 4 4-4" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: '16px 18px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function ScaleCutPanel({ scale, cut, emptyMsg }) {
  const hasScale = scale.length > 0
  const hasCut   = cut.length > 0

  if (!hasScale && !hasCut) {
    return (
      <div style={{ padding: '16px', borderRadius: 8, background: '#FAFAF9', border: '1px solid #EFEFEC', fontSize: 12, color: '#A3A3A3', textAlign: 'center' }}>
        {emptyMsg}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {hasScale && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#15803D', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scale</span>
            <span style={{ fontSize: 11, color: '#A3A3A3' }}>{scale.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scale.map((item, i) => <DecisionCard key={i} item={item} action="scale" />)}
          </div>
        </div>
      )}
      {hasScale && hasCut && <div style={{ height: 1, background: '#EFEFEC' }} />}
      {hasCut && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#B91C1C', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cut</span>
            <span style={{ fontSize: 11, color: '#A3A3A3' }}>{cut.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cut.map((item, i) => <DecisionCard key={i} item={item} action="cut" />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DailySummaryTab({ rows = [], targets = {} }) {
  const tgtSpend = targets?.spend ?? DEFAULT_TARGETS.spend

  // ── Data slices ──────────────────────────────────────────────────────────
  const yesterday = useMemo(() => getMaxDate(rows), [rows])
  const mtdRows   = useMemo(() => filterMtd(rows), [rows])
  const allRows   = rows

  // ── Aggregates ────────────────────────────────────────────────────────────
  const mtdAgg = useMemo(() => aggregateRows(mtdRows), [mtdRows])
  const mtdM   = useMemo(() => computeMetrics(mtdAgg), [mtdAgg])

  // ── Pacing ────────────────────────────────────────────────────────────────
  const now          = new Date()
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed  = Math.max(1, now.getDate() - 1)
  const monthPct     = daysElapsed / daysInMonth
  const idealSpend   = tgtSpend * monthPct
  const pacingRatio  = idealSpend > 0 ? mtdAgg.spend / idealSpend : 1

  // ── Per-ad creative metrics ───────────────────────────────────────────────
  const adGroups = useMemo(() => {
    const map = {}
    for (const r of mtdRows) {
      const k = r.ad_name || 'Unknown'
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return map
  }, [mtdRows])

  const medians = useMemo(() => computeAccountMedians(adGroups), [adGroups])

  const mtdAds = useMemo(() => {
    if (!yesterday) return []
    const raw = Object.entries(adGroups).map(([name, adRows]) => computeAdMetrics(name, adRows, yesterday, medians))
    return computeAdPercentiles(raw)
  }, [adGroups, yesterday, medians])

  // ── Window data (L7 / P7) for pattern detectors ───────────────────────────
  const { accountL7, accountP7, adsetData, campaignData } = useMemo(
    () => computeWindowData(allRows, yesterday),
    [allRows, yesterday]
  )

  // ── Health score ──────────────────────────────────────────────────────────
  const pacingScore = clamp(100 - Math.abs(pacingRatio - 1) * 80, 0, 100)

  // Stability: ROAS CV over last 14 days
  const l14Daily = useMemo(() => {
    if (!yesterday) return []
    const cutoff = (() => { const d = new Date(yesterday + 'T00:00:00'); d.setDate(d.getDate() - 13); return d.toISOString().slice(0, 10) })()
    return groupByDate(allRows.filter(r => r.date >= cutoff && r.date <= yesterday))
      .map(d => ({ ...d, ...computeMetrics(d) }))
  }, [allRows, yesterday])
  const roasVals14 = l14Daily.filter(d => d.roas > 0).map(d => d.roas)
  const rMean14    = roasVals14.length ? roasVals14.reduce((s, v) => s + v, 0) / roasVals14.length : 0
  const rCV        = rMean14 > 0
    ? Math.sqrt(roasVals14.reduce((s, v) => s + (v - rMean14) ** 2, 0) / roasVals14.length) / rMean14
    : 0
  const stabilityScore = clamp((1 - rCV * 2) * 100, 0, 100)

  // Trajectory: L7 vs P7 ROAS
  const l7Roas = accountL7?.roas ?? 0
  const p7Roas = accountP7?.roas ?? 0
  const trajectoryScore = p7Roas > 0
    ? clamp(50 + ((l7Roas - p7Roas) / p7Roas) * 200, 0, 100)
    : 50

  // Creative: share of spend on Scale+Healthy ads
  const healthyAdSpend = mtdAds.filter(a => ['Scale', 'Healthy'].includes(a.creativeHealth)).reduce((s, a) => s + a.spend, 0)
  const creativeScore  = mtdAgg.spend > 0 ? clamp((healthyAdSpend / mtdAgg.spend) * 100, 0, 100) : 50

  // Structure: frequency health + adset quality (% not in Kill/Underperforming)
  const freqScore     = mtdM.frequency < 2 ? 100 : mtdM.frequency < 2.5 ? 85 : mtdM.frequency < 3 ? 65 : mtdM.frequency < 3.5 ? 40 : 15
  const badAdsets     = adsetData.filter(a => ['Kill', 'Underperforming'].includes(a.adset_health)).length
  const adsetScore    = adsetData.length > 0 ? clamp((1 - badAdsets / adsetData.length) * 100, 0, 100) : 70
  const structureScore = Math.round(freqScore * 0.5 + adsetScore * 0.5)

  // Algorithm: average spend velocity across active ads
  const activeAds      = mtdAds.filter(a => a.spend >= MIN_SPEND_DEFAULT)
  const avgVelocity    = activeAds.length ? activeAds.reduce((s, a) => s + a.spendVelocity, 0) / activeAds.length : 1
  const algorithmScore = clamp(avgVelocity * 50, 0, 100)

  const healthScore = Math.round(
    0.20 * pacingScore    +
    0.20 * stabilityScore +
    0.20 * trajectoryScore +
    0.15 * creativeScore  +
    0.15 * structureScore +
    0.10 * algorithmScore
  )
  const accountState = getAccountState(healthScore)

  // ── Scale / Cut decisions ─────────────────────────────────────────────────
  const decisions = useMemo(
    () => generateScaleCutDecisions(mtdAds, adsetData, campaignData),
    [mtdAds, adsetData, campaignData]
  )

  // ── Pattern detectors ─────────────────────────────────────────────────────
  const patterns = useMemo(
    () => runPatternDetectors(mtdAds, adsetData, campaignData, accountL7, accountP7),
    [mtdAds, adsetData, campaignData, accountL7, accountP7]
  )

  // ── Narrative ─────────────────────────────────────────────────────────────
  const headline  = useMemo(() => generateHeadline(accountL7, accountP7, patterns), [accountL7, accountP7, patterns])
  const narrative = useMemo(() => generateNarrative(accountL7, accountP7, healthScore, patterns, campaignData), [accountL7, accountP7, healthScore, patterns, campaignData])

  // ── Summary counts for header ─────────────────────────────────────────────
  const totalScale = decisions.ads.scale.length + decisions.adsets.scale.length + decisions.campaigns.scale.length
  const totalCut   = decisions.ads.cut.length   + decisions.adsets.cut.length   + decisions.campaigns.cut.length

  // ── Today's date ─────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header card ──────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            <span style={{ fontSize: 11, color: '#A3A3A3' }}>{today}</span>
            {narrative && (
              <p style={{ fontSize: 13, color: '#3D3D3D', margin: 0, lineHeight: 1.75 }}>
                {narrative}
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {totalScale > 0 && (
                <a href="#scale-cut" style={{ fontSize: 12, color: '#15803D', textDecoration: 'none', fontWeight: 500 }}>
                  {totalScale} to scale ↑
                </a>
              )}
              {totalCut > 0 && (
                <a href="#scale-cut" style={{ fontSize: 12, color: '#B91C1C', textDecoration: 'none', fontWeight: 500 }}>
                  {totalCut} to cut ↓
                </a>
              )}
              {patterns.length > 0 && (
                <a href="#patterns" style={{ fontSize: 12, color: '#6366F1', textDecoration: 'none', fontWeight: 500 }}>
                  {patterns.length} pattern{patterns.length !== 1 ? 's' : ''} detected →
                </a>
              )}
              {totalScale === 0 && totalCut === 0 && patterns.length === 0 && (
                <span style={{ fontSize: 12, color: '#A3A3A3' }}>No actions flagged today</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Scale / Cut ───────────────────────────────────────── */}
      <div id="scale-cut" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
          Scale / Cut decisions
        </p>

        <CollapsibleCard
          title="Ads"
          count={decisions.ads.scale.length + decisions.ads.cut.length || null}
          defaultOpen={false}
        >
          <ScaleCutPanel
            scale={decisions.ads.scale}
            cut={decisions.ads.cut}
            emptyMsg="No ad-level actions flagged"
          />
        </CollapsibleCard>

        <CollapsibleCard
          title="Ad sets"
          count={decisions.adsets.scale.length + decisions.adsets.cut.length || null}
          defaultOpen={false}
        >
          <ScaleCutPanel
            scale={decisions.adsets.scale}
            cut={decisions.adsets.cut}
            emptyMsg="No ad set-level actions flagged"
          />
        </CollapsibleCard>

        <CollapsibleCard
          title="Campaigns"
          count={decisions.campaigns.scale.length + decisions.campaigns.cut.length || null}
          defaultOpen={false}
        >
          <ScaleCutPanel
            scale={decisions.campaigns.scale}
            cut={decisions.campaigns.cut}
            emptyMsg="No campaign-level actions flagged"
          />
        </CollapsibleCard>
      </div>

      {/* ── Section 3: Strategic Patterns ───────────────────────────────── */}
      <div id="patterns" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
          Strategic patterns · {patterns.length > 0 ? `${patterns.length} detected` : 'none detected'}
        </p>
        {patterns.length === 0 ? (
          <div style={{ padding: '20px', borderRadius: 10, background: '#FAFAF9', border: '1px solid #EFEFEC', fontSize: 12, color: '#A3A3A3', textAlign: 'center' }}>
            No structural patterns detected — account metrics are in steady state
          </div>
        ) : (
          patterns.map((p, i) => <PatternCard key={i} pattern={p} />)
        )}
      </div>

    </div>
  )
}
