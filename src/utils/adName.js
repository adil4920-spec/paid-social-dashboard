// Parser for the ad naming convention:
// PLR:[Pillar] | CAMP:[CampType] | RNG:[Range] | COL:[Collection] | PRNT:[Print] | TYP:[CreativeType] | [Description] | [Format] | [Date] | [Region]
// Delimiter: space-pipe-space ( | )

const TAG_MAP = {
  'PLR:':  'pillar',
  'CAMP:': 'campType',
  'RNG:':  'range',
  'COL:':  'collection',
  'PRNT:': 'print',
  'TYP:':  'creativeType',
}

// Known valid region codes → canonical label
const REGION_MAP = {
  AUS: 'AU',
  AU:  'AU',
  UK:  'UK',
  GB:  'UK',
  US:  'US',
  USA: 'US',
  NZ:  'NZ',
  CA:  'CA',
  EU:  'EU',
  ROW: 'ROW',
}

// Known format values from naming convention (longer ones first to prevent partial matching)
const KNOWN_FORMATS = new Set([
  'PAC Video', 'PAC Image',
  'Carousel - Image', 'Carousel - Video',
  'Collection - Image', 'Collection - Video',
  'Catalogue - Product Set', 'Catalogue - Video',
  'Static Reminder', 'Video Reminder',
  'Image', 'Video',
])

const EMPTY = {
  pillar: null, campType: null, range: null,
  collection: null, print: null, creativeType: null,
  description: null, format: null, productionDate: null, adRegion: null,
}

export function parseAdName(adName) {
  if (!adName || !adName.includes('PLR:')) return { ...EMPTY }

  const parts    = adName.split(' | ')
  const result   = { ...EMPTY }
  const untagged = []

  for (const part of parts) {
    let matched = false
    for (const [prefix, field] of Object.entries(TAG_MAP)) {
      if (part.startsWith(prefix)) {
        result[field] = part.slice(prefix.length).trim()
        matched = true
        break
      }
    }
    if (!matched) untagged.push(part.trim())
  }

  // Untagged positional fields: Description, Format, Date (6–8 digits), Region
  for (const u of untagged) {
    if (/^\d{6,8}$/.test(u)) {
      result.productionDate = normaliseDate(u)
    } else if (REGION_MAP[u.toUpperCase()]) {
      result.adRegion = REGION_MAP[u.toUpperCase()]
    } else if (KNOWN_FORMATS.has(u)) {
      // Explicit format match takes priority — assign immediately if not yet set
      if (result.format === null) result.format = u
    } else if (result.description === null) {
      result.description = u
    } else if (result.format === null) {
      result.format = u
    }
  }

  return result
}

// Normalise 6–8 digit production dates to YYYY-MM-DD
// Handles YYYYMMDD (20260129) and DDMMYYYY / DMMYYYY (26032026, 6042026)
// Disambiguates by checking which interpretation yields a valid month (01–12)
function normaliseDate(raw) {
  const p = raw.padStart(8, '0')
  const yyyymmddYear  = parseInt(p.slice(0, 4))
  const yyyymmddMonth = parseInt(p.slice(4, 6))
  if (yyyymmddYear >= 2000 && yyyymmddYear <= 2099 && yyyymmddMonth >= 1 && yyyymmddMonth <= 12) {
    return `${p.slice(0, 4)}-${p.slice(4, 6)}-${p.slice(6, 8)}`
  }
  // DDMMYYYY: year in last 4 chars, month in chars 2-4
  const ddmmyyyyYear  = parseInt(p.slice(4, 8))
  const ddmmyyyyMonth = parseInt(p.slice(2, 4))
  if (ddmmyyyyYear >= 2000 && ddmmyyyyYear <= 2099 && ddmmyyyyMonth >= 1 && ddmmyyyyMonth <= 12) {
    return `${p.slice(4, 8)}-${p.slice(2, 4)}-${p.slice(0, 2)}`
  }
  return raw
}
