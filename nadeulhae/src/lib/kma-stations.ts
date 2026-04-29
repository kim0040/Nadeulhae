// KMA PM10 observation station list and nearest-station resolution.
// Caches the full station list in memory on first access.
// Uses KMA APIHub typ01/url/stn_pm10_inf.php endpoint.

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

function parseKmaStationLine(line: string): KmaStationInfo | null {
  const cols = line.split(/\s+/).filter(Boolean)
  if (cols.length < 6) return null
  const stnId = Number(cols[0])
  const stnKo = cols[1]
  const stnEn = cols[2]
  const lon = Number(cols[5])
  const lat = Number(cols[6])
  const ht = Number(cols[7])
  if (!Number.isFinite(stnId) || !Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return { stnId, stnKo, stnEn, lon, lat, ht }
}

export async function getKmaStationList(): Promise<KmaStationInfo[]> {
  if (_kmaStationList) return _kmaStationList
  if (_kmaStationFetchError) return []

  const apiKey = process.env.KMA_API_KEY
  if (!apiKey) {
    _kmaStationFetchError = true
    return []
  }

  try {
    const url = `https://apihub.kma.go.kr/api/typ01/url/stn_pm10_inf.php?inf=kma&stn=&authKey=${apiKey}&help=0`
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) {
      _kmaStationFetchError = true
      return []
    }
    const text = await response.text()
    const lines = text.split("\n")
    const stations: KmaStationInfo[] = []
    for (const line of lines) {
      // Skip comment and header lines
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

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
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
