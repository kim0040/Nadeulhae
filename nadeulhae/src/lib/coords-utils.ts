import proj4 from "proj4"

// WGS84 (Global Standard)
const WGS84 = "EPSG:4326"

// Korea 2000 / Unified CS (EPSG:5179-like) used by AirKorea nearby station API.
// Using central-belt local TM here (e.g. EPSG:5181) can misplace points and return wrong stations.
const KOREA_TM = "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs"

/**
 * Converts WGS84 (Latitude, Longitude) to Korean TM (X, Y)
 * @param lat Latitude
 * @param lon Longitude
 * @returns [tmX, tmY]
 */
export function wgs84ToTm(lat: number, lon: number): [number, number] {
  // proj4 expects [longitude, latitude] for WGS84
  const [tmX, tmY] = proj4(WGS84, KOREA_TM, [lon, lat])
  return [tmX, tmY]
}
