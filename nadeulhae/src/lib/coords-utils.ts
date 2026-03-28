import proj4 from "proj4"

// WGS84 (Global Standard)
const WGS84 = "EPSG:4326"

// Korea TM (GRS80 / Central Belt) - Commonly used by AirKorea getNearbyMsrstnList
// Some versions might use EPSG:5181 or 5186. Let's use EPSG:5181 as the standard for TM coordinates in this context.
const KOREA_TM = "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs"

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
