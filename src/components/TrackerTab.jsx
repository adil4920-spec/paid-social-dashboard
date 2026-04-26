import React, { useState, useMemo, useCallback } from 'react'

// ── Storage ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'psd_tracker_v1'

function loadEntries() {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? JSON.parse(s) : []
  } catch { return [] }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ── Config ────────────────────────────────────────────────────────────────────
const ENTITY_TYPES = ['Account', 'Campaign', 'Ad Set', 'Ad']

const ACTION_PRESETS = [
  'Scaled budget ↑',
  'Cut budget ↓',
  'Paused',
  'Unpaused',
  'New creative',
  'Refreshed creative',
  'Audience change',
  'Bid strategy change',
  'Budget cap raised',
  'Other',
]

const STATUSES = [
  { id: 'planned',    label: 'Planned',    color: '#6B7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)'  },
  { id: 'done',       label: 'Done',       color: '#1E3A8A', bg: 'rgba(30,58,138,0.08)',   border: 'rgba(30,58,138,0.2)'    },
  { id: 'monitoring', label: 'Monitoring', color: '#D97706', bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.2)'    },
  { id: 'reverted',   label: 'Reverted',   color: '#B91C1C', bg: 'rgba(185,28,28,0.08)',   border: 'rgba(185,28,28,0.2)'    },
  { id: 'resolved',   label: 'Resolved ✓', color: '#15803D', bg: 'rgba(22,163,74,0.08)',   border: 'rgba(22,163,74,0.2)'    },
]

const ENTITY_COLORS = {
  'Account':  { color: '#1E3A8A', bg: 'rgba(30,58,138,0.07)'   },
  'Campaign': { color: '#6D28D9', bg: 'rgba(109,40,217,0.07)'  },
  'Ad Set':   { color: '#0F766E', bg: 'rgba(15,118,110,0.07)'  },
  'Ad':       { color: '#B45309', bg: 'rgba(180,83,9,0.07)'    },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusCfg(id) {
  return STATUSES.find(s => s.id === id) ?? STATUSES[0]
}

function fmtDate(str) {
  if (!str) return ''
  return new Date(str + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysSince(str) {
  if (!str) return null
  const diff = Math.floor((Date.now() - new Date(str + 'T00:00:00')) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return '1 day ago'
  return `${diff} days ago`
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, small }) {
  const cfg = statusCfg(status)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: small ? '2px 7px' : '3px 10px',
      borderRadius: 6, fontSize: small ? 10 : 11, fontWeight: 600, letterSpacing: '0.03em',
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  )
}

// ── Entity type badge ─────────────────────────────────────────────────────────
function EntityBadge({ type }) {
  const cfg = ENTITY_COLORS[type] ?? ENTITY_COLORS['Account']
  return (
    <span style={{
      display: 'inline-flex', padding: '1px 7px', borderRadius: 4,
      fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
      color: cfg.color, background: cfg.bg,
    }}>{type}</span>
  )
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────
const EMPTY_FORM = {
  date: todayStr(),
  entityType: 'Campaign',
  entityName: '',
  action: '',
  reasoning: '',
  outcome: '',
  status: 'done',
}

function EntryModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const [customAction, setCustomAction] = useState(
    initial?.action && !ACTION_PRESETS.includes(initial.action) ? initial.action : ''
  )
  const [showCustom, setShowCustom] = useState(
    initial?.action && !ACTION_PRESETS.includes(initial.action)
  )

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function handleActionPreset(a) {
    if (a === 'Other') {
      setShowCustom(true)
      set('action', customAction)
    } else {
      setShowCustom(false)
      set('action', a)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    const action = showCustom ? customAction : form.action
    if (!action.trim() || !form.entityName.trim()) return
    onSave({ ...form, action: action.trim(), entityName: form.entityName.trim() })
  }

  const activePreset = showCustom ? 'Other' : form.action

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
            {initial ? 'Edit entry' : 'Log a change'}
          </h3>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #EFEFEC', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A3A3A3', fontSize: 14 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Date + Status row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle}>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Entity type + name */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Level</label>
              <select value={form.entityType} onChange={e => set('entityType', e.target.value)} style={inputStyle}>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>{form.entityType} name</label>
              <input
                type="text" value={form.entityName} onChange={e => set('entityName', e.target.value)}
                placeholder={form.entityType === 'Account' ? 'e.g. Bydee AU' : `Enter ${form.entityType.toLowerCase()} name`}
                style={inputStyle} required
              />
            </div>
          </div>

          {/* Action presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={labelStyle}>Action</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ACTION_PRESETS.map(a => (
                <button
                  key={a} type="button"
                  onClick={() => handleActionPreset(a)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                    border: '1px solid', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 120ms',
                    borderColor: activePreset === a ? '#1E3A8A' : '#EFEFEC',
                    background: activePreset === a ? '#1E3A8A' : 'transparent',
                    color: activePreset === a ? '#fff' : '#737373',
                  }}
                >{a}</button>
              ))}
            </div>
            {showCustom && (
              <input
                type="text" value={customAction}
                onChange={e => { setCustomAction(e.target.value); set('action', e.target.value) }}
                placeholder="Describe the action…"
                style={{ ...inputStyle, marginTop: 4 }}
                autoFocus
              />
            )}
          </div>

          {/* Reasoning */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Reasoning <span style={{ color: '#A3A3A3', fontWeight: 400 }}>(why you made this change)</span></label>
            <textarea
              value={form.reasoning}
              onChange={e => set('reasoning', e.target.value)}
              placeholder="What signal triggered this? What did the data show?"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {/* Outcome */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Outcome <span style={{ color: '#A3A3A3', fontWeight: 400 }}>(fill in after a few days)</span></label>
            <textarea
              value={form.outcome}
              onChange={e => set('outcome', e.target.value)}
              placeholder="What happened? Did it work?"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{ ...btnStyle, background: 'transparent', color: '#737373', border: '1px solid #EFEFEC' }}>Cancel</button>
            <button type="submit" style={{ ...btnStyle, background: '#1A1A1A', color: '#fff', border: '1px solid #1A1A1A' }}>
              {initial ? 'Save changes' : 'Log change'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Entry card ────────────────────────────────────────────────────────────────
function EntryCard({ entry, onEdit, onDelete, onStatusChange }) {
  const [expanded, setExpanded] = useState(false)
  const sc = statusCfg(entry.status)

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #EFEFEC',
      overflow: 'hidden', transition: 'box-shadow 150ms',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Main row */}
      <div
        style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14 }}
        onClick={() => setExpanded(x => !x)}
      >
        {/* Date column */}
        <div style={{ flexShrink: 0, width: 78, paddingTop: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>{fmtDate(entry.date)}</p>
          <p style={{ fontSize: 11, color: '#A3A3A3', margin: '2px 0 0' }}>{daysSince(entry.date)}</p>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <EntityBadge type={entry.entityType} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{entry.action}</span>
          </div>
          <p style={{ fontSize: 12, color: '#737373', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {entry.entityName}
          </p>
        </div>

        {/* Status + chevron */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusBadge status={entry.status} small />
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 180ms', flexShrink: 0 }}>
            <path d="M2 4l4 4 4-4" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid #F5F5F4', padding: '14px 18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {entry.reasoning && (
            <div>
              <p style={sectionLabelStyle}>Reasoning</p>
              <p style={bodyTextStyle}>{entry.reasoning}</p>
            </div>
          )}

          {entry.outcome && (
            <div>
              <p style={sectionLabelStyle}>Outcome</p>
              <p style={{ ...bodyTextStyle, color: '#15803D' }}>{entry.outcome}</p>
            </div>
          )}

          {!entry.outcome && (
            <div style={{ padding: '8px 12px', background: '#FAFAF9', borderRadius: 8, border: '1px dashed #E5E5E4' }}>
              <p style={{ fontSize: 12, color: '#A3A3A3', margin: 0 }}>No outcome logged yet — come back after a few days to record what happened.</p>
            </div>
          )}

          {/* Change status inline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
            <span style={{ fontSize: 11, color: '#A3A3A3', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</span>
            {STATUSES.map(s => (
              <button
                key={s.id}
                onClick={() => onStatusChange(entry.id, s.id)}
                style={{
                  padding: '2px 9px', borderRadius: 5, fontSize: 11, fontWeight: 500,
                  fontFamily: 'inherit', cursor: 'pointer', border: '1px solid',
                  transition: 'all 120ms',
                  borderColor: entry.status === s.id ? s.border : '#EFEFEC',
                  background: entry.status === s.id ? s.bg : 'transparent',
                  color: entry.status === s.id ? s.color : '#A3A3A3',
                }}
              >{s.label}</button>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
            <button onClick={() => onEdit(entry)} style={{ ...smallBtnStyle, color: '#1A1A1A', borderColor: '#EFEFEC' }}>
              Edit
            </button>
            <button onClick={() => onDelete(entry.id)} style={{ ...smallBtnStyle, color: '#B91C1C', borderColor: '#FECACA' }}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function TrackerTab() {
  const [entries, setEntries]     = useState(loadEntries)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [filter, setFilter]       = useState('all')
  const [search, setSearch]       = useState('')

  function persist(next) {
    setEntries(next)
    saveEntries(next)
  }

  function handleSave(form) {
    if (editing) {
      persist(entries.map(e => e.id === editing.id ? { ...editing, ...form } : e))
      setEditing(null)
    } else {
      persist([{ id: newId(), ...form }, ...entries])
      setShowModal(false)
    }
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this entry?')) return
    persist(entries.filter(e => e.id !== id))
  }

  function handleStatusChange(id, status) {
    persist(entries.map(e => e.id === id ? { ...e, status } : e))
  }

  const filtered = useMemo(() => {
    let list = [...entries].sort((a, b) => b.date.localeCompare(a.date))
    if (filter !== 'all') list = list.filter(e => e.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.entityName.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.reasoning?.toLowerCase().includes(q) ||
        e.outcome?.toLowerCase().includes(q)
      )
    }
    return list
  }, [entries, filter, search])

  const counts = useMemo(() => {
    const c = { all: entries.length }
    for (const s of STATUSES) c[s.id] = entries.filter(e => e.status === s.id).length
    return c
  }, [entries])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1A1A1A', letterSpacing: '-0.02em', margin: 0 }}>Change & Optimisation Tracker</h2>
          <p style={{ fontSize: 13, color: '#737373', margin: '4px 0 0' }}>Log every decision, record what happened, build a learning log.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', background: '#1A1A1A', color: '#fff', border: 'none', flexShrink: 0 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Log change
        </button>
      </div>

      {/* Stats row */}
      {entries.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
          {[
            { label: 'Total logged', value: entries.length },
            { label: 'Monitoring', value: counts.monitoring, color: '#D97706' },
            { label: 'Resolved', value: counts.resolved, color: '#15803D' },
            { label: 'Planned', value: counts.planned, color: '#6B7280' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#A3A3A3', margin: '0 0 4px' }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 600, color: s.color ?? '#1A1A1A', margin: 0, letterSpacing: '-0.02em' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter + search bar */}
      {entries.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', background: '#F5F5F4', borderRadius: 8, padding: 3, gap: 1 }}>
            {[{ id: 'all', label: `All ${counts.all}` }, ...STATUSES.map(s => ({ id: s.id, label: `${s.label} ${counts[s.id] ?? 0}` }))].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 120ms',
                  background: filter === f.id ? '#fff' : 'transparent',
                  color: filter === f.id ? '#1A1A1A' : '#737373',
                  boxShadow: filter === f.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >{f.label}</button>
            ))}
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg style={{ position: 'absolute', left: 8, pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="#A3A3A3" strokeWidth="1.5"/>
              <path d="M10 10l3 3" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 12, border: '1px solid #EFEFEC', borderRadius: 6, outline: 'none', fontFamily: 'inherit', width: 180, background: '#fff' }}
            />
          </div>
        </div>
      )}

      {/* Entry list */}
      {filtered.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(e => (
            <EntryCard
              key={e.id}
              entry={e}
              onEdit={entry => { setEditing(entry); setShowModal(true) }}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F5F5F4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#D4D4D4" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', margin: '0 0 6px' }}>No changes logged yet</p>
          <p style={{ fontSize: 13, color: '#A3A3A3', margin: '0 0 20px' }}>Start tracking every budget change, creative swap, or audience test.</p>
          <button
            onClick={() => { setEditing(null); setShowModal(true) }}
            style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', background: '#1A1A1A', color: '#fff', border: 'none' }}
          >Log your first change</button>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: '#A3A3A3', textAlign: 'center', padding: '32px 0' }}>No entries match your search.</p>
      )}

      {/* Modal */}
      {(showModal || editing) && (
        <EntryModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const labelStyle = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: '#737373',
}
const inputStyle = {
  padding: '8px 10px', fontSize: 13, border: '1px solid #EFEFEC',
  borderRadius: 7, outline: 'none', fontFamily: 'inherit',
  color: '#1A1A1A', background: '#fff', width: '100%', boxSizing: 'border-box',
}
const btnStyle = {
  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
  fontFamily: 'inherit', cursor: 'pointer',
}
const smallBtnStyle = {
  padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
  fontFamily: 'inherit', cursor: 'pointer', background: 'transparent',
  border: '1px solid',
}
const sectionLabelStyle = {
  fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.07em', color: '#A3A3A3', margin: '0 0 5px',
}
const bodyTextStyle = {
  fontSize: 13, color: '#404040', lineHeight: 1.65, margin: 0,
}
