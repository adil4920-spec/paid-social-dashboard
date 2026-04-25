// Generates 90 days of realistic paid social sample data
export function generateSampleData() {
  const channels = ['Meta', 'TikTok', 'Pinterest']
  const rows = []
  const today = new Date()

  for (let d = 89; d >= 0; d--) {
    const date = new Date(today)
    date.setDate(date.getDate() - d)
    const dateStr = date.toISOString().split('T')[0]

    // Day-of-week seasonality (weekends lower)
    const dow = date.getDay()
    const dowMult = dow === 0 || dow === 6 ? 0.75 : 1.0

    // Trend: slight growth over time
    const trendMult = 1 + (89 - d) * 0.003

    for (const channel of channels) {
      let baseSpend, baseRevenue, baseNewCustomers, baseOrders, baseCogs

      if (channel === 'Meta') {
        baseSpend = 1800
        baseRevenue = 7200
        baseNewCustomers = 38
        baseOrders = 95
        baseCogs = 2880
      } else if (channel === 'TikTok') {
        baseSpend = 900
        baseRevenue = 2700
        baseNewCustomers = 22
        baseOrders = 55
        baseCogs = 1080
      } else {
        baseSpend = 450
        baseRevenue = 1350
        baseNewCustomers = 11
        baseOrders = 28
        baseCogs = 540
      }

      const noise = () => 0.85 + Math.random() * 0.3

      rows.push({
        date: dateStr,
        channel,
        spend: +(baseSpend * dowMult * trendMult * noise()).toFixed(2),
        revenue: +(baseRevenue * dowMult * trendMult * noise()).toFixed(2),
        orders: Math.round(baseOrders * dowMult * trendMult * noise()),
        new_customers: Math.round(baseNewCustomers * dowMult * trendMult * noise()),
        cogs: +(baseCogs * dowMult * trendMult * noise()).toFixed(2),
      })
    }
  }

  return rows
}
