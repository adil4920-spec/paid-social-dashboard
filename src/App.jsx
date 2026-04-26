import React, { useState, useMemo } from 'react'
import { useData }         from './hooks/useData'
import { usePacerData }    from './hooks/usePacerData'
import { aggregateRows, computeMetrics, filterByDateRange, DEFAULT_TARGETS } from './utils/metrics'
import { loadSavedRange, saveRange, computePreset, getDataBounds } from './utils/dateRange'
import DateRangePicker     from './components/DateRangePicker'
import CampaignTable       from './components/CampaignTable'
import GlossaryTab         from './components/GlossaryTab'
import MorningSnapshotTab  from './components/MorningSnapshotTab'
import DailySummaryTab     from './components/DailySummaryTab'

const TABS = [
  { id: 'snapshot',   label: 'Morning Snapshot' },
  { id: 'summary',    label: 'Daily Summary'    },
  { id: 'campaigns',  label: 'Campaigns'        },
  { id: 'glossary',   label: 'Glossary'         },
]

const CLIENTS = ['Bydee', 'Bed Threads', 'Vida Glow', 'Arcteryx']
const REGIONS = ['AU', 'US', 'UK']

function loadAccount() {
  try {
    const s = localStorage.getItem('psd_account')
    if (s) return JSON.parse(s)
  } catch {}
  return { client: 'Bydee', region: 'AU' }
}

function loadTargets() {
  try {
    const s = localStorage.getItem('psd_targets')
    if (s) return { ...DEFAULT_TARGETS, ...JSON.parse(s) }
  } catch {}
  return { ...DEFAULT_TARGETS }
}

// ── WIP banner ────────────────────────────────────────────────────────────
function WipBanner() {
  return (
    <div style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #EFEFEC', background: '#FAFAF9', fontSize: 13, color: '#737373' }}>
      <strong style={{ color: '#1A1A1A', fontWeight: 500 }}>Data not synced</strong> — numbers on this page are from the demo dataset and may not reflect current figures.
    </div>
  )
}

// ── No data placeholder ────────────────────────────────────────────────────
function NoDataState({ account }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FFFFFF', border: '1px solid #EFEFEC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#D4D4D4" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>{account.client} · {account.region}</p>
        <p style={{ fontSize: 13, color: '#A3A3A3' }}>No data connected for this account.</p>
      </div>
    </div>
  )
}

// ── Ghost select ───────────────────────────────────────────────────────────
function GhostSelect({ value, onChange, options }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none', WebkitAppearance: 'none',
          padding: '7px 28px 7px 12px',
          border: '1px solid #EFEFEC',
          borderRadius: 6,
          fontSize: 13,
          fontFamily: 'inherit',
          fontWeight: 400,
          color: '#1A1A1A',
          background: 'transparent',
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 150ms ease',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#D4D4D4'}
        onMouseLeave={e => e.currentTarget.style.borderColor = '#EFEFEC'}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <svg style={{ pointerEvents: 'none', position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)' }}
           width="11" height="11" viewBox="0 0 12 12" fill="none">
        <path d="M2 4l4 4 4-4" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const { rows, loading, usingDemo } = useData()
  const { data: pacerData }          = usePacerData()
  const [tab,       setTab]       = useState('snapshot')
  const [account,   setAccount]   = useState(loadAccount)
  const [dateRange, setDateRange] = useState(() => {
    const saved = loadSavedRange()
    if (saved?.preset && saved.preset !== 'custom') {
      const r = computePreset(saved.preset, null, null)
      return { preset: saved.preset, start: r.start, end: r.end }
    }
    if (saved?.start && saved?.end) return saved
    const r = computePreset('last14', null, null)
    return { preset: 'last14', start: r.start, end: r.end }
  })

  const dataBounds = useMemo(() => getDataBounds(rows), [rows])
  const hasData    = account.client === 'Bydee' && account.region === 'AU'

  function handleClient(client) {
    const next = { ...account, client }
    setAccount(next)
    localStorage.setItem('psd_account', JSON.stringify(next))
  }
  function handleRegion(region) {
    const next = { ...account, region }
    setAccount(next)
    localStorage.setItem('psd_account', JSON.stringify(next))
  }

  const filteredRows = useMemo(
    () => filterByDateRange(rows, dateRange.start, dateRange.end),
    [rows, dateRange]
  )

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF9' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 20, height: 20, border: '1.5px solid #1A1A1A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13, color: '#A3A3A3' }}>Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#FAFAF9' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid #EFEFEC', position: 'sticky', top: 0, zIndex: 30, height: 56, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, flexShrink: 0 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 6 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', letterSpacing: '-0.01em' }}>Adil Tracker</span>
        </div>

        <div style={{ width: 1, height: 18, background: '#EFEFEC' }} />

        {/* Filter pills */}
        <GhostSelect value={account.client} onChange={handleClient} options={CLIENTS} />
        <GhostSelect value={account.region} onChange={handleRegion} options={REGIONS} />

        <span style={{ padding: '7px 12px', border: '1px solid #EFEFEC', borderRadius: 6, fontSize: 13, color: '#A3A3A3' }}>
          Meta
        </span>

        {usingDemo && hasData && (
          <span style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, color: '#92400e', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
            Demo
          </span>
        )}

        <div style={{ flex: 1 }} />

        <DateRangePicker
          value={dateRange}
          dataMin={dataBounds.min}
          dataMax={dataBounds.max}
          onChange={range => { setDateRange(range); saveRange(range) }}
        />
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* Sidebar */}
        <aside style={{ width: 240, background: '#FFFFFF', borderRight: '1px solid #EFEFEC', flexShrink: 0, position: 'sticky', top: 56, height: 'calc(100vh - 56px)', overflowY: 'auto' }}>
          <nav style={{ padding: '16px 12px' }}>
            <p style={{ padding: '0 4px 8px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A3A3A3', marginTop: 4 }}>
              Analytics
            </p>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`nav-item ${tab === t.id ? 'nav-item-active' : t.wip ? 'nav-item-wip' : 'nav-item-default'}`}
              >
                {t.label}
                {t.wip && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 500, color: '#D4D4D4' }}>WIP</span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main style={{ flex: 1, background: '#FAFAF9', padding: 28, minWidth: 0, overflowX: 'hidden' }}>
          {tab === 'snapshot' ? (
            <MorningSnapshotTab rows={rows} pacerData={pacerData} dateRange={dateRange} />
          ) : tab === 'summary' ? (
            <DailySummaryTab rows={rows} />
          ) : tab === 'glossary' ? (
            <GlossaryTab />
          ) : !hasData ? (
            <NoDataState account={account} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {tab === 'campaigns' && <CampaignTable filteredRows={filteredRows} />}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
