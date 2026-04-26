import React, { useState, useMemo } from 'react'
import { groupByAd, groupByAdset, groupByField } from '../utils/metrics'
import { fmtValue } from '../utils/currency'

const GROUP_OPTIONS = [
  { id: 'campaign_name', label: 'Campaign', groupFn: rows => groupByField(rows, 'campaign_name'), nameKey: 'label'     },
  { id: 'adsetName',     label: 'Ad Set',   groupFn: rows => groupByAdset(rows),                  nameKey: 'adsetName' },
  { id: 'ad_name',       label: 'Ad',       groupFn: rows => groupByAd(rows),                     nameKey: 'ad_name'   },
]

function GroupToggle({ value, onChange, counts = {} }) {
  return (
    <div style={{ display: 'inline-flex', background: '#F5F5F4', borderRadius: 8, padding: 3 }}>
      {GROUP_OPTIONS.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)}
          style={{
            padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: value === o.id ? '#FFFFFF' : 'transparent',
            color: value === o.id ? '#1A1A1A' : '#737373',
            boxShadow: value === o.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 150ms ease',
          }}
        >
          {o.label}
          {counts[o.id] != null && <span style={{ marginLeft: 5, fontSize: 10, color: '#A3A3A3', fontWeight: 400 }}>{counts[o.id]}</span>}
        </button>
      ))}
    </div>
  )
}

// ── Configurable thresholds — edit these to tune for your account ──────────
const T = {
  ROAS_TARGET:     3.5,    // minimum acceptable ROAS
  THUMB_STOP_GOOD: 0.30,   // ≥30% — strong hook
  THUMB_STOP_WARN: 0.25,   // <25% — weak hook → red cell
  HOOK_RATE_WARN:  0.15,   // <15% → red cell
  HOLD_RATE_WARN:  0.50,   // <50% → red cell
  HOLD_RATE_GOOD:  0.60,   // ≥60% — strong retention
}

const pct = v => (v != null && !isNaN(v)) ? (v * 100).toFixed(1) + '%' : '—'

function diagnose({ thumbStopRatio, holdRate, clickPerView, roas, fatigueFlag }, medianCpv) {
  if (thumbStopRatio >= T.THUMB_STOP_GOOD && holdRate < T.HOLD_RATE_WARN)
    return { text: 'Hook works, body fails — recut middle', level: 'amber' }
  if (thumbStopRatio < T.THUMB_STOP_WARN && holdRate >= T.HOLD_RATE_GOOD)
    return { text: 'Weak opener — replace first 3 seconds', level: 'amber' }
  if (holdRate >= T.HOLD_RATE_GOOD && clickPerView < medianCpv)
    return { text: 'Engaged but not motivated — CTA/offer issue', level: 'amber' }
  if (thumbStopRatio >= T.THUMB_STOP_GOOD && holdRate >= T.HOLD_RATE_WARN && roas < T.ROAS_TARGET)
    return { text: 'Engagement without conversion — audience or LP mismatch', level: 'amber' }
  if (fatigueFlag === 'FATIGUED')
    return { text: 'Genuine fatigue — refresh creative', level: 'red' }
  return { text: 'Healthy', level: 'green' }
}

const DIAG_STYLE = {
  green: { color: '#16A34A', background: 'rgba(22,163,74,0.08)'   },
  amber: { color: '#92400e', background: 'rgba(245,158,11,0.08)'  },
  red:   { color: '#DC2626', background: 'rgba(220,38,38,0.08)'   },
}

const COLS = [
  { key: 'name',           label: 'Name',         isName: true },
  { key: 'spend',          label: 'Spend',         fmt: v => fmtValue(v, 'currency', 'AU') },
  { key: 'impressions',    label: 'Impressions',   fmt: v => fmtValue(v, 'integer') },
  { key: 'views3sec',      label: '3-Sec Views',   fmt: v => fmtValue(v, 'integer') },
  { key: 'thumbStopRatio', label: 'Thumb Stop',    fmt: pct,
    warn: v => v < T.THUMB_STOP_WARN },
  { key: 'views25pct',     label: 'Views 25%',     fmt: v => fmtValue(v, 'integer') },
  { key: 'hookRate',       label: 'Hook Rate',     fmt: pct,
    warn: v => v < T.HOOK_RATE_WARN },
  { key: 'holdRate',       label: 'Hold Rate',     fmt: pct,
    warn: v => v < T.HOLD_RATE_WARN },
  { key: 'ctr',            label: 'CTR',           fmt: v => fmtValue(v, 'percent') },
  { key: 'clickPerView',   label: 'Click/View',    fmt: v => v ? v.toFixed(3) : '—' },
  { key: 'purchases',      label: 'Purchases',     fmt: v => fmtValue(v, 'integer') },
  { key: 'cac',            label: 'CPA',           fmt: v => fmtValue(v, 'currency', 'AU') },
  { key: 'roas',           label: 'ROAS',          fmt: v => fmtValue(v, 'decimal'),
    good: v => v >= T.ROAS_TARGET },
  { key: 'frequency',      label: 'Freq',          fmt: v => v ? v.toFixed(2) : '—' },
  { key: 'diagnosis',      label: 'Diagnosis',     isDiagnosis: true },
]

function Th({ col, sort, onSort }) {
  const active = sort.key === col.key
  return (
    <th
      onClick={() => onSort(col.key)}
      style={{
        paddingBottom: 10, paddingRight: 16, textAlign: 'left', whiteSpace: 'nowrap',
        fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: active ? '#1A1A1A' : '#A3A3A3', cursor: 'pointer', userSelect: 'none',
      }}
    >
      {col.label}{active ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
    </th>
  )
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <svg style={{ position: 'absolute', left: 8, pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 16 16" fill="none">
        <circle cx="6.5" cy="6.5" r="4.5" stroke="#A3A3A3" strokeWidth="1.5" />
        <path d="M10 10l3 3" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          paddingLeft: 28, paddingRight: value ? 26 : 10, paddingTop: 5, paddingBottom: 5,
          fontSize: 12, border: '1px solid #EFEFEC', borderRadius: 6,
          outline: 'none', fontFamily: 'inherit', color: '#1A1A1A',
          background: '#FFFFFF', width: 210, transition: 'border-color 150ms ease',
        }}
        onFocus={e => e.currentTarget.style.borderColor = '#D4D4D4'}
        onBlur={e => e.currentTarget.style.borderColor = '#EFEFEC'}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{ position: 'absolute', right: 7, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A3A3A3', lineHeight: 1 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

export default function VideoPerformanceTab({ filteredRows, picker, groupId, setGroupId }) {
  const [sort,   setSort]   = useState({ key: 'spend', dir: -1 })
  const [search, setSearch] = useState('')

  const groupOpt = GROUP_OPTIONS.find(o => o.id === groupId) ?? GROUP_OPTIONS[2]

  const counts = useMemo(() => ({
    campaign_name: groupByField(filteredRows, 'campaign_name').length,
    adsetName:     groupByAdset(filteredRows).length,
    ad_name:       groupByAd(filteredRows).length,
  }), [filteredRows])

  const rows = useMemo(() => {
    const grouped = groupOpt.groupFn(filteredRows)
      .filter(r => (r.views3sec ?? 0) > 0)
      .map(r => ({ ...r, name: r[groupOpt.nameKey] || r.label || 'Unknown' }))
    const cpvs = grouped.map(r => r.clickPerView ?? 0).filter(v => v > 0).sort((a, b) => a - b)
    const medianCpv = cpvs.length ? cpvs[Math.floor(cpvs.length / 2)] : 0
    return grouped.map(r => ({ ...r, diag: diagnose(r, medianCpv) }))
  }, [filteredRows, groupOpt])

  const sorted = useMemo(() => {
    let base = [...rows].sort((a, b) => {
      if (sort.key === 'name')
        return sort.dir * String(a.name ?? '').localeCompare(String(b.name ?? ''))
      return sort.dir * ((a[sort.key] ?? 0) - (b[sort.key] ?? 0))
    })
    if (search) base = base.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    return base
  }, [rows, sort, search])

  function toggleSort(key) {
    setSort(s => ({ key, dir: s.key === key ? -s.dir : -1 }))
  }

  if (rows.length === 0) {
    return (
      <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>No video data</p>
          <p style={{ fontSize: 13, color: '#A3A3A3' }}>Make sure your sheet includes a <code>3_sec_views</code> column.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <GroupToggle value={groupId} onChange={id => { setGroupId(id); setSort({ key: 'spend', dir: -1 }); setSearch('') }} counts={counts} />
          <SearchBox value={search} onChange={setSearch} placeholder={`Search ${groupOpt.label.toLowerCase()}s`} />
        </div>
        {picker}
      </div>

      <div className="card" style={{ padding: '20px 24px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1500 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
              {COLS.map(col => <Th key={col.key} col={col} sort={sort} onSort={toggleSort} />)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const fatigued = row.fatigueFlag === 'FATIGUED'
              return (
                <tr
                  key={i}
                  style={{
                    borderBottom: '1px solid #F5F5F4',
                    background: fatigued ? 'rgba(220,38,38,0.03)' : undefined,
                  }}
                >
                  {COLS.map(col => {
                    if (col.isName) return (
                      <td key={col.key} style={{ padding: '10px 16px 10px 0', fontSize: 13, fontWeight: 500, color: '#111827', minWidth: 200, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.name}
                      </td>
                    )
                    if (col.isDiagnosis) return (
                      <td key={col.key} style={{ padding: '10px 16px 10px 0', whiteSpace: 'nowrap' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, ...DIAG_STYLE[row.diag.level] }}>
                          {row.diag.text}
                        </span>
                      </td>
                    )
                    const v = row[col.key]
                    const style = { padding: '10px 16px 10px 0', fontSize: 13, whiteSpace: 'nowrap' }
                    if (col.warn?.(v)) { style.color = '#DC2626'; style.fontWeight = 500 }
                    else if (col.good?.(v)) { style.color = '#16A34A'; style.fontWeight = 500 }
                    else style.color = '#1A1A1A'
                    return <td key={col.key} style={style}>{col.fmt ? col.fmt(v) : (v ?? '—')}</td>
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
