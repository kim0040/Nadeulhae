/**
 * KMA PM10 (황사) observation station list and nearest-station resolution.
 *
 * Fetches the full KMA station list once from the APIHub endpoint
 * (`typ01/url/stn_pm10_inf.php`) and caches it in memory for the
 * process lifetime. Provides haversine-based nearest-station lookup
 * given WGS84 coordinates.
 *
 * KMA station format (pipe-delimited):
 *   STN_ID | TM_ED | TM_ST | STN_KO | STN_EN | STN_SP | LON | LAT | HT | ...
 *   Column indices: 0=stnId, 1=tm_ed, 2=tm_st, 3=stnKo, 4=stnEn, 5=lon, 6=lat, 7=ht
 *
 * This complements the AirKorea-based air quality station lookup by
 * providing KMA weather observation station coordinates.
 *
 * @module kma-stations
 */

interface KmaStationInfo {
  stnId: number
  stnKo: string
  stnEn: string
  lon: number
  lat: number
  ht: number
}

let _kmaStationList: KmaStationInfo[] | null = null
let _kmaStationFetchError = false

/**
 * Parse one line of the KMA station list API response.
 * Format: "STN_ID STN_KO STN_EN ... LON LAT HT ..."
 * Returns null if the line is malformed or missing required fields.
 */
function parseKmaStationLine(line: string): KmaStationInfo | null {
  const cols = line.split(/\s+/).filter(Boolean)
  // Need at least 8 columns: id, ko, en, spare, spare, lon, lat, ht
  if (cols.length < 8) return null
  const stnId = Number(cols[0])
  const stnKo = cols[3] // Korean station name
  const stnEn = cols[4] // English station name
  const lon = Number(cols[5]) // Longitude in degrees
  const lat = Number(cols[6]) // Latitude in degrees
  const ht = Number(cols[7]) // Height above sea level (meters)
  if (!Number.isFinite(stnId) || !Number.isFinite(lon) || !Number.isFinite(lat)) {
    return null
  }
  return { stnId, stnKo, stnEn, lon, lat, ht }
}

/**
 * Fetch and cache the full KMA PM10 observation station list.
 * On failure, sets an error flag to prevent retries within the
 * same process lifetime. Returns an empty array on error.
 */
export async function getKmaStationList(): Promise<KmaStationInfo[]> {
  if (_kmaStationList) return _kmaStationList
  if (_kmaStationFetchError) return []

  const apiKey = process.env.KMA_API_KEY
  if (!apiKey) {
    _kmaStationFetchError = true
    return []
  }

  try {
    const url =
      `https://apihub.kma.go.kr/api/typ01/url/stn_pm10_inf.php` +
      `?inf=kma&stn=&authKey=${apiKey}&help=0`
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) {
      _kmaStationFetchError = true
      return []
    }
    const text = await response.text()
    const lines = text.split("\n")
    const stations: KmaStationInfo[] = []
    for (const line of lines) {
      if (line.startsWith("#") || !line.trim()) continue
      const station = parseKmaStationLine(line)
      if (station) stations.push(station)
    }
    _kmaStationList = stations
    return stations
  } catch {
    _kmaStationFetchError = true
    return []
  }
}

/**
 * Calculate the great-circle distance between two points
 * using the Haversine formula.
 *
 * @returns Distance in kilometers
 */
function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Find the nearest KMA PM10 observation station to the given WGS84
 * coordinates. Returns null if the station list is unavailable.
 */
export async function getNearestKmaStation(
  lat: number,
  lon: number
): Promise<KmaStationInfo | null> {
  const stations = await getKmaStationList()
  if (stations.length === 0) return null

  let nearest = stations[0]
  let nearestDist = haversineDistanceKm(lat, lon, nearest.lat, nearest.lon)
  for (let i = 1; i < stations.length; i++) {
    const dist = haversineDistanceKm(lat, lon, stations[i].lat, stations[i].lon)
    if (dist < nearestDist) {
      nearest = stations[i]
      nearestDist = dist
    }
  }
  return nearest
}
