import { useState, useEffect } from 'react'
import Papa from 'papaparse'

const REGIONS = ['US', 'AU', 'UK', 'ROW', 'GLOBAL']

// New PACER NEW sheet: label at col6, region values at cols 7-11 (US, AU, UK, ROW, Global)
const LABEL_MAP = {
  'MER':                      'mer',
  'ROAS':                     'roas',
  'Monthly Revenue Target':   'revTarget',
  'Revenue up to yesterday':  'revActual',
  'Revenue Run Rate %':       'revVsTarget',
  'Total Budget':             'spendBudget',
  'Spend up to Yesterday':    'spendActual',
  'Spend Run Rate %':         'spendVsBudget',
}

function parseNum(s) {
  if (!s) return null
  const clean = String(s).replace(/[$,%x\s]/g, '').replace(/,/g, '').trim()
  const n = parseFloat(clean)
  return isNaN(n) ? null : n
}

export function usePacerData() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const url = import.meta.env.VITE_PACER_URL
    if (!url) { setLoading(false); return }

    Papa.parse(url, {
      download: true,
      skipEmptyLines: false,
      complete: ({ data: rows }) => {
        const metrics = {}

        // Summary metrics: label at col6, values at cols 7-11 [US, AU, UK, ROW, Global]
        for (const row of rows) {
          const label = (row[6] || '').trim()
          if (LABEL_MAP[label]) {
            metrics[LABEL_MAP[label]] = row.slice(7, 12).map(parseNum)
          }
        }

        // daysElapsed / daysInMonth computed from today's date
        const now = new Date()
        const daysElapsed  = now.getDate() - 1  // yesterday = last complete day
        const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

        // Parse AU daily section — find row where col3 === 'AU', then next 'Date' header
        const anzDaily = []
        let inAuSection = false, pastHeader = false
        for (const row of rows) {
          if (!inAuSection) {
            if ((row[3] || '').trim() === 'AU') { inAuSection = true }
            continue
          }
          if (!pastHeader) {
            if ((row[3] || '').trim() === 'Date') { pastHeader = true }
            continue
          }
          const date = (row[3] || '').trim()
          if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) break
          const revenue      = parseNum(row[12])
          const spend        = parseNum(row[8])
          const mer          = parseNum(row[15])
          const orders       = parseNum(row[18])
          const aov          = parseNum(row[20])
          const newCustomers = parseNum(row[25])
          const ncac         = parseNum(row[26])
          if (revenue != null || mer != null) {
            anzDaily.push({ date, revenue, spend, mer, orders, aov, newCustomers, ncac })
          }
        }

        setData({ regions: REGIONS, metrics, daysElapsed, daysInMonth, anzDaily })
        setLoading(false)
      },
      error: () => setLoading(false),
    })
  }, [])

  return { data, loading }
}
