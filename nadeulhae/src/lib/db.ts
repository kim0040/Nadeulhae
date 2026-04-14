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

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

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

export function getDbPool() {
  if (globalThis.__nadeulhaeDbPool) {
    return globalThis.__nadeulhaeDbPool
  }

  const config: PoolOptions = {
    host: requireEnv("DB_HOST"),
    port: Number(process.env.DB_PORT ?? "4000"),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    database: requireEnv("DB_NAME"),
    ssl: resolveSslOptions(),
    timezone: "+00:00",
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT ?? "10"),
    queueLimit: 0,
    enableKeepAlive: true,
  }

  globalThis.__nadeulhaeDbPool = mysql.createPool(config)
  return globalThis.__nadeulhaeDbPool
}

export async function queryRows<T extends RowDataPacket[]>(
  sql: string,
  params: any[] = []
) {
  const [rows] = await getDbPool().query<T>(sql, params)
  return rows
}

export async function executeStatement(
  sql: string,
  params: any[] = []
) {
  const [result] = await getDbPool().execute<ResultSetHeader>(sql, params)
  return result
}
