import React, { useState, useMemo, useEffect } from 'react'
import CreativePerformanceTab from './CreativePerformanceTab'
import AttributionTab         from './AttributionTab'
import { Line } from 'react-chartjs-2'
import {
  groupByField, groupByAdset, groupByAd,
  groupByDate, computeMetrics, aggregateRows,
} from '../utils/metrics'
import { fmtValue } from '../utils/currency'

// ── Column-set config ─────────────────────────────────────────────────────
const COL_SET_TABS = [
  { id: 'standard',    label: 'Standard'    },
  { id: 'incremental', label: 'Incremental' },
  { id: 'video',       label: 'Creative'    },
]

const GROUP_TABS = [
  { id: 'campaign_name', label: 'Campaign' },
  { id: 'adsetName',     label: 'Ad Set'   },
  { id: 'ad_name',       label: 'Ad'       },
]

// ── Constants ──────────────────────────────────────────────────────────────

const CHART_METRICS = [
  { key: 'revenue',     label: 'Revenue',    format: 'currency' },
  { key: 'spend',       label: 'Spend',      format: 'currency' },
  { key: 'roas',        label: 'ROAS',       format: 'decimal'  },
  { key: 'purchases',   label: 'Purchases',  format: 'integer'  },
  { key: 'cac',         label: 'CPP',        format: 'currency' },
  { key: 'impressions', label: 'Impressions',format: 'integer'  },
  { key: 'cpm',         label: 'CPM',        format: 'currency' },
  { key: 'ctr',         label: 'CTR',        format: 'percent'  },
  { key: 'atc',         label: 'ATCs',       format: 'integer'  },
  { key: 'frequency',   label: 'Freq',       format: null,
    render: v => v != null ? v.toFixed(2) : '—' },
]

// ── Column color helpers ───────────────────────────────────────────────────
const iRoasColor   = v => !v ? '#A3A3A3' : v >= 3.5 ? '#16A34A' : v >= 2 ? '#D97706' : '#DC2626'
const roasGapColor = v => v == null ? '#A3A3A3' : v < 25 ? '#16A34A' : v < 60 ? '#D97706' : '#DC2626'
const thumbColor   = v => v == null ? '#A3A3A3' : v >= 0.30 ? '#16A34A' : v >= 0.25 ? '#D97706' : '#DC2626'
const hookColor    = v => v == null ? '#A3A3A3' : v >= 0.20 ? '#16A34A' : v >= 0.15 ? '#D97706' : '#DC2626'
const holdColor    = v => v == null ? '#A3A3A3' : v >= 0.60 ? '#16A34A' : v >= 0.50 ? '#D97706' : '#DC2626'

const COL_SETS = {
  standard: [
    { key: 'spend',           label: 'Spend',        format: 'currency' },
    { key: 'purchases',       label: 'Purchases',    format: 'integer'  },
    { key: 'revenue',         label: 'Revenue',      format: 'currency' },
    { key: 'cac',             label: 'CPP',          format: 'currency' },
    { key: 'roas',            label: 'ROAS',         format: 'decimal'  },
    { key: 'ctr',             label: 'CTR',          render: v => v != null ? v.toFixed(2) + '%' : '—' },
    { key: 'reach',           label: 'Reach',        format: 'integer'  },
    { key: 'cpm',             label: 'CPM',          format: 'currency' },
    { key: 'frequency',       label: 'Frequency',    render: v => v != null ? v.toFixed(2) : '—' },
    { key: 'checkouts',       label: 'Checkouts',    format: 'integer'  },
    { key: 'costPerCheckout', label: 'Cost/Checkout',format: 'currency' },
    { key: 'atc',             label: 'Add to Cart',  format: 'integer'  },
    { key: 'costPerAtc',      label: 'Cost/ATC',     format: 'currency' },
  ],
  incremental: [
    { key: 'spend',        label: 'Spend',       format: 'currency' },
    { key: 'revenue',      label: 'Plat. Rev',   format: 'currency' },
    { key: 'roas',         label: 'Plat. ROAS',  format: 'decimal'  },
    { key: 'iRevenue',     label: 'Incr. Rev',   format: 'currency' },
    { key: 'iRoas',        label: 'iROAS',       format: 'decimal',  colorFn: iRoasColor },
    { key: 'iPurchases',   label: 'Incr. Purch', format: 'integer'  },
    { key: 'ncac',         label: 'NCAC',        format: 'currency' },
    { key: 'roasGap',      label: 'ROAS Gap',    render: v => v != null ? v.toFixed(1) + '%' : '—', colorFn: roasGapColor },
    { key: 'attrMultiple', label: 'Attr ×',      render: v => v != null ? v.toFixed(2) + '×' : '—' },
  ],
  video: [
    { key: 'spend',          label: 'Spend',      format: 'currency' },
    { key: 'impressions',    label: 'Impr.',      format: 'integer'  },
    { key: 'thumbStopRatio', label: 'Thumb Stop', render: v => v != null ? (v * 100).toFixed(1) + '%' : '—', colorFn: thumbColor },
    { key: 'hookRate',       label: 'Hook Rate',  render: v => v != null ? (v * 100).toFixed(1) + '%' : '—', colorFn: hookColor  },
    { key: 'holdRate',       label: 'Hold Rate',  render: v => v != null ? (v * 100).toFixed(1) + '%' : '—', colorFn: holdColor  },
    { key: 'views3sec',      label: '3s Views',   format: 'integer'  },
    { key: 'views25pct',     label: '25% Views',  format: 'integer'  },
    { key: 'ctr',            label: 'CTR',        render: v => v != null ? v.toFixed(2) + '%' : '—' },
    { key: 'frequency',      label: 'Freq',       render: v => v != null ? v.toFixed(2) : '—' },
  ],
}

const DEFAULT_WIDTHS = {
  spend: 100, revenue: 100, roas: 75, purchases: 90,
  cac: 85, impressions: 105, cpm: 75, ctr: 65, frequency: 90,
  reach: 90, checkouts: 100, costPerCheckout: 115, atc: 100, costPerAtc: 90,
  iRevenue: 100, iRoas: 75, iPurchases: 110, ncac: 85, roasGap: 90, attrMultiple: 70,
  thumbStopRatio: 105, hookRate: 95, holdRate: 90, views3sec: 85, views25pct: 95,
}

function MiniPills({ label, tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {label && <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#A3A3A3' }}>{label}</span>}
      <div style={{ display: 'inline-flex', background: '#F5F5F4', borderRadius: 6, padding: 2, gap: 1 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => onChange(t.id)}
            style={{
              padding: '4px 12px', borderRadius: 5, fontSize: 12, fontWeight: 500,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms ease',
              background: active === t.id ? '#FFFFFF' : 'transparent',
              color: active === t.id ? '#1A1A1A' : '#737373',
              boxShadow: active === t.id ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >{t.label}</button>
        ))}
      </div>
    </div>
  )
}

function ColPicker({ colSet, setColSet }) {
  return <MiniPills label={null} tabs={COL_SET_TABS} active={colSet} onChange={setColSet} />
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <svg style={{ position: 'absolute', left: 8, pointerEvents: 'none', flexShrink: 0 }} width="13" height="13" viewBox="0 0 16 16" fill="none">
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

function roasColor(v) {
  if (!v) return '#A3A3A3'
  if (v >= 3.5) return '#16A34A'
  if (v >= 2)   return '#92400e'
  return '#DC2626'
}

function fmtCol(col, row) {
  const v = row[col.key]
  if (col.render) return col.render(v)
  return fmtValue(v, col.format, 'AU')
}

// ── Resize helper ──────────────────────────────────────────────────────────
function startResize(key, e, colWidths, setColWidths) {
  e.preventDefault()
  const startX = e.clientX
  const startW = colWidths[key] || e.currentTarget.parentElement.offsetWidth
  const onMove = ev => setColWidths(w => ({ ...w, [key]: Math.max(60, startW + ev.clientX - startX) }))
  const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ── Metric trend chart ─────────────────────────────────────────────────────
function MetricChart({ rawRows }) {
  const [metric, setMetric] = useState('revenue')
  const def = CHART_METRICS.find(m => m.key === metric)

  const dailyRows = useMemo(() =>
    groupByDate(rawRows).map(d => ({ ...d, ...computeMetrics(d) }))
  , [rawRows])

  const labels = dailyRows.map(d =>
    new Date(d.date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  )
  const values = dailyRows.map(d => d[metric] ?? null)

  const chartData = {
    labels,
    datasets: [{
      data: values,
      borderColor: '#1A1A1A',
      backgroundColor: 'rgba(26,26,26,0.04)',
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 1.5,
      pointBorderColor: '#1A1A1A',
      pointBackgroundColor: '#ffffff',
      spanGaps: true,
    }],
  }

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1A1A1A', padding: 10, cornerRadius: 8,
        titleColor: '#A3A3A3', titleFont: { size: 11, family: 'Inter' },
        bodyColor: '#FFFFFF', bodyFont: { size: 13, family: 'Inter' },
        callbacks: {
          label: ctx => {
            const v = ctx.parsed.y
            if (def.render) return '  ' + def.render(v)
            return '  ' + fmtValue(v, def.format, 'AU')
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { font: { size: 11, family: 'Inter' }, color: '#A3A3A3', maxTicksLimit: 10, maxRotation: 0 },
      },
      y: {
        grid: { color: '#F5F5F4', drawBorder: false },
        border: { display: false },
        ticks: {
          font: { size: 11, family: 'Inter' }, color: '#A3A3A3',
          callback: v => {
            if (def.format === 'currency') return v >= 1000 ? 'A$' + (v / 1000).toFixed(1) + 'k' : 'A$' + v.toFixed(0)
            if (def.format === 'percent')  return v.toFixed(1) + '%'
            if (def.format === 'decimal')  return v.toFixed(2)
            return Math.round(v).toLocaleString()
          },
        },
      },
    },
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CHART_METRICS.map(m => (
          <button key={m.key} onClick={() => setMetric(m.key)}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: metric === m.key ? 500 : 400,
              border: '1px solid', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 150ms ease',
              borderColor: metric === m.key ? '#1E3A8A' : '#EFEFEC',
              background: metric === m.key ? '#1E3A8A' : 'transparent',
              color: metric === m.key ? '#FFFFFF' : '#737373',
            }}>
            {m.label}
          </button>
        ))}
      </div>
      <div style={{ height: 240 }}>
        {dailyRows.length >= 2
          ? <Line data={chartData} options={chartOpts} />
          : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, color: '#A3A3A3' }}>Not enough data to plot a trend.</p>
            </div>
        }
      </div>
    </div>
  )
}

// ── Summary stat cards ─────────────────────────────────────────────────────
function SummaryStats({ totals, levelLabel, name }) {
  const items = [
    { label: 'Spend',     value: fmtValue(totals.spend,     'currency', 'AU') },
    { label: 'Revenue',   value: fmtValue(totals.revenue,   'currency', 'AU') },
    { label: 'ROAS',      value: fmtValue(totals.roas,      'decimal') },
    { label: 'Purchases', value: fmtValue(totals.purchases, 'integer') },
    { label: 'CPP',       value: fmtValue(totals.cac,       'currency', 'AU') },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {levelLabel && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="metric-label">{levelLabel}</span>
          {name && <span style={{ fontSize: 13, fontWeight: 400, color: '#737373' }}>{name}</span>}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {items.map(s => (
          <div key={s.label} className="card" style={{ padding: '16px 20px', minWidth: 110, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A3A3A3' }}>{s.label}</span>
            <span style={{ fontSize: 24, fontWeight: 600, color: s.accent ?? '#1A1A1A', letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sortable data table (shared for campaigns / adsets / ads) ──────────────
function SortableTable({ data, nameKey, nameLabel, onRowClick, rawRows, cols = COL_SETS.standard }) {
  const [sort,      setSort]      = useState({ key: 'spend', dir: -1 })
  const [colWidths, setColWidths] = useState({ ...DEFAULT_WIDTHS })

  const sorted = useMemo(() =>
    [...data].sort((a, b) => {
      if (sort.key === nameKey) return sort.dir * String(a[nameKey]).localeCompare(String(b[nameKey]))
      return sort.dir * ((a[sort.key] ?? 0) - (b[sort.key] ?? 0))
    })
  , [data, sort, nameKey])

  const totals    = useMemo(() => computeMetrics(aggregateRows(rawRows)), [rawRows])
  const metricW   = cols.reduce((a, c) => a + (colWidths[c.key] ?? 80), 0)
  const allCols   = [{ key: nameKey, label: nameLabel, isName: true }, ...cols]

  function toggleSort(key) {
    setSort(s => ({ key, dir: s.key === key ? -s.dir : -1 }))
  }

  return (
    <div className="overflow-x-auto" style={{ marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20 }}>
      <table className="text-sm w-full" style={{ tableLayout: 'auto', minWidth: metricW + 220 }}>
        <colgroup>
          {allCols.map(col => (
            <col key={col.key} style={col.isName ? undefined : { width: colWidths[col.key] }} />
          ))}
        </colgroup>
        <thead>
          <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
            {allCols.map(col => (
              <th key={col.key}
                  className="tbl-th relative select-none cursor-pointer"
                  style={col.isName ? undefined : { width: colWidths[col.key] }}
                  onClick={() => toggleSort(col.key)}>
                {col.label}
                {sort.key === col.key && <span className="ml-1 text-[#9ca3af]">{sort.dir === -1 ? '↓' : '↑'}</span>}
                {!col.isName && (
                  <div
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-indigo-300 opacity-0 hover:opacity-100 transition-opacity"
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => startResize(col.key, e, colWidths, setColWidths)}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i}
                className={onRowClick ? 'cursor-pointer transition-colors' : ''}
                onMouseEnter={onRowClick ? e => e.currentTarget.style.background = '#FAFAF9' : undefined}
                onMouseLeave={onRowClick ? e => e.currentTarget.style.background = '' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {allCols.map(col => (
                <td key={col.key} className="tbl-td"
                    style={col.isName
                      ? { whiteSpace: 'nowrap' }
                      : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {col.isName
                    ? <span className="font-medium text-[#111827]">{row[nameKey]}</span>
                    : col.colorFn
                    ? <span style={{ color: col.colorFn(row[col.key]), fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{fmtCol(col, row)}</span>
                    : fmtCol(col, row)
                  }
                </td>
              ))}
            </tr>
          ))}
          {/* Totals row */}
          <tr style={{ borderTop: '2px solid #f3f4f6', background: '#fafafa' }}>
            {allCols.map(col => (
              <td key={col.key} className="py-2.5 pr-4 last:pr-0 text-sm font-semibold"
                  style={{ whiteSpace: 'nowrap', color: '#374151' }}>
                {col.isName
                  ? <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">Total</span>
                  : fmtCol(col, totals)
                }
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Level stepper ──────────────────────────────────────────────────────────
const LEVEL_STEPS = ['Campaigns', 'Ad Sets', 'Ads', 'Ad']

function LevelStepper({ step }) {
  // step: 0=campaigns list, 1=adsets inside campaign, 2=ads inside adset, 3=single ad
  return (
    <div className="flex items-center gap-1">
      {LEVEL_STEPS.map((label, i) => {
        const isCurrent = i === step
        const isPast    = i < step
        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                <path d="M4 2l4 4-4 4" stroke={i <= step ? '#9ca3af' : '#e5e7eb'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            <span
              style={{
                padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
                ...(isCurrent
                  ? { background: '#1E3A8A', color: '#FFFFFF' }
                  : isPast
                  ? { background: '#F5F5F4', color: '#737373' }
                  : { color: '#D4D4D4' })
              }}
            >
              {label}
            </span>
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────
function Breadcrumb({ step, crumbs }) {
  const parent = [...crumbs].reverse().find(c => c.onClick)
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <LevelStepper step={step} />
        <div className="flex items-center gap-1.5 flex-wrap">
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ fontSize: 12, color: '#D4D4D4' }}>/</span>}
              {c.onClick
                ? <button style={{ fontSize: 12, color: '#A3A3A3', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 150ms ease' }} onMouseEnter={e => e.currentTarget.style.color = '#737373'} onMouseLeave={e => e.currentTarget.style.color = '#A3A3A3'} onClick={c.onClick}>{c.label}</button>
                : <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A' }}>{c.label}</span>
              }
            </React.Fragment>
          ))}
        </div>
      </div>
      {parent && (
        <button
          onClick={parent.onClick}
          className="btn-ghost"
          style={{ fontSize: 13, fontWeight: 400 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M7 2L3 6l4 4" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
      )}
    </div>
  )
}

// ── Ad preview panel ───────────────────────────────────────────────────────
function AdPreviewCard({ previewLink }) {
  const [status, setStatus] = useState('loading') // loading | ready | failed

  useEffect(() => {
    setStatus('loading')
  }, [previewLink])

  if (!previewLink) {
    return (
      <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="metric-label">Ad Preview</span>
        <p style={{ fontSize: 13, color: '#A3A3A3' }}>No preview link attached to this ad.</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="metric-label">Ad Preview</span>
        <a
          href={previewLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 12, color: '#1E3A8A', fontWeight: 500, textDecoration: 'none',
            padding: '4px 10px', border: '1px solid #EFEFEC', borderRadius: 6,
            transition: 'border-color 150ms ease',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#D4D4D4'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#EFEFEC'}
        >
          Open in Meta
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 10L10 2M10 2H5M10 2v5" stroke="#1E3A8A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      </div>

      {/* Frame — centred at 390px, phone-feed width */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 390, position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #EFEFEC', background: '#F9FAFB' }}>
          {/* Loading / failed overlay */}
          {status !== 'ready' && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 2,
              background: '#F9FAFB', minHeight: 500,
            }}>
              {status === 'loading' && (
                <>
                  <div style={{ width: 18, height: 18, border: '1.5px solid #1A1A1A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <p style={{ fontSize: 13, color: '#A3A3A3' }}>Loading preview…</p>
                </>
              )}
              {status === 'failed' && (
                <>
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#D4D4D4" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82V15.18a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                  </svg>
                  <p style={{ fontSize: 13, color: '#A3A3A3', textAlign: 'center', maxWidth: 200, lineHeight: 1.5 }}>
                    Preview can't be embedded.
                  </p>
                  <a
                    href={previewLink} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 13, color: '#1E3A8A', fontWeight: 500, textDecoration: 'none' }}
                  >
                    Open in Meta →
                  </a>
                </>
              )}
            </div>
          )}
          <iframe
            key={previewLink}
            src={previewLink}
            title="Ad preview"
            scrolling="no"
            onLoad={() => setStatus('ready')}
            onError={() => setStatus('failed')}
            style={{
              width: 390, height: 700, border: 'none', display: 'block',
              opacity: status === 'ready' ? 1 : 0,
              transition: 'opacity 300ms ease',
            }}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
          />
        </div>
      </div>
    </div>
  )
}

// ── Level 4: Ad view (single ad trend) ────────────────────────────────────
function AdView({ campaign, adset, ad, filteredRows, onBackToAdset, onBackToCampaign, onBackToAll }) {
  const rawRows = useMemo(() =>
    filteredRows.filter(r =>
      r.adsetName === adset.adsetName &&
      r.ad_name === ad.ad_name
    )
  , [filteredRows, adset, ad])

  const totals      = useMemo(() => computeMetrics(aggregateRows(rawRows)), [rawRows])
  const previewLink = useMemo(() => rawRows.find(r => r.previewLink)?.previewLink ?? null, [rawRows])

  return (
    <div className="space-y-5">
      <Breadcrumb step={3} crumbs={[
        { label: 'All Campaigns', onClick: onBackToAll },
        { label: campaign.campaign_name, onClick: onBackToCampaign },
        { label: adset.adsetName, onClick: onBackToAdset },
        { label: ad.ad_name },
      ]} />

      <SummaryStats totals={totals} levelLabel="Ad" name={ad.ad_name} />

      {/* Two-column layout when preview is available */}
      {previewLink ? (
        <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: 20, alignItems: 'start' }}>
          <AdPreviewCard previewLink={previewLink} />
          <MetricChart rawRows={rawRows} />
        </div>
      ) : (
        <>
          <AdPreviewCard previewLink={null} />
          <MetricChart rawRows={rawRows} />
        </>
      )}
    </div>
  )
}

// ── Level 3: Adset view (ads + trend) ─────────────────────────────────────
function AdsetView({ campaign, adset, filteredRows, onBackToCampaign, onBackToAll, onSelectAd, cols }) {
  const rawRows = useMemo(() =>
    filteredRows.filter(r => r.adsetName === adset.adsetName)
  , [filteredRows, adset])

  const ads    = useMemo(() => groupByAd(rawRows),             [rawRows])
  const totals = useMemo(() => computeMetrics(aggregateRows(rawRows)), [rawRows])

  return (
    <div className="space-y-5">
      <Breadcrumb step={2} crumbs={[
        { label: 'All Campaigns', onClick: onBackToAll },
        { label: campaign.campaign_name, onClick: onBackToCampaign },
        { label: adset.adsetName },
      ]} />

      <SummaryStats totals={totals} levelLabel="Ad Set" name={adset.adsetName} />

      <MetricChart rawRows={rawRows} />

      <div className="card space-y-3">
        <p className="metric-label">Ads <span className="helper-text font-normal ml-1">— {ads.length} · click to drill in</span></p>
        <SortableTable
          data={ads}
          nameKey="ad_name"
          nameLabel="Ad"
          onRowClick={onSelectAd}
          rawRows={rawRows}
          cols={cols}
        />
      </div>
    </div>
  )
}

// ── Level 2: Campaign view (adsets + trend) ────────────────────────────────
function CampaignView({ campaign, filteredRows, onBack, onSelectAdset, cols }) {
  const rawRows = useMemo(() =>
    filteredRows.filter(r => r.campaign_name === campaign.campaign_name)
  , [filteredRows, campaign])

  const adsets = useMemo(() => groupByAdset(rawRows), [rawRows])
  const totals = useMemo(() => computeMetrics(aggregateRows(rawRows)), [rawRows])

  return (
    <div className="space-y-5">
      <Breadcrumb step={1} crumbs={[
        { label: 'All Campaigns', onClick: onBack },
        { label: campaign.campaign_name },
      ]} />

      <SummaryStats totals={totals} levelLabel="Campaign" name={campaign.campaign_name} />

      <MetricChart rawRows={rawRows} />

      <div className="card space-y-3">
        <p className="metric-label">Ad Sets <span className="helper-text font-normal ml-1">— {adsets.length} · click to drill in</span></p>
        <SortableTable
          data={adsets}
          nameKey="adsetName"
          nameLabel="Ad Set"
          onRowClick={onSelectAdset}
          rawRows={rawRows}
          cols={cols}
        />
      </div>
    </div>
  )
}

// ── Smooth SVG path (catmull-rom → cubic bezier) ──────────────────────────
function smoothSVGPath(pts, tension = 0.35) {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

// ── Overview sparkline ─────────────────────────────────────────────────────
function OverviewSparkline({ data, color, id }) {
  const vals = (data || []).filter(v => v != null && !isNaN(v))
  if (vals.length < 2) return <div style={{ height: 52 }} />
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const W = 200, H = 52, PX = 2, PY = 4
  const pts = vals.map((v, i) => [
    PX + (i / (vals.length - 1)) * (W - 2 * PX),
    PY + (1 - (v - min) / range) * (H - 2 * PY),
  ])
  const linePath = smoothSVGPath(pts)
  const last = pts[pts.length - 1]
  const fillPath = linePath + ` L${last[0].toFixed(1)},${H} L${PX},${H} Z`
  const gid = `sg-ov-${id}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 52, display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gid})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Overview metric modal ──────────────────────────────────────────────────
function OverviewMetricModal({ card, dailyData, onClose }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  const labels = dailyData.map(d =>
    new Date(d.date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  )
  const values = dailyData.map(d => d[card.metricKey] ?? null)

  const chartData = {
    labels,
    datasets: [{
      data: values,
      borderColor: card.color,
      backgroundColor: card.color + '14',
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 5,
      borderWidth: 2,
      pointBorderColor: card.color,
      pointBackgroundColor: '#ffffff',
      spanGaps: true,
    }],
  }

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1A1A1A', padding: 10, cornerRadius: 8,
        titleColor: '#A3A3A3', titleFont: { size: 11, family: 'Inter' },
        bodyColor: '#FFFFFF', bodyFont: { size: 13, family: 'Inter' },
        callbacks: {
          label: ctx => {
            const v = ctx.parsed.y
            if (card.render) return '  ' + card.render(v)
            return '  ' + fmtValue(v, card.format, 'AU')
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { font: { size: 11, family: 'Inter' }, color: '#A3A3A3', maxTicksLimit: 12, maxRotation: 0 },
      },
      y: {
        grid: { color: '#F5F5F4' },
        border: { display: false },
        ticks: {
          font: { size: 11, family: 'Inter' }, color: '#A3A3A3',
          callback: v => {
            if (card.format === 'currency') return v >= 1000 ? 'A$' + (v / 1000).toFixed(1) + 'k' : 'A$' + v.toFixed(0)
            if (card.format === 'percent')  return v.toFixed(1) + '%'
            if (card.format === 'decimal')  return v.toFixed(2)
            return Math.round(v).toLocaleString()
          },
        },
      },
    },
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', letterSpacing: '-0.01em' }}>{card.label}</p>
            <p style={{ fontSize: 13, color: '#A3A3A3', marginTop: 2 }}>Daily trend · {dailyData.length} days</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <p style={{ fontSize: 24, fontWeight: 600, color: card.accent ?? '#1A1A1A', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{card.value}</p>
            <button
              onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #EFEFEC', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A3A3A3', fontSize: 14, flexShrink: 0 }}
            >✕</button>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #EFEFEC', margin: '16px 0' }} />
        <div style={{ height: 280 }}>
          <Line data={chartData} options={chartOpts} />
        </div>
      </div>
    </div>
  )
}

// ── Campaign overview (metrics + snapshot) ────────────────────────────────
function CampaignOverview({ filteredRows }) {
  const [openCard, setOpenCard] = useState(null)
  const metrics   = useMemo(() => computeMetrics(aggregateRows(filteredRows)), [filteredRows])
  const campaigns = useMemo(() =>
    groupByField(filteredRows, 'campaign_name').map(g => ({ ...g, campaign_name: g.label }))
  , [filteredRows])

  // Daily data sorted by date for sparklines
  const dailyData = useMemo(() =>
    groupByDate(filteredRows)
      .map(d => ({ ...d, ...computeMetrics(d) }))
      .sort((a, b) => a.date.localeCompare(b.date))
  , [filteredRows])

  // Delta: compare avg of second half vs first half of the period
  function halfDelta(key, higherIsBetter = true) {
    if (dailyData.length < 4) return null
    const mid = Math.floor(dailyData.length / 2)
    const avgA = dailyData.slice(0, mid).reduce((s, d) => s + (d[key] ?? 0), 0) / mid
    const avgB = dailyData.slice(mid).reduce((s, d) => s + (d[key] ?? 0), 0) / (dailyData.length - mid)
    if (avgA === 0) return null
    const pct = ((avgB - avgA) / avgA) * 100
    return { pct, positive: higherIsBetter ? pct >= 0 : pct <= 0 }
  }

  const cards = [
    { label: 'Spend',       metricKey: 'spend',       format: 'currency', value: fmtValue(metrics.spend,       'currency', 'AU'), color: '#1A1A1A', higherIsBetter: false },
    { label: 'Revenue',     metricKey: 'revenue',     format: 'currency', value: fmtValue(metrics.revenue,     'currency', 'AU'), color: '#1E3A8A', higherIsBetter: true  },
    { label: 'ROAS',        metricKey: 'roas',        format: 'decimal',  value: fmtValue(metrics.roas,        'decimal'),        color: '#1A1A1A', higherIsBetter: true },
    { label: 'Purchases',   metricKey: 'purchases',   format: 'integer',  value: fmtValue(metrics.purchases,   'integer'),        color: '#1A1A1A', higherIsBetter: true  },
    { label: 'CPP',         metricKey: 'cac',         format: 'currency', value: fmtValue(metrics.cac,         'currency', 'AU'), color: '#1A1A1A', higherIsBetter: false },
    { label: 'Impressions', metricKey: 'impressions', format: 'integer',  value: fmtValue(metrics.impressions, 'integer'),        color: '#1A1A1A', higherIsBetter: true  },
  ]

  // Snapshot lines
  const lines = []
  if (metrics.spend > 0) {
    lines.push(
      `${fmtValue(metrics.spend, 'currency', 'AU')} spend across ${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}, returning ${fmtValue(metrics.revenue, 'currency', 'AU')} revenue at ${fmtValue(metrics.roas, 'decimal')} ROAS.`
    )
  }
  const topRoas  = [...campaigns].sort((a, b) => b.roas  - a.roas)[0]
  const topSpend = campaigns[0]
  if (topRoas && topSpend && topRoas.campaign_name !== topSpend.campaign_name) {
    const pct = metrics.spend > 0 ? ((topSpend.spend / metrics.spend) * 100).toFixed(0) : 0
    const shortRoas  = topRoas.campaign_name.length > 40 ? topRoas.campaign_name.slice(0, 40) + '…' : topRoas.campaign_name
    const shortSpend = topSpend.campaign_name.length > 40 ? topSpend.campaign_name.slice(0, 40) + '…' : topSpend.campaign_name
    lines.push(
      `Best ROAS: ${shortRoas} at ${fmtValue(topRoas.roas, 'decimal')} · Highest spend: ${shortSpend} (${pct}% of total).`
    )
  } else if (topRoas) {
    const pct   = metrics.spend > 0 ? ((topRoas.spend / metrics.spend) * 100).toFixed(0) : 0
    const short = topRoas.campaign_name.length > 50 ? topRoas.campaign_name.slice(0, 50) + '…' : topRoas.campaign_name
    lines.push(`Top campaign: ${short} · ${fmtValue(topRoas.roas, 'decimal')} ROAS · ${pct}% of spend.`)
  }
  if (metrics.ctr > 0) {
    lines.push(`CTR ${metrics.ctr.toFixed(2)}% · CPM ${fmtValue(metrics.cpm, 'currency', 'AU')} · Avg. frequency ${metrics.frequency.toFixed(2)}.`)
  }

  if (filteredRows.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Metric cards with sparklines */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {cards.map(c => {
          const delta = halfDelta(c.metricKey, c.higherIsBetter)
          const sparkVals = dailyData.map(d => d[c.metricKey])
          return (
            <div
              key={c.label}
              className="card"
              onClick={() => setOpenCard(c)}
              style={{ padding: '18px 20px 14px', display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 150ms ease, box-shadow 150ms ease' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4D4D4'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#EFEFEC'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="metric-label">{c.label}</span>
                {delta && (
                  <span style={{ fontSize: 11, fontWeight: 500, color: delta.positive ? '#16A34A' : '#DC2626' }}>
                    {delta.pct >= 0 ? '+' : ''}{delta.pct.toFixed(1)}%
                  </span>
                )}
              </div>
              <span style={{ fontSize: 22, fontWeight: 600, color: c.accent ?? '#1A1A1A', letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 12 }}>
                {c.value}
              </span>
              <div style={{ marginLeft: -20, marginRight: -20, marginBottom: -14 }}>
                <OverviewSparkline data={sparkVals} color={c.color} id={c.metricKey} />
              </div>
            </div>
          )
        })}
      </div>

      {openCard && (
        <OverviewMetricModal
          card={openCard}
          dailyData={dailyData}
          onClose={() => setOpenCard(null)}
        />
      )}

      {/* Morning snapshot */}
      {lines.length > 0 && (
        <div className="card" style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="metric-label">Snapshot</span>
            <span style={{ fontSize: 10, fontWeight: 500, color: '#A3A3A3', border: '1px solid #EFEFEC', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Draft</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {lines.map((line, i) => (
              <p key={i} style={{ fontSize: 13, color: i === 0 ? '#1A1A1A' : '#737373', lineHeight: 1.6 }}>{line}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Level 1: Campaign list ─────────────────────────────────────────────────
function CampaignListView({ filteredRows, onSelectCampaign, onSelectAdset, onSelectAd, cols, picker, groupId, setGroupId }) {
  const groupOpt = GROUP_TABS.find(t => t.id === groupId)
  const [search, setSearch] = useState('')

  const counts = useMemo(() => ({
    campaign_name: groupByField(filteredRows, 'campaign_name').length,
    adsetName:     groupByAdset(filteredRows).length,
    ad_name:       groupByAd(filteredRows).length,
  }), [filteredRows])

  const allRows = useMemo(() => {
    if (groupId === 'campaign_name')
      return groupByField(filteredRows, 'campaign_name').map(g => ({ ...g, campaign_name: g.label }))
    if (groupId === 'adsetName')
      return groupByAdset(filteredRows)
    return groupByAd(filteredRows)
  }, [filteredRows, groupId])

  const displayRows = useMemo(
    () => search
      ? allRows.filter(r => String(r[groupId] ?? '').toLowerCase().includes(search.toLowerCase()))
      : allRows,
    [allRows, search, groupId]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'inline-flex', background: '#F5F5F4', borderRadius: 8, padding: 3 }}>
            {GROUP_TABS.map(t => (
              <button key={t.id} onClick={() => { setGroupId(t.id); setSearch('') }}
                style={{
                  padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: groupId === t.id ? '#FFFFFF' : 'transparent',
                  color: groupId === t.id ? '#1A1A1A' : '#737373',
                  boxShadow: groupId === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                {t.label}
                <span style={{ marginLeft: 5, fontSize: 10, color: '#A3A3A3', fontWeight: 400 }}>{counts[t.id]}</span>
              </button>
            ))}
          </div>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder={`Search ${groupOpt?.label?.toLowerCase() ?? ''}s`}
          />
        </div>
        {picker}
      </div>
      <div className="card">
        <SortableTable
          data={displayRows}
          nameKey={groupId}
          nameLabel={groupOpt.label}
          onRowClick={
            groupId === 'campaign_name' ? onSelectCampaign :
            groupId === 'adsetName'     ? onSelectAdset    :
                                          onSelectAd
          }
          rawRows={filteredRows}
          cols={cols}
        />
      </div>
    </div>
  )
}


// ── Main export ────────────────────────────────────────────────────────────
export default function CampaignTable({ filteredRows }) {
  const [colSet,    setColSet]    = useState('standard')
  const [groupId,   setGroupId]   = useState('campaign_name')
  const [drillView, setDrillView] = useState('campaigns')
  const [campaign,  setCampaign]  = useState(null)
  const [adset,     setAdset]     = useState(null)
  const [ad,        setAd]        = useState(null)

  const cols = COL_SETS[colSet] ?? COL_SETS.standard

  const picker = <ColPicker colSet={colSet} setColSet={setColSet} />

  function renderContent() {
    if (colSet === 'incremental') return <AttributionTab          filteredRows={filteredRows} picker={picker} groupId={groupId} setGroupId={setGroupId} />
    if (colSet === 'video')       return <CreativePerformanceTab  filteredRows={filteredRows} picker={picker} />
    if (drillView === 'ad') return (
      <AdView
        campaign={campaign} adset={adset} ad={ad}
        filteredRows={filteredRows}
        onBackToAdset={() => { setAd(null); setDrillView('adset') }}
        onBackToCampaign={() => { setAd(null); setAdset(null); setDrillView('campaign') }}
        onBackToAll={() => { setCampaign(null); setAdset(null); setAd(null); setDrillView('campaigns') }}
      />
    )
    if (drillView === 'adset') return (
      <AdsetView
        campaign={campaign} adset={adset}
        filteredRows={filteredRows}
        onBackToCampaign={() => { setAdset(null); setDrillView('campaign') }}
        onBackToAll={() => { setCampaign(null); setAdset(null); setDrillView('campaigns') }}
        onSelectAd={a => { setAd(a); setDrillView('ad') }}
        cols={cols}
      />
    )
    if (drillView === 'campaign') return (
      <CampaignView
        campaign={campaign}
        filteredRows={filteredRows}
        onBack={() => { setCampaign(null); setDrillView('campaigns') }}
        onSelectAdset={a => { setAdset(a); setDrillView('adset') }}
        cols={cols}
      />
    )
    return (
      <CampaignListView
        filteredRows={filteredRows}
        onSelectCampaign={c => { setCampaign(c); setDrillView('campaign') }}
        onSelectAdset={row => {
          setCampaign({ campaign_name: row.campaign_name })
          setAdset({ adsetName: row.adsetName })
          setDrillView('adset')
        }}
        onSelectAd={row => {
          setCampaign({ campaign_name: row.campaign_name })
          setAdset({ adsetName: row.adsetName })
          setAd({ ad_name: row.ad_name })
          setDrillView('ad')
        }}
        cols={cols}
        picker={picker}
        groupId={groupId}
        setGroupId={setGroupId}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {renderContent()}
    </div>
  )
}
