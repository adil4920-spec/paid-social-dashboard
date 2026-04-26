import React, { useState, useMemo } from 'react'
import { groupByField, groupByAdset, groupByAd, aggregateRows, computeMetrics } from '../utils/metrics'
import { fmtValue } from '../utils/currency'

// ── Configurable thresholds ────────────────────────────────────────────────
const T = {
  ROAS_GAP_GREEN:     25,   // < 25% gap = healthy
  ROAS_GAP_AMBER:     60,   // 25–60% = monitor
  ATTR_MULTIPLE_WARN:  3,   // > 3× attribution multiple = likely over-attributed
}

const PLATFORM_COLS = [
  { key: 'purchases', label: 'Purchases', fmt: v => fmtValue(v, 'integer') },
  { key: 'revenue',   label: 'Revenue',   fmt: v => fmtValue(v, 'currency', 'AU') },
  { key: 'roas',      label: 'ROAS',      fmt: v => fmtValue(v, 'decimal') },
  { key: 'cac',       label: 'CPA',       fmt: v => fmtValue(v, 'currency', 'AU') },
  { key: 'atc',       label: 'ATCs',      fmt: v => fmtValue(v, 'integer') },
]

const INCR_COLS = [
  { key: 'iPurchases', label: 'Purchases', fmt: v => fmtValue(v, 'integer') },
  { key: 'iRevenue',   label: 'Revenue',   fmt: v => fmtValue(v, 'currency', 'AU') },
  { key: 'iRoas',      label: 'ROAS',      fmt: v => fmtValue(v, 'decimal') },
  { key: 'ncac',       label: 'CPA',       fmt: v => fmtValue(v, 'currency', 'AU') },
  { key: 'iAtc',       label: 'ATCs',      fmt: v => fmtValue(v, 'integer') },
]

const GAP_COLS = [
  { key: 'purchaseGapPct', label: 'Purchase Gap', fmt: v => fmtValue(v, 'percent') },
  { key: 'revenueGapPct',  label: 'Revenue Gap',  fmt: v => fmtValue(v, 'percent') },
  {
    key: 'roasGap', label: 'ROAS Gap', fmt: v => fmtValue(v, 'percent'),
    color: v => v < T.ROAS_GAP_GREEN ? '#16A34A' : v < T.ROAS_GAP_AMBER ? '#92400e' : '#DC2626',
    bgColor: v => v < T.ROAS_GAP_GREEN ? 'rgba(22,163,74,0.06)' : v < T.ROAS_GAP_AMBER ? 'rgba(245,158,11,0.06)' : 'rgba(220,38,38,0.06)',
  },
  {
    key: 'attrMultiple', label: 'Attr. Multiple', fmt: v => v ? v.toFixed(1) + '×' : '—',
    color: v => v > T.ATTR_MULTIPLE_WARN ? '#DC2626' : '#1A1A1A',
  },
]

const GROUP_OPTIONS = [
  { id: 'campaign_name', label: 'Campaign',  groupFn: rows => groupByField(rows, 'campaign_name'), nameKey: 'label' },
  { id: 'adsetName',     label: 'Ad Set',    groupFn: rows => groupByAdset(rows),                  nameKey: 'adsetName' },
  { id: 'ad_name',       label: 'Ad',        groupFn: rows => groupByAd(rows),                     nameKey: 'ad_name' },
]

function GroupToggle({ value, onChange, counts = {} }) {
  return (
    <div style={{ display: 'inline-flex', gap: 0, background: '#F5F5F4', borderRadius: 8, padding: 3 }}>
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

const GH_PLATFORM = { background: '#EEF2FF', color: '#3730A3', borderBottom: '1px solid #C7D2FE' }
const GH_INCR     = { background: '#F0FDF4', color: '#166534', borderBottom: '1px solid #BBF7D0' }
const GH_GAP      = { background: '#FEFCE8', color: '#854D0E', borderBottom: '1px solid #FDE68A' }

function Th({ label, sort, sortKey, onSort, style = {} }) {
  const active = sort.key === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        paddingBottom: 8, paddingTop: 8, paddingRight: 12, textAlign: 'left', whiteSpace: 'nowrap',
        fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em',
        color: active ? '#1A1A1A' : '#A3A3A3', cursor: 'pointer', userSelect: 'none',
        ...style,
      }}
    >
      {label}{active ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
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

export default function AttributionTab({ filteredRows, picker, groupId, setGroupId }) {
  const [sort,   setSort]   = useState({ key: 'spend', dir: -1 })
  const [search, setSearch] = useState('')

  const groupOpt = GROUP_OPTIONS.find(o => o.id === groupId) ?? GROUP_OPTIONS[0]

  const summary = useMemo(() => computeMetrics(aggregateRows(filteredRows)), [filteredRows])

  const counts = useMemo(() => ({
    campaign_name: groupByField(filteredRows, 'campaign_name').length,
    adsetName:     groupByAdset(filteredRows).length,
    ad_name:       groupByAd(filteredRows).length,
  }), [filteredRows])

  const rows = useMemo(() => {
    const grouped = groupOpt.groupFn(filteredRows)
    return grouped.map(r => ({ ...r, name: r[groupOpt.nameKey] || r.label || 'Unknown' }))
  }, [filteredRows, groupOpt])

  const visible = useMemo(() => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <GroupToggle value={groupId} onChange={id => { setGroupId(id); setSort({ key: 'spend', dir: -1 }); setSearch('') }} counts={counts} />
          <SearchBox value={search} onChange={setSearch} placeholder={`Search ${groupOpt.label.toLowerCase()}s`} />
        </div>
        {picker}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1280 }}>
          <thead>
            {/* Group header row */}
            <tr>
              <th colSpan={2} style={{ padding: '8px 20px 0 12px', borderBottom: '1px solid #F3F4F6' }} />
              <th colSpan={PLATFORM_COLS.length} style={{ padding: '8px 12px 0 20px', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textAlign: 'center', borderLeft: '2px solid #C7D2FE', ...GH_PLATFORM }}>
                PLATFORM (7d click + 1d view)
              </th>
              <th colSpan={INCR_COLS.length} style={{ padding: '8px 12px 0 20px', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textAlign: 'center', borderLeft: '2px solid #BBF7D0', ...GH_INCR }}>
                INCREMENTAL
              </th>
              <th colSpan={GAP_COLS.length} style={{ padding: '8px 12px 0 20px', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textAlign: 'center', borderLeft: '2px solid #FDE68A', ...GH_GAP }}>
                GAP ANALYSIS
              </th>
            </tr>
            {/* Column header row */}
            <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
              <Th label="Name"  sortKey="name"  sort={sort} onSort={toggleSort} style={{ paddingLeft: 20, minWidth: 180 }} />
              <Th label="Spend" sortKey="spend" sort={sort} onSort={toggleSort} style={{ paddingRight: 20 }} />
              {PLATFORM_COLS.map((c, i) => <Th key={c.key} label={c.label} sortKey={c.key} sort={sort} onSort={toggleSort} style={{ borderLeft: i === 0 ? '2px solid #E0E7FF' : undefined, paddingLeft: i === 0 ? 20 : undefined, paddingRight: i === PLATFORM_COLS.length - 1 ? 20 : undefined }} />)}
              {INCR_COLS.map((c, i) => <Th key={c.key} label={c.label} sortKey={c.key} sort={sort} onSort={toggleSort} style={{ borderLeft: i === 0 ? '2px solid #D1FAE5' : undefined, paddingLeft: i === 0 ? 20 : undefined, paddingRight: i === INCR_COLS.length - 1 ? 20 : undefined }} />)}
              {GAP_COLS.map((c, i) => <Th key={c.key} label={c.label} sortKey={c.key} sort={sort} onSort={toggleSort} style={{ borderLeft: i === 0 ? '2px solid #FEF3C7' : undefined, paddingLeft: i === 0 ? 20 : undefined }} />)}
            </tr>
          </thead>
          <tbody>
            {/* Pinned total row */}
            <tr style={{ background: '#FAFAF9', borderBottom: '2px solid #EFEFEC' }}>
              <td style={{ padding: '10px 12px 10px 20px', fontSize: 12, fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Account Total</td>
              <td style={{ padding: '10px 20px 10px 12px', fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{fmtValue(summary.spend, 'currency', 'AU')}</td>
              {PLATFORM_COLS.map((c, i) => (
                <td key={c.key} style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: i === 0 ? 20 : 12, paddingRight: i === PLATFORM_COLS.length - 1 ? 20 : 12, fontSize: 13, fontWeight: 600, color: '#1A1A1A', borderLeft: i === 0 ? '2px solid #E0E7FF' : undefined, whiteSpace: 'nowrap' }}>
                  {c.fmt(summary[c.key])}
                </td>
              ))}
              {INCR_COLS.map((c, i) => (
                <td key={c.key} style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: i === 0 ? 20 : 12, paddingRight: i === INCR_COLS.length - 1 ? 20 : 12, fontSize: 13, fontWeight: 600, color: '#1A1A1A', borderLeft: i === 0 ? '2px solid #D1FAE5' : undefined, whiteSpace: 'nowrap' }}>
                  {c.fmt(summary[c.key])}
                </td>
              ))}
              {GAP_COLS.map((c, i) => {
                const v = summary[c.key]
                return (
                  <td key={c.key} style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: i === 0 ? 20 : 12, paddingRight: 12, fontSize: 13, fontWeight: 600, borderLeft: i === 0 ? '2px solid #FEF3C7' : undefined, whiteSpace: 'nowrap', color: c.color ? c.color(v) : '#1A1A1A', background: c.bgColor ? c.bgColor(v) : undefined }}>
                    {c.fmt(v)}
                  </td>
                )
              })}
            </tr>
            {/* Data rows */}
            {visible.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid #F5F5F4' }}>
                <td style={{ padding: '10px 12px 10px 20px', fontSize: 13, fontWeight: 500, color: '#111827', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.name}
                </td>
                <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 20, fontSize: 13, color: '#1A1A1A', whiteSpace: 'nowrap' }}>
                  {fmtValue(row.spend, 'currency', 'AU')}
                </td>
                {PLATFORM_COLS.map((c, i) => (
                  <td key={c.key} style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: i === 0 ? 20 : 12, paddingRight: i === PLATFORM_COLS.length - 1 ? 20 : 12, fontSize: 13, color: '#1A1A1A', borderLeft: i === 0 ? '2px solid #E0E7FF' : undefined, whiteSpace: 'nowrap' }}>
                    {c.fmt(row[c.key])}
                  </td>
                ))}
                {INCR_COLS.map((c, i) => (
                  <td key={c.key} style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: i === 0 ? 20 : 12, paddingRight: i === INCR_COLS.length - 1 ? 20 : 12, fontSize: 13, color: '#1A1A1A', borderLeft: i === 0 ? '2px solid #D1FAE5' : undefined, whiteSpace: 'nowrap' }}>
                    {c.fmt(row[c.key])}
                  </td>
                ))}
                {GAP_COLS.map((c, i) => {
                  const v = row[c.key]
                  return (
                    <td key={c.key} style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: i === 0 ? 20 : 12, paddingRight: 12, fontSize: 13, fontWeight: 500, borderLeft: i === 0 ? '2px solid #FEF3C7' : undefined, whiteSpace: 'nowrap', color: c.color ? c.color(v) : '#1A1A1A', background: c.bgColor ? c.bgColor(v) : undefined }}>
                      {c.fmt(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#A3A3A3' }}>No rows match the current filter.</p>
          </div>
        )}
      </div>
    </div>
  )
}
