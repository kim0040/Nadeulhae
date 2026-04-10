import fs from "node:fs"
import path from "node:path"

import mysql from "mysql2/promise"

const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8")
  for (const line of envContent.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue
    const separatorIndex = line.indexOf("=")
    if (separatorIndex < 0) continue
    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

for (const key of ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

const datasetPath = path.join(process.cwd(), "src", "data", "forecast-location-grid.json")
const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8"))
if (!Array.isArray(dataset) || dataset.length === 0) {
  throw new Error("Forecast location dataset is empty.")
}

function resolveSslOptions() {
  const caPath = process.env.DB_CA_PATH
  if (caPath && fs.existsSync(caPath)) {
    return { ca: fs.readFileSync(caPath, "utf8"), rejectUnauthorized: true }
  }

  for (const candidate of ["/etc/ssl/certs/ca-certificates.crt", "/etc/ssl/cert.pem"]) {
    if (fs.existsSync(candidate)) {
      return { ca: fs.readFileSync(candidate, "utf8"), rejectUnauthorized: true }
    }
  }

  return { rejectUnauthorized: true, minVersion: "TLSv1.2" }
}

const ssl = resolveSslOptions()

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? "4000"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl,
})

await connection.query(`
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
`)

const [[countRow]] = await connection.query("SELECT COUNT(*) AS count FROM forecast_location_points")
const rowCount = Number(countRow?.count ?? 0)
const requiredCount = dataset.length

if (rowCount !== requiredCount) {
  await connection.beginTransaction()
  try {
    await connection.query("DELETE FROM forecast_location_points")

    const chunkSize = 300
    for (let offset = 0; offset < dataset.length; offset += chunkSize) {
      const chunk = dataset.slice(offset, offset + chunkSize)
      const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ")
      const params = chunk.flatMap((point) => [
        String(point.adminCode ?? ""),
        String(point.level1 ?? ""),
        String(point.level2 ?? ""),
        String(point.level3 ?? ""),
        Number(point.gridX),
        Number(point.gridY),
        Number(point.lon),
        Number(point.lat),
      ])

      await connection.query(
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

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  }
}

const [[afterRow]] = await connection.query("SELECT COUNT(*) AS count FROM forecast_location_points")
console.log(`forecast_location_points rows: ${Number(afterRow?.count ?? 0)} / expected ${requiredCount}`)

await connection.end()
