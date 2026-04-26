// Percentile thresholds for internal ranking
export const TOP_QUARTILE    = 0.75
export const TOP_HALF        = 0.50
export const BOTTOM_QUARTILE = 0.25
export const BOTTOM_20       = 0.20

// Time windows
export const BASELINE_WINDOW = 28
export const RECENT_WINDOW   = 7

// Meaningful change thresholds (%)
export const MEANINGFUL_CHANGE  = 10
export const SIGNIFICANT_CHANGE = 20

// Creative fatigue / saturation (unchanged from original)
export const FATIGUE_KILL     = 80
export const FATIGUE_REFRESH  = 60
export const SATURATION       = 70
export const FREQ_SATURATION  = 5
export const FREQ_HEALTHY_MAX = 3
export const FREQ_SCALE_HEADROOM = 2.5

// Incrementality (ad set and campaign level only)
export const ROAS_GAP_GENUINE = 25   // gap % below this → genuine performance
export const ROAS_GAP_AMBER   = 60   // 25-60 → monitor
export const ROAS_GAP_RED     = 60   // above this → Meta over-claiming
export const ATTR_MULTIPLE_RED = 3   // p_roas / i_roas above this → red

// Spend thresholds
export const HIGH_SPEND    = 200
export const MED_SPEND     = 100
export const MIN_SPEND     = 50
export const MIN_DAYS_HIGH = 7
export const MIN_DAYS_MED  = 4

// Health string pill colours (shared across all views)
export const HEALTH_COLORS = {
  // Green
  'Scale':                  { c: '#15803D', bg: '#DCFCE7', br: '#BBF7D0' },
  'Healthy':                { c: '#16A34A', bg: '#F0FDF4', br: '#D1FAE5' },
  // Blue
  'Cap too tight':          { c: '#1D4ED8', bg: '#EFF6FF', br: '#BFDBFE' },
  'Volume opportunity':     { c: '#1D4ED8', bg: '#EFF6FF', br: '#BFDBFE' },
  // Amber
  'Monitor':                { c: '#92400E', bg: '#FEF3C7', br: '#FDE68A' },
  'Inconsistent':           { c: '#92400E', bg: '#FEF3C7', br: '#FDE68A' },
  'Investigate attribution':{ c: '#92400E', bg: '#FEF3C7', br: '#FDE68A' },
  // Orange
  'Refresh soon':           { c: '#C2410C', bg: '#FFF7ED', br: '#FED7AA' },
  'Refresh audience':       { c: '#C2410C', bg: '#FFF7ED', br: '#FED7AA' },
  'Audience saturated':     { c: '#C2410C', bg: '#FFF7ED', br: '#FED7AA' },
  'Restructure':            { c: '#C2410C', bg: '#FFF7ED', br: '#FED7AA' },
  // Red
  'Kill':                   { c: '#B91C1C', bg: '#FEF2F2', br: '#FECACA' },
  'Defund':                 { c: '#B91C1C', bg: '#FEF2F2', br: '#FECACA' },
  'Underperforming':        { c: '#DC2626', bg: '#FEF2F2', br: '#FECACA' },
  // Grey
  'Too new':                { c: '#737373', bg: '#F5F5F5', br: '#E5E5E5' },
}

// Roas gap conditional format colours
export function roasGapColor(gapPct) {
  if (gapPct == null) return '#A3A3A3'
  if (gapPct < ROAS_GAP_GENUINE) return '#16A34A'
  if (gapPct < ROAS_GAP_AMBER)   return '#D97706'
  return '#DC2626'
}

// Trajectory indicator colour
export function trajectoryColor(changePct) {
  if (changePct == null) return '#A3A3A3'
  if (changePct >  MEANINGFUL_CHANGE) return '#16A34A'
  if (changePct < -MEANINGFUL_CHANGE) return '#DC2626'
  return '#737373'
}

export function trajectoryArrow(changePct) {
  if (changePct == null) return '—'
  if (changePct >  MEANINGFUL_CHANGE) return '↑'
  if (changePct < -MEANINGFUL_CHANGE) return '↓'
  return '→'
}
