import React, { useState } from 'react'
import { METRIC_DEFS, getStatus, DEFAULT_TARGETS } from '../utils/metrics'
import { fmtValue } from '../utils/currency'

const STATUS_COLOR = {
  green:   '#22c55e',
  amber:   '#f59e0b',
  red:     '#ef4444',
  neutral: '#e5e7eb',
}

const STATUS_BADGE = {
  green:   { label: 'On Track',  cls: 'badge-green' },
  amber:   { label: 'Near',      cls: 'badge-amber' },
  red:     { label: 'Off Track', cls: 'badge-red'   },
  neutral: { label: '',          cls: ''             },
}

const STEP = { currency: 100, percent: 1, decimal: 0.1, integer: 10 }

export default function TargetsTab({ metrics, targets, setTargets }) {
  const [draft, setDraft] = useState({ ...targets })
  const [saved, setSaved] = useState(false)

  function save() {
    setTargets(draft)
    localStorage.setItem('psd_targets', JSON.stringify(draft))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#111827]">Monthly Targets</h2>
          <p className="helper-text mt-0.5">Saved to your browser</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setDraft({ ...DEFAULT_TARGETS }); setSaved(false) }}
            className="px-3 py-1.5 text-sm rounded-lg text-[#6b7280] bg-white transition-colors hover:bg-[#f9fafb]"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            Reset
          </button>
          <button
            onClick={save}
            className="px-4 py-1.5 text-sm font-semibold rounded-lg transition-all"
            style={saved
              ? { background: '#22c55e', color: '#fff' }
              : { background: '#111827', color: '#fff' }
            }
          >
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {METRIC_DEFS.map((def) => {
          const actual  = metrics[def.key] ?? 0
          const target  = draft[def.key]   ?? 0
          const status  = getStatus(def.key, actual, target, def.higherIsBetter)
          const badge   = STATUS_BADGE[status]
          const pct     = target > 0 ? Math.min((actual / target) * 100, 100) : null

          return (
            <div key={def.key} className="card flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <span className="metric-label leading-tight">{def.label}</span>
                {badge.label && <span className={badge.cls}>{badge.label}</span>}
              </div>

              {/* Actual */}
              <p className="text-[22px] font-bold tracking-tight text-[#111827] leading-none mb-1">
                {fmtValue(actual, def.format, 'AU')}
              </p>
              <p className="helper-text mb-3">Actual</p>

              {/* Target input */}
              <div className="mb-3">
                <label className="helper-text block mb-1">Target</label>
                <input
                  type="number"
                  value={target || ''}
                  onChange={(e) => {
                    setDraft((p) => ({ ...p, [def.key]: parseFloat(e.target.value) || 0 }))
                    setSaved(false)
                  }}
                  className="w-full px-2.5 py-1.5 text-sm rounded-lg text-[#111827] outline-none transition-colors"
                  style={{
                    background: '#f8f9fa',
                    border: '1px solid #e5e7eb',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#5b4fe9')}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = '#e5e7eb')}
                  placeholder="0"
                  min="0"
                  step={STEP[def.format] ?? 1}
                />
              </div>

              {/* Progress */}
              {pct !== null && (
                <div className="mb-3">
                  <div className="flex justify-end mb-1">
                    <span className="helper-text">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-[5px] rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: STATUS_COLOR[status] }}
                    />
                  </div>
                </div>
              )}

              {/* Definition */}
              <p className="helper-text mt-auto pt-1">{def.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
