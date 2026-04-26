import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  PRESET_GROUPS, computePreset, formatDateRange, identifyPreset,
  addDays, subDays, dateFromStr, strFromDate, getToday,
} from '../utils/dateRange'

const RANGE_BG  = '#F0F9FF'   // in-range fill
const SEL_BG    = '#1A1A1A'   // selected cell bg
const TODAY_CLR = '#3B82F6'   // today border

// ── Chevron icon ───────────────────────────────────────────────────────────
function Chevron({ open }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 12 12" fill="none"
      style={{ transition: 'transform 180ms ease', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }}
    >
      <path d="M2 4l4 4 4-4" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Single day cell ────────────────────────────────────────────────────────
function DayCell({ dateStr, rStart, rEnd, dataMin, dataMax, today, onPick, onHover }) {
  const disabled = !!(dataMin && dateStr < dataMin) || !!(dataMax && dateStr > dataMax)
  const isStart  = dateStr === rStart
  const isEnd    = dateStr === rEnd
  const single   = isStart && isEnd
  const inRange  = rStart && rEnd && !single && dateStr > rStart && dateStr < rEnd
  const isToday  = dateStr === today
  const day      = parseInt(dateStr.slice(8), 10)

  let wrapBg = 'transparent'
  if (inRange)              wrapBg = RANGE_BG
  else if (isStart && !single) wrapBg = `linear-gradient(to right, transparent 50%, ${RANGE_BG} 50%)`
  else if (isEnd   && !single) wrapBg = `linear-gradient(to left,  transparent 50%, ${RANGE_BG} 50%)`

  const selected = isStart || isEnd
  return (
    <div style={{ background: wrapBg, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 }}>
      <button
        disabled={disabled}
        onClick={() => !disabled && onPick(dateStr)}
        onMouseEnter={() => !disabled && onHover(dateStr)}
        onMouseLeave={() => onHover(null)}
        style={{
          width: 32, height: 32, borderRadius: 6, border: 'none',
          outline: isToday && !selected ? `1.5px solid ${TODAY_CLR}` : 'none',
          outlineOffset: -1,
          background: selected ? SEL_BG : 'transparent',
          color: selected ? '#fff' : disabled ? '#D4D4D4' : '#1A1A1A',
          fontWeight: selected ? 500 : 400,
          cursor: disabled ? 'default' : 'pointer',
          fontSize: 13,
          flexShrink: 0,
          transition: 'background 0.1s',
        }}
        onMouseDown={e => e.preventDefault()}
      >
        {day}
      </button>
    </div>
  )
}

// ── One-month grid ─────────────────────────────────────────────────────────
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function MonthGrid({ year, month, rStart, rEnd, dataMin, dataMax, onPick, onHover }) {
  const today       = getToday()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow    = new Date(year, month, 1).getDay()  // 0=Sun
  const startOffset = firstDow                            // Sun-first offset

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = dateFromStr(`${year}-${String(month + 1).padStart(2, '0')}-01`)
    .toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

  return (
    <div style={{ width: 224 }}>
      <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginBottom: 10 }}>
        {monthLabel}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 32px)', marginBottom: 2 }}>
        {DOW.map(d => (
          <span key={d} style={{ textAlign: 'center', fontSize: 11, color: '#A3A3A3', fontWeight: 500, padding: '2px 0', width: 32 }}>
            {d}
          </span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 32px)' }}>
        {cells.map((dateStr, i) =>
          dateStr
            ? <DayCell key={dateStr} dateStr={dateStr} rStart={rStart} rEnd={rEnd}
                dataMin={dataMin} dataMax={dataMax} today={today} onPick={onPick} onHover={onHover} />
            : <div key={i} style={{ height: 32 }} />
        )}
      </div>
    </div>
  )
}

// ── Preset group (collapsible) ─────────────────────────────────────────────
function PresetGroup({ group, activePreset, dataMin, dataMax, onSelect, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)

  if (!group.label) {
    // Ungrouped items (Maximum, Custom range) — always visible, no header
    return (
      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 4, marginTop: 4 }}>
        {group.presets.map(p => (
          <PresetItem key={p.id} p={p} activePreset={activePreset} dataMin={dataMin} dataMax={dataMax} onSelect={onSelect} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '5px 12px', background: 'transparent', border: 'none',
          cursor: 'pointer', color: '#A3A3A3', fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}
      >
        {group.label}
        <Chevron open={open} />
      </button>
      {open && group.presets.map(p => (
        <PresetItem key={p.id} p={p} activePreset={activePreset} dataMin={dataMin} dataMax={dataMax} onSelect={onSelect} />
      ))}
    </div>
  )
}

function PresetItem({ p, activePreset, dataMin, dataMax, onSelect }) {
  const range   = p.id !== 'custom' ? computePreset(p.id, dataMin, dataMax) : null
  const unavail = range && (
    (dataMax && range.start > dataMax) ||
    (dataMin && range.end < dataMin)
  )
  const isActive = activePreset === p.id
  const [hovered, setHovered] = useState(false)

  return (
    <button
      key={p.id}
      disabled={!!unavail}
      title={unavail ? 'No data available for this range' : undefined}
      onClick={() => onSelect(p.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '7px 12px', fontSize: 13, borderRadius: 6, margin: '1px 0',
        background: isActive ? '#F5F5F4' : hovered && !unavail ? '#F5F5F4' : 'transparent',
        color: unavail ? '#D4D4D4' : '#1A1A1A',
        fontWeight: isActive ? 500 : 400,
        cursor: unavail ? 'not-allowed' : 'pointer',
        border: 'none',
        transition: 'background 0.1s',
      }}
    >
      {p.label}
    </button>
  )
}

// ── Picker panel (presets + calendar) ─────────────────────────────────────
function PickerPanel({ value, dataMin, dataMax, onApply, onCancel }) {
  const [activePreset, setActivePreset] = useState(() => identifyPreset(value.start, value.end, dataMin, dataMax))
  const [draft,        setDraft]        = useState(value)
  const [picking,      setPicking]      = useState(null)   // 'start' | 'end' | null
  const [hoverDate,    setHoverDate]    = useState(null)

  const initEnd    = value.end || getToday()
  const initEndObj = dateFromStr(initEnd)
  const [viewYear,  setViewYear]  = useState(initEndObj.getFullYear())
  const [viewMonth, setViewMonth] = useState(
    initEndObj.getMonth() === 0 ? 0 : initEndObj.getMonth() - 1
  )

  const leftY = viewYear
  const leftM = viewMonth
  const rightY = leftM === 11 ? leftY + 1 : leftY
  const rightM = leftM === 11 ? 0 : leftM + 1

  function prevMonth() {
    if (leftM === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (leftM === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function selectPreset(id) {
    setActivePreset(id)
    if (id === 'custom') {
      setPicking('start')
      return
    }
    const range = computePreset(id, dataMin, dataMax)
    setDraft(range)
    setPicking(null)
    const endObj = dateFromStr(range.end)
    const ey = endObj.getFullYear(), em = endObj.getMonth()
    if (em === 0) { setViewYear(ey - 1); setViewMonth(11) }
    else { setViewYear(ey); setViewMonth(em - 1) }
  }

  function pickDate(dateStr) {
    if (picking === 'start' || picking === null) {
      setDraft({ start: dateStr, end: dateStr })
      setPicking('end')
      setActivePreset('custom')
    } else {
      const [s, e] = dateStr < draft.start
        ? [dateStr, draft.start]
        : [draft.start, dateStr]
      setDraft({ start: s, end: e })
      setPicking(null)
      setActivePreset(identifyPreset(s, e, dataMin, dataMax))
    }
  }

  const dispStart = useMemo(() => {
    if (picking === 'end' && hoverDate && draft.start) return hoverDate < draft.start ? hoverDate : draft.start
    return draft.start
  }, [picking, hoverDate, draft.start])

  const dispEnd = useMemo(() => {
    if (picking === 'end' && hoverDate && draft.start) return hoverDate < draft.start ? draft.start : hoverDate
    return draft.end
  }, [picking, hoverDate, draft.start, draft.end])

  return (
    <div style={{
      display: 'flex', background: '#fff', borderRadius: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB',
      overflow: 'hidden', width: 640,
    }}>
      {/* ── Preset list ── */}
      <div style={{ width: 168, borderRight: '1px solid #F3F4F6', padding: '10px 6px', flexShrink: 0, overflowY: 'auto' }}>
        {PRESET_GROUPS.map((group, gi) => (
          <PresetGroup
            key={gi}
            group={group}
            activePreset={activePreset}
            dataMin={dataMin}
            dataMax={dataMax}
            onSelect={selectPreset}
            defaultOpen={gi === 0}
          />
        ))}
      </div>

      {/* ── Calendar ── */}
      <div style={{ flex: 1, padding: '16px 20px 14px', minWidth: 0 }}>
        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={prevMonth} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #EFEFEC', cursor: 'pointer', background: '#fff', color: '#6b7280', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <div style={{ display: 'flex', gap: 0, justifyContent: 'center', flex: 1 }} />
          <button onClick={nextMonth} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #EFEFEC', cursor: 'pointer', background: '#fff', color: '#6b7280', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        </div>

        <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
          <MonthGrid
            year={leftY} month={leftM}
            rStart={dispStart} rEnd={dispEnd}
            dataMin={dataMin} dataMax={dataMax}
            onPick={pickDate} onHover={setHoverDate}
          />
          <MonthGrid
            year={rightY} month={rightM}
            rStart={dispStart} rEnd={dispEnd}
            dataMin={dataMin} dataMax={dataMax}
            onPick={pickDate} onHover={setHoverDate}
          />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid #EFEFEC' }}>
          <span style={{ fontSize: 12, color: '#A3A3A3' }}>
            {picking === 'end'
              ? <span style={{ color: '#1E3A8A' }}>Click to set end date</span>
              : picking === 'start'
              ? <span style={{ color: '#1E3A8A' }}>Click to set start date</span>
              : formatDateRange(draft.start, draft.end)
            }
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancel}
              style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13, border: '1px solid #EFEFEC', cursor: 'pointer', color: '#737373', background: '#fff', fontFamily: 'inherit', transition: 'border-color 150ms ease' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#D4D4D4'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#EFEFEC'}>
              Cancel
            </button>
            <button
              disabled={picking !== null}
              onClick={() => onApply({ preset: activePreset, start: draft.start, end: draft.end })}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 13, fontFamily: 'inherit',
                background: picking ? '#E5E5E5' : '#1E3A8A', color: picking ? '#A3A3A3' : '#fff',
                cursor: picking ? 'not-allowed' : 'pointer', fontWeight: 500, border: 'none',
                transition: 'background 150ms ease',
              }}>
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Public component ───────────────────────────────────────────────────────
export default function DateRangePicker({ value, onChange, dataMin, dataMax }) {
  const [open, setOpen] = useState(false)
  const ref             = useRef(null)
  const today           = getToday()

  useEffect(() => {
    if (!open) return
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  useEffect(() => {
    if (!open) return
    const fn = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [open])

  const label   = formatDateRange(value.start, value.end)
  const partial = value.start <= today && today <= value.end

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 0,
          padding: '7px 12px', border: `1px solid ${open ? '#D4D4D4' : '#EFEFEC'}`,
          borderRadius: 6, background: 'transparent', cursor: 'pointer',
          fontFamily: 'inherit', transition: 'border-color 150ms ease',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#D4D4D4'}
        onMouseLeave={e => { if (!open) e.currentTarget.style.borderColor = '#EFEFEC' }}
      >
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#A3A3A3" strokeWidth="1.8" style={{ marginRight: 6, flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 13, color: '#A3A3A3', fontWeight: 400, marginRight: 4 }}>Date Range</span>
        <span style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 400, whiteSpace: 'nowrap' }}>{label}</span>
        {partial && (
          <span title="Today's data is partial" style={{ width: 5, height: 5, borderRadius: '50%', background: '#A3A3A3', flexShrink: 0, marginLeft: 6 }} />
        )}
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 6, flexShrink: 0 }}>
          <path d="M2 4l4 4 4-4" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50 }}>
          <PickerPanel
            value={value}
            dataMin={dataMin}
            dataMax={dataMax}
            onApply={range => { onChange(range); setOpen(false) }}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
