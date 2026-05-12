import fs from "node:fs"
import path from "node:path"

import nextEnv from "@next/env"
import mysql from "mysql2/promise"

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

function requireEnv(name) {
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
        ca: fs.readFileSync(caPath, "utf8"),
        rejectUnauthorized: true,
      }
    } catch {
      // fall through
    }
  }

  const fallbackPaths = [
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/ssl/cert.pem",
    "/usr/local/share/ca-certificates/",
    "/etc/ssl/certs/",
  ]

  for (const candidate of fallbackPaths) {
    try {
      const stat = fs.statSync(candidate)
      if (stat.isFile()) {
        return {
          ca: fs.readFileSync(candidate, "utf8"),
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

function getYesterdayInKst() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date())
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "00"
  const hour = Number(get("hour"))
  const offset = hour < 7 ? 2 : 1
  const d = new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00+09:00`)
  d.setDate(d.getDate() - offset)
  return d.toISOString().slice(0, 10)
}

async function main() {
  const connection = await mysql.createConnection({
    host: requireEnv("DB_HOST"),
    port: Number(process.env.DB_PORT ?? "4000"),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    database: requireEnv("DB_NAME"),
    ssl: resolveSslOptions(),
    timezone: "+00:00",
  })

  try {
    const targetDate = getYesterdayInKst()
    const [result] = await connection.execute(
      "DELETE FROM jeonju_daily_briefings WHERE briefing_date = ?",
      [targetDate]
    )

    const deleted = Number(result?.affectedRows ?? 0)
    console.log(JSON.stringify({
      ok: true,
      targetDate,
      deleted,
      cwd: path.resolve("."),
    }))
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error("[reset-jeonju-briefing-cache] failed:", error)
  process.exit(1)
})
