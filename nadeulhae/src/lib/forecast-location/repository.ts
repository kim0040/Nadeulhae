/**
 * Forecast location grid data access layer.
 *
 * Manages a MySQL table of administrative-division → forecast-grid mappings
 * for Korea's meteorological forecast system. On first use the table is
 * bootstrapped from a bundled JSON dataset. Subsequent lookups query the DB
 * with a Euclidean-distance ORDER BY, falling back to an in-memory scan of
 * the bundled data when the DB is unavailable.
 *
 * Lookup results are cached in a global LRU-like Map (max 700 entries) keyed
 * by rounded lat/lon coordinates to avoid redundant DB hits.
 */

import type { RowDataPacket } from "mysql2/promise"

import forecastLocationGridRaw from "@/data/forecast-location-grid.json"
import { getDbPool } from "@/lib/db"
import type { ForecastLocationPoint } from "@/lib/weather-utils"

// Global singletons for lazy bootstrap and nearest-point cache.
declare global {
  var __nadeulhaeForecastLocationBootstrapPromise: Promise<void> | undefined
  var __nadeulhaeForecastLocationNearestCache: Map<string, ForecastLocationPoint | null> | undefined
}

/** Row shape returned by the COUNT query. */
interface ForecastLocationCountRow extends RowDataPacket {
  count: number
}

/** Row shape returned by the nearest-point query with aliased column names. */
interface ForecastLocationDbRow extends RowDataPacket {
  adminCode: string
  level1: string
  level2: string
  level3: string
  gridX: number
  gridY: number
  lon: number | string
  lat: number | string
}

// Bundled JSON dataset used as the bootstrap source and DB-fallback.
const FORECAST_LOCATION_POINTS = forecastLocationGridRaw as ForecastLocationPoint[]
const INSERT_CHUNK_SIZE = 300
const CACHE_MAX_SIZE = 700

const createForecastLocationTableSql = `
  CREATE TABLE IF NOT EXISTS forecast_location_points (
    admin_code CHAR(10) PRIMARY KEY,
    level1_name VARCHAR(80) NOT NULL,
    level2_name VARCHAR(80) NOT NULL DEFAULT '',
    level3_name VARCHAR(80) NOT NULL DEFAULT '',
    grid_x SMALLINT UNSIGNED NOT NULL,
    grid_y SMALLINT UNSIGNED NOT NULL,
    lon DECIMAL(12, 9) NOT NULL,
    lat DECIMAL(11, 9) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_forecast_location_lat_lon (lat, lon),
    KEY idx_forecast_location_levels (level1_name, level2_name, level3_name)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

const selectForecastLocationCountSql = `
  SELECT COUNT(*) AS count
  FROM forecast_location_points
`

const selectNearestForecastLocationSql = `
  SELECT
    admin_code AS adminCode,
    level1_name AS level1,
    level2_name AS level2,
    level3_name AS level3,
    grid_x AS gridX,
    grid_y AS gridY,
    lon,
    lat
  FROM forecast_location_points
  ORDER BY POW(lat - ?, 2) + POW(lon - ?, 2)
  LIMIT 1
`

/** Converts a DB row to the common ForecastLocationPoint shape, returning null if coordinates are invalid. */
function normalizePointFromDb(row: ForecastLocationDbRow): ForecastLocationPoint | null {
  const lon = Number(row.lon)
  const lat = Number(row.lat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return null
  }

  return {
    adminCode: String(row.adminCode),
    level1: String(row.level1 ?? ""),
    level2: String(row.level2 ?? ""),
    level3: String(row.level3 ?? ""),
    gridX: Number(row.gridX),
    gridY: Number(row.gridY),
    lon,
    lat,
  }
}

/** Brute-force nearest-neighbor search over the in-memory JSON dataset using squared Euclidean distance. */
function findNearestInMemory(lat: number, lon: number) {
  let minDistanceSq = Infinity
  let nearest: ForecastLocationPoint | null = null

  // Linear scan — dataset is small enough that an index is unnecessary.
  for (const point of FORECAST_LOCATION_POINTS) {
    const dLat = lat - point.lat
    const dLon = lon - point.lon
    const distanceSq = dLat * dLat + dLon * dLon
    if (distanceSq < minDistanceSq) {
      minDistanceSq = distanceSq
      nearest = point
    }
  }

  return nearest
}

/** Lazily initializes and returns the global nearest-point LRU cache. */
function getCache() {
  if (!globalThis.__nadeulhaeForecastLocationNearestCache) {
    globalThis.__nadeulhaeForecastLocationNearestCache = new Map()
  }
  return globalThis.__nadeulhaeForecastLocationNearestCache
}

/** Produces a stable cache key from lat/lon rounded to 3 decimal places (~111 m resolution). */
function makeCacheKey(lat: number, lon: number) {
  return `${Math.round(lat * 1000)}:${Math.round(lon * 1000)}`
}

/** Truncates and re-populates the forecast_location_points table from the bundled JSON dataset. */
async function refillForecastLocationTable() {
  const pool = getDbPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query("DELETE FROM forecast_location_points")

    // Batched INSERT to avoid oversized query packets (~300 rows per batch).
    for (let offset = 0; offset < FORECAST_LOCATION_POINTS.length; offset += INSERT_CHUNK_SIZE) {
      const chunk = FORECAST_LOCATION_POINTS.slice(offset, offset + INSERT_CHUNK_SIZE)
      const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ")
      const params = chunk.flatMap((point) => [
        point.adminCode,
        point.level1,
        point.level2,
        point.level3,
        point.gridX,
        point.gridY,
        point.lon,
        point.lat,
      ])

      await conn.query(
        `
          INSERT INTO forecast_location_points (
            admin_code,
            level1_name,
            level2_name,
            level3_name,
            grid_x,
            grid_y,
            lon,
            lat
          )
          VALUES ${placeholders}
        `,
        params
      )
    }

    await conn.commit()
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

/**
 * Ensures the forecast_location_points table exists and is populated.
 *
 * Uses a global promise singleton so concurrent callers share the same
 * bootstrap operation. If the row count doesn't match the bundled dataset,
 * the table is truncated and refilled.
 */
export async function ensureForecastLocationRepositoryReady() {
  if (globalThis.__nadeulhaeForecastLocationBootstrapPromise) {
    return globalThis.__nadeulhaeForecastLocationBootstrapPromise
  }

  const bootstrapPromise = (async () => {
    const pool = getDbPool()
    await pool.query(createForecastLocationTableSql)
    const [countRows] = await pool.query<ForecastLocationCountRow[]>(selectForecastLocationCountSql)
    const rowCount = Number(countRows[0]?.count ?? 0)
    if (rowCount !== FORECAST_LOCATION_POINTS.length) {
      await refillForecastLocationTable()
    }
  })()

  globalThis.__nadeulhaeForecastLocationBootstrapPromise = bootstrapPromise.catch((error) => {
    console.error("[forecast-location] Bootstrap failed:", error.message ?? error)
  })

  return globalThis.__nadeulhaeForecastLocationBootstrapPromise
}

/**
 * Resolves the closest forecast grid point for the given coordinates.
 *
 * Checks the LRU cache first, then queries the DB via Euclidean-distance
 * ORDER BY. Falls back to an in-memory scan over the bundled JSON on
 * DB failure. Results are cached and the cache is evicted (oldest-first)
 * when it exceeds CACHE_MAX_SIZE.
 */
export async function resolveNearestForecastLocationPoint(lat?: number | null, lon?: number | null) {
  if (lat == null || lon == null) {
    return null
  }

  const normalizedLat = Number(lat)
  const normalizedLon = Number(lon)
  if (!Number.isFinite(normalizedLat) || !Number.isFinite(normalizedLon)) {
    return null
  }

  const cache = getCache()
  const cacheKey = makeCacheKey(normalizedLat, normalizedLon)
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null
  }

  let nearest: ForecastLocationPoint | null = null
  try {
    await ensureForecastLocationRepositoryReady()
    const pool = getDbPool()
    const [rows] = await pool.query<ForecastLocationDbRow[]>(selectNearestForecastLocationSql, [
      normalizedLat,
      normalizedLon,
    ])
    nearest = rows.length > 0 ? normalizePointFromDb(rows[0]) : null
  } catch (error) {
    console.warn("[forecast-location] DB lookup failed; falling back to bundled JSON dataset.", error)
    nearest = findNearestInMemory(normalizedLat, normalizedLon)
  }

  cache.set(cacheKey, nearest)
  // LRU-style eviction: delete the oldest entries when the cache overflows.
  while (cache.size > CACHE_MAX_SIZE) {
    const firstKey = cache.keys().next().value as string | undefined
    if (!firstKey) break
    cache.delete(firstKey)
  }

  return nearest
}
