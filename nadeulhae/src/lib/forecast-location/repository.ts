import type { RowDataPacket } from "mysql2/promise"

import forecastLocationGridRaw from "@/data/forecast-location-grid.json"
import { getDbPool } from "@/lib/db"
import type { ForecastLocationPoint } from "@/lib/weather-utils"

declare global {
  var __nadeulhaeForecastLocationBootstrapPromise: Promise<void> | undefined
  var __nadeulhaeForecastLocationNearestCache: Map<string, ForecastLocationPoint | null> | undefined
}

interface ForecastLocationCountRow extends RowDataPacket {
  count: number
}

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

function findNearestInMemory(lat: number, lon: number) {
  let minDistanceSq = Infinity
  let nearest: ForecastLocationPoint | null = null

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

function getCache() {
  if (!globalThis.__nadeulhaeForecastLocationNearestCache) {
    globalThis.__nadeulhaeForecastLocationNearestCache = new Map()
  }
  return globalThis.__nadeulhaeForecastLocationNearestCache
}

function makeCacheKey(lat: number, lon: number) {
  return `${Math.round(lat * 1000)}:${Math.round(lon * 1000)}`
}

async function refillForecastLocationTable() {
  const pool = getDbPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query("DELETE FROM forecast_location_points")

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
  while (cache.size > CACHE_MAX_SIZE) {
    const firstKey = cache.keys().next().value as string | undefined
    if (!firstKey) break
    cache.delete(firstKey)
  }

  return nearest
}
