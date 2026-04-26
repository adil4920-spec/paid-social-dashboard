// ── Config (change these to adjust global date behaviour) ──────────────────
export const DATE_CONFIG = {
  excludeToday: true,       // Meta default: "Last 7 days" = 7 completed days before today
  timezone: 'Australia/Sydney',  // Make timezone a string here when other regions come online
}

// ── Core helpers ───────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0') }
export function strFromDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function dateFromStr(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function getToday() {
  // Returns today's date string in the configured timezone
  return new Date().toLocaleDateString('en-CA', { timeZone: DATE_CONFIG.timezone })
}
export function addDays(s, n) {
  const d = dateFromStr(s)
  d.setDate(d.getDate() + n)
  return strFromDate(d)
}
export function subDays(s, n) { return addDays(s, -n) }

// ── Presets ────────────────────────────────────────────────────────────────
export const PRESET_GROUPS = [
  {
    label: 'Days',
    presets: [
      { id: 'today',   label: 'Today'        },
      { id: 'yesterday', label: 'Yesterday'  },
      { id: 'last3',   label: 'Last 3 days'  },
      { id: 'last7',   label: 'Last 7 days'  },
      { id: 'last14',  label: 'Last 14 days' },
      { id: 'last28',  label: 'Last 28 days' },
      { id: 'last30',  label: 'Last 30 days' },
      { id: 'last90',  label: 'Last 90 days' },
    ],
  },
  {
    label: 'Weeks',
    presets: [
      { id: 'thisWeekSun', label: 'This week (Sun–today)' },
      { id: 'lastWeekSun', label: 'Last week (Sun–Sat)'   },
      { id: 'thisWeekMon', label: 'This week (Mon–today)' },
      { id: 'lastWeekMon', label: 'Last week (Mon–Sun)'   },
    ],
  },
  {
    label: 'Months',
    presets: [
      { id: 'thisMonth', label: 'This month' },
      { id: 'lastMonth', label: 'Last month' },
    ],
  },
  {
    label: '',
    presets: [
      { id: 'maximum', label: 'Maximum'      },
      { id: 'custom',  label: 'Custom range' },
    ],
  },
]

export const ALL_PRESETS = PRESET_GROUPS.flatMap(g => g.presets)

export function computePreset(id, dataMin, dataMax) {
  const today     = getToday()
  const yesterday = subDays(today, 1)
  // With excludeToday=true, "last N" windows end on yesterday (Meta behaviour)
  const rangeEnd  = DATE_CONFIG.excludeToday ? yesterday : today

  switch (id) {
    case 'today':     return { start: today,                 end: today     }
    case 'yesterday': return { start: yesterday,             end: yesterday }
    case 'last3':     return { start: subDays(rangeEnd, 2),  end: rangeEnd  }
    case 'last7':     return { start: subDays(rangeEnd, 6),  end: rangeEnd  }
    case 'last14':    return { start: subDays(rangeEnd, 13), end: rangeEnd  }
    case 'last28':    return { start: subDays(rangeEnd, 27), end: rangeEnd  }
    case 'last30':    return { start: subDays(rangeEnd, 29), end: rangeEnd  }
    case 'last90':    return { start: subDays(rangeEnd, 89), end: rangeEnd  }

    case 'thisWeekSun': {
      const dow = dateFromStr(today).getDay()               // 0=Sun
      return { start: subDays(today, dow), end: rangeEnd }
    }
    case 'lastWeekSun': {
      const dow      = dateFromStr(today).getDay()
      const thisSun  = subDays(today, dow)
      return { start: subDays(thisSun, 7), end: subDays(thisSun, 1) }
    }
    case 'thisWeekMon': {
      const dow      = dateFromStr(today).getDay()
      const fromMon  = (dow + 6) % 7                        // days since last Monday
      return { start: subDays(today, fromMon), end: rangeEnd }
    }
    case 'lastWeekMon': {
      const dow      = dateFromStr(today).getDay()
      const fromMon  = (dow + 6) % 7
      const thisMon  = subDays(today, fromMon)
      return { start: subDays(thisMon, 7), end: subDays(thisMon, 1) }
    }

    case 'thisMonth': {
      const d = dateFromStr(today)
      return {
        start: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`,
        end: rangeEnd,
      }
    }
    case 'lastMonth': {
      const d     = dateFromStr(today)
      const first = new Date(d.getFullYear(), d.getMonth() - 1, 1)
      const last  = new Date(d.getFullYear(), d.getMonth(), 0)
      return { start: strFromDate(first), end: strFromDate(last) }
    }

    case 'maximum':
      return { start: dataMin ?? subDays(today, 90), end: dataMax ?? yesterday }

    default:
      return { start: subDays(rangeEnd, 6), end: rangeEnd }
  }
}

// Returns which preset id matches {start, end}, or 'custom'
export function identifyPreset(start, end, dataMin, dataMax) {
  for (const p of ALL_PRESETS) {
    if (p.id === 'custom') continue
    const c = computePreset(p.id, dataMin, dataMax)
    if (c.start === start && c.end === end) return p.id
  }
  return 'custom'
}

// ── Formatting ─────────────────────────────────────────────────────────────
export function formatDateRange(start, end) {
  if (!start || !end) return ''
  const fmt     = s => dateFromStr(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const fmtNoYr = s => dateFromStr(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  if (start === end) return fmt(start)
  if (start.slice(0, 4) === end.slice(0, 4)) return `${fmtNoYr(start)} – ${fmt(end)}`
  return `${fmt(start)} – ${fmt(end)}`
}

// ── Data helpers ───────────────────────────────────────────────────────────
export function getDataBounds(rows) {
  if (!rows.length) return { min: null, max: null }
  const dates = rows.map(r => r.date).sort()
  return { min: dates[0], max: dates[dates.length - 1] }
}

export function detectGaps(rows, start, end) {
  const dates = new Set(rows.map(r => r.date))
  const gaps = []
  let cur = start
  while (cur <= end) {
    if (!dates.has(cur)) {
      const gapStart = cur
      while (cur <= end && !dates.has(cur)) cur = addDays(cur, 1)
      gaps.push({ start: gapStart, end: subDays(cur, 1) })
    } else {
      cur = addDays(cur, 1)
    }
  }
  return gaps
}

// ── Persistence ────────────────────────────────────────────────────────────
const STORAGE_KEY = 'psd_daterange_v2'

export function loadSavedRange() {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) {
      const r = JSON.parse(s)
      if (r.preset && r.start && r.end) return r
    }
  } catch {}
  return null
}

export function saveRange(range) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(range)) } catch {}
}
