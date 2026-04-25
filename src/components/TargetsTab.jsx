import React, { useState } from 'react'
import { METRIC_DEFS, formatValue, getStatus, DEFAULT_TARGETS } from '../utils/metrics'

const STATUS_BAR_COLOR = {
  green: 'bg-green-500',
  amber: 'bg-amber-400',
  red: 'bg-red-500',
  neutral: 'bg-gray-300',
}

function ProgressBar({ actual, target, higherIsBetter }) {
  const status = getStatus('', actual, target, higherIsBetter)
  const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0
  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>0%</span>
        <span>{pct.toFixed(0)}% of target</span>
        <span>100%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${STATUS_BAR_COLOR[status]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function TargetsTab({ metrics, targets, setTargets }) {
  const [draft, setDraft] = useState(() => ({ ...targets }))
  const [saved, setSaved] = useState(false)

  function handleChange(key, val) {
    setDraft((prev) => ({ ...prev, [key]: parseFloat(val) || 0 }))
    setSaved(false)
  }

  function handleSave() {
    setTargets(draft)
    localStorage.setItem('psd_targets', JSON.stringify(draft))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleReset() {
    setDraft({ ...DEFAULT_TARGETS })
    setSaved(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Performance Targets</h2>
          <p className="text-sm text-gray-400 mt-0.5">Set targets to track progress against KPIs</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              saved
                ? 'bg-green-500 text-white'
                : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            {saved ? 'Saved!' : 'Save Targets'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {METRIC_DEFS.map((def) => {
          const actual = metrics[def.key]
          const target = draft[def.key]
          return (
            <div key={def.key} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label className="metric-label block mb-1">{def.label}</label>
                  <p className="text-xs text-gray-400 mb-3">{def.description}</p>
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Actual</p>
                      <p className="text-lg font-semibold text-gray-900">{formatValue(actual, def.format)}</p>
                    </div>
                    <div className="text-gray-200 mt-4">→</div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Target</label>
                      <input
                        type="number"
                        value={target || ''}
                        onChange={(e) => handleChange(def.key, e.target.value)}
                        className="w-28 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 transition-colors"
                        placeholder="0"
                        min="0"
                        step={def.format === 'decimal' ? '0.1' : def.format === 'percent' ? '1' : '100'}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <ProgressBar actual={actual} target={target} higherIsBetter={def.higherIsBetter} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
