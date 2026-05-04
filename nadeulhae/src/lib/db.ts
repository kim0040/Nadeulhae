/**
 * @fileoverview MySQL database connection pool singleton.
 *
 * Provides a shared `Pool` instance (stored on `globalThis` to survive
 * HMR in dev) and two thin query helpers (`queryRows`, `executeStatement`).
 * SSL is resolved from `DB_CA_PATH` or system CA bundle; pool sizing
 * is tuned per `NODE_ENV`.
 *
 * @module db
 */

import fs from "node:fs"

import mysql, {
  type Pool,
  type PoolOptions,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise"

declare global {
  var __nadeulhaeDbPool: Pool | undefined
}

/** Reads a required env var or throws with a clear message. */
function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/**
 * Resolves SSL/TLS CA options for the MySQL connection.
 * Priority: explicit `DB_CA_PATH` → system CA bundle → defaults with
 * `TLSv1.2` as minimum version.
 */
function resolveSslOptions() {
  const caPath = process.env.DB_CA_PATH

  if (caPath) {
    try {
      return {
        ca: fs.readFileSync(/*turbopackIgnore: true*/ caPath, "utf8"),
        rejectUnauthorized: true,
      }
    } catch {
      console.warn(`[db] DB_CA_PATH="${caPath}" not found, falling back to system CA bundle.`)
    }
  }

  const fallbackPaths = [
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/ssl/cert.pem",
    "/usr/local/share/ca-certificates/",
    "/etc/ssl/certs/",
  ]

  for (const path of fallbackPaths) {
    try {
      const stat = fs.statSync(/*turbopackIgnore: true*/ path)
      if (stat.isFile()) {
        return {
          ca: fs.readFileSync(/*turbopackIgnore: true*/ path, "utf8"),
          rejectUnauthorized: true,
        }
      }
    } catch {
      continue
    }
  }

  return {
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  }
}

/** Returns the shared connection pool. Creates it lazily on first call. */
export function getDbPool() {
  if (globalThis.__nadeulhaeDbPool) {
    return globalThis.__nadeulhaeDbPool
  }

  const connectionLimit = Number(process.env.DB_POOL_LIMIT ?? "10")
  const isProduction = process.env.NODE_ENV === "production"

  // In dev, cap at min(2, connectionLimit) and set queueLimit to 100
  // to avoid exhausting connections on HMR reloads.
  const config: PoolOptions = {
    host: requireEnv("DB_HOST"),
    port: Number(process.env.DB_PORT ?? "4000"),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    database: requireEnv("DB_NAME"),
    ssl: resolveSslOptions(),
    timezone: "+00:00",
    waitForConnections: true,
    connectionLimit: isProduction ? connectionLimit : Math.max(2, connectionLimit),
    queueLimit: isProduction ? 0 : 100,
    enableKeepAlive: true,
    connectTimeout: 10000,
  }

  globalThis.__nadeulhaeDbPool = mysql.createPool(config)
  return globalThis.__nadeulhaeDbPool
}

/**
 * Runs a SELECT-style query and returns the result rows.
 * Uses `pool.query()` which prepares + executes in one round trip.
 */
export async function queryRows<T extends RowDataPacket[]>(
  sql: string,
  params: any[] = []
) {
  const [rows] = await getDbPool().query<T>(sql, params)
  return rows
}

/**
 * Runs an INSERT/UPDATE/DELETE statement and returns the result header
 * (affected rows, insert ID, etc.). Uses `pool.execute()` for prepared
 * statement reuse across calls.
 */
export async function executeStatement(
  sql: string,
  params: any[] = []
) {
  const [result] = await getDbPool().execute<ResultSetHeader>(sql, params)
  return result
}
