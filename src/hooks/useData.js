import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { generateSampleData } from '../utils/sampleData'

export function useData() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [usingDemo, setUsingDemo] = useState(false)

  useEffect(() => {
    const url = import.meta.env.VITE_SHEETS_URL

    if (!url) {
      setRows(generateSampleData())
      setUsingDemo(true)
      setLoading(false)
      return
    }

    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsed = results.data.map((r) => ({
            date: r.date?.trim() ?? '',
            channel: r.channel?.trim() ?? 'Unknown',
            spend: parseFloat(r.spend) || 0,
            revenue: parseFloat(r.revenue) || 0,
            orders: parseInt(r.orders, 10) || 0,
            new_customers: parseInt(r.new_customers, 10) || 0,
            cogs: parseFloat(r.cogs) || 0,
          })).filter((r) => r.date)

          if (parsed.length === 0) throw new Error('No rows found in sheet')
          setRows(parsed)
        } catch (e) {
          setError(e.message)
          setRows(generateSampleData())
          setUsingDemo(true)
        }
        setLoading(false)
      },
      error: (err) => {
        setError(err.message)
        setRows(generateSampleData())
        setUsingDemo(true)
        setLoading(false)
      },
    })
  }, [])

  return { rows, loading, error, usingDemo }
}
