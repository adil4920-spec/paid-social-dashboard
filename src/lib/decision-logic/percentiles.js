import { MIN_SPEND } from './config.js'

// Fractional rank (0..1, higher value = better rank) for higher-is-better metric
function fracRank(sortedAsc, value) {
  if (sortedAsc.length <= 1) return 0.5
  const below = sortedAsc.filter(v => v < value).length
  return below / (sortedAsc.length - 1)
}

// Add p_roas_percentile (0–1) and p_cpa_percentile (0–1, higher=better) to each entity.
// getRoas/getCpa/getSpend: accessor fns for nested objects (e.g. adsets use a.l7.roas).
export function addRoasPercentiles(entities, {
  getRoas  = e => e.roas,
  getCpa   = e => e.cpa,
  getSpend = e => e.spend,
} = {}) {
  const qualified = entities.filter(e => (getSpend(e) ?? 0) >= MIN_SPEND)
  if (qualified.length < 5) {
    return entities.map(e => ({ ...e, p_roas_percentile: null, p_cpa_percentile: null }))
  }
  const roasAsc = qualified.map(getRoas).sort((a, b) => a - b)
  const cpaQual = qualified.filter(e => getCpa(e) > 0)
  const cpaAsc  = cpaQual.map(getCpa).sort((a, b) => a - b)

  return entities.map(e => {
    if ((getSpend(e) ?? 0) < MIN_SPEND) {
      return { ...e, p_roas_percentile: null, p_cpa_percentile: null }
    }
    return {
      ...e,
      p_roas_percentile: fracRank(roasAsc, getRoas(e)),
      // For CPA, lower is better so we invert the rank
      p_cpa_percentile: cpaAsc.length > 1 ? 1 - fracRank(cpaAsc, getCpa(e)) : null,
    }
  })
}

// Add i_roas_percentile (0–1) to each entity.
export function addIncrementalPercentiles(entities, {
  getIRoas = e => e.iRoas,
  getSpend = e => e.spend,
} = {}) {
  const qualified = entities.filter(e =>
    (getSpend(e) ?? 0) >= MIN_SPEND && (getIRoas(e) ?? 0) > 0
  )
  if (qualified.length < 5) {
    return entities.map(e => ({ ...e, i_roas_percentile: null }))
  }
  const iRoasAsc = qualified.map(getIRoas).sort((a, b) => a - b)
  return entities.map(e => {
    const ir = getIRoas(e) ?? 0
    if (ir <= 0) return { ...e, i_roas_percentile: null }
    return { ...e, i_roas_percentile: fracRank(iRoasAsc, ir) }
  })
}

// Human-readable band label
export function percentileBand(pct) {
  if (pct == null) return null
  if (pct >= 0.75) return 'Top 25%'
  if (pct >= 0.50) return 'Top half'
  if (pct >= 0.25) return 'Bottom half'
  return 'Bottom 25%'
}

// Colour for a percentile rank (higher=better)
export function percentileColor(pct) {
  if (pct == null) return '#A3A3A3'
  if (pct >= 0.75) return '#16A34A'
  if (pct >= 0.50) return '#737373'
  if (pct >= 0.25) return '#D97706'
  return '#DC2626'
}
