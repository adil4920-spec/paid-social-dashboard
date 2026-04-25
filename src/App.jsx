import React, { useState, useMemo } from 'react'
import { useData } from './hooks/useData'
import {
  aggregateRows,
  computeMetrics,
  filterByDays,
  filterByChannel,
  DEFAULT_TARGETS,
} from './utils/metrics'
import SnapshotRow from './components/SnapshotRow'
import OverviewTab from './components/OverviewTab'
import TrendsTab from './components/TrendsTab'
import ChannelsTab from './components/ChannelsTab'
import TargetsTab from './components/TargetsTab'

const DATE_RANGES = [7, 14, 30, 90]
const CHANNELS = ['All', 'Meta', 'TikTok', 'Pinterest']
const TABS = ['Overview', 'Trends', 'Channels', 'Targets']

function loadTargets() {
  try {
    const stored = localStorage.getItem('psd_targets')
    if (stored) return { ...DEFAULT_TARGETS, ...JSON.parse(stored) }
  } catch {}
  return { ...DEFAULT_TARGETS }
}

export default function App() {
  const { rows, loading, usingDemo } = useData()
  const [days, setDays] = useState(30)
  const [channel, setChannel] = useState('All')
  const [tab, setTab] = useState('Overview')
  const [targets, setTargets] = useState(loadTargets)

  const filteredRows = useMemo(() => {
    const byDate = filterByDays(rows, days)
    return filterByChannel(byDate, channel)
  }, [rows, days, channel])

  const metrics = useMemo(() => {
    const agg = aggregateRows(filteredRows)
    return computeMetrics(agg)
  }, [filteredRows])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading data…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center shrink-0">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">Paid Social</span>
            {usingDemo && (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">
                Demo Data
              </span>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Date range */}
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-0.5">
              {DATE_RANGES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    days === d ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            {/* Channel */}
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-0.5">
              {CHANNELS.map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    channel === ch ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Snapshot row */}
        <SnapshotRow rows={rows} />

        {/* Tab nav */}
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`tab-btn ${tab === t ? 'tab-btn-active' : 'tab-btn-inactive'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'Overview' && (
          <OverviewTab metrics={metrics} targets={targets} />
        )}
        {tab === 'Trends' && (
          <TrendsTab filteredRows={filteredRows} targets={targets} />
        )}
        {tab === 'Channels' && (
          <ChannelsTab filteredRows={filteredRows} />
        )}
        {tab === 'Targets' && (
          <TargetsTab metrics={metrics} targets={targets} setTargets={setTargets} />
        )}
      </main>
    </div>
  )
}
