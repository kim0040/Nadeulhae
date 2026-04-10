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
const expectedCount = Array.isArray(dataset) ? dataset.length : 0

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

const [[countRow]] = await connection.query("SELECT COUNT(*) AS count FROM forecast_location_points")
const dbCount = Number(countRow?.count ?? 0)
console.log(`rows in DB: ${dbCount}, expected: ${expectedCount}`)

const samples = [
  { name: "전주", lat: 35.8242, lon: 127.148 },
  { name: "서울", lat: 37.5665, lon: 126.978 },
  { name: "부산", lat: 35.1796, lon: 129.0756 },
]

for (const sample of samples) {
  const [rows] = await connection.query(
    `
      SELECT
        admin_code,
        level1_name,
        level2_name,
        level3_name,
        grid_x,
        grid_y,
        lon,
        lat
      FROM forecast_location_points
      ORDER BY POW(lat - ?, 2) + POW(lon - ?, 2)
      LIMIT 1
    `,
    [sample.lat, sample.lon]
  )

  const row = rows[0]
  const label = [row?.level1_name, row?.level2_name, row?.level3_name].filter(Boolean).join(" ")
  console.log(
    `${sample.name} -> ${label} (${row?.admin_code ?? "-"}) grid=(${row?.grid_x ?? "-"},${row?.grid_y ?? "-"})`
  )
}

await connection.end()

if (dbCount !== expectedCount) {
  process.exitCode = 1
}
