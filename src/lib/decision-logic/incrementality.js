import { ROAS_GAP_GENUINE, ROAS_GAP_AMBER } from './config.js'

export function calcRoasGapPct(pRoas, iRoas) {
  if (!pRoas || pRoas <= 0 || !iRoas || iRoas <= 0) return null
  return ((pRoas - iRoas) / pRoas) * 100
}

export function calcAttrMultiple(pRoas, iRoas) {
  if (!iRoas || iRoas <= 0) return null
  return pRoas / iRoas
}

export function incrementalEfficiencyClass(gapPct) {
  if (gapPct == null) return 'Unknown'
  if (gapPct < ROAS_GAP_GENUINE) return 'Genuine performer'
  if (gapPct <= ROAS_GAP_AMBER)  return 'Mixed'
  return 'Attribution-inflated'
}

export function roasGapLabel(gapPct) {
  if (gapPct == null) return null
  if (gapPct < ROAS_GAP_GENUINE) return 'genuine'
  if (gapPct <= ROAS_GAP_AMBER)  return 'monitor'
  return 'over-claimed'
}
