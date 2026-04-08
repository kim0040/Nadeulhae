import fs from "node:fs"
import path from "node:path"

import mysql from "mysql2/promise"

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local")
  const text = fs.readFileSync(envPath, "utf8")
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue
    const idx = line.indexOf("=")
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

async function runIgnoreDuplicateKey(conn, sql) {
  try {
    await conn.query(sql)
  } catch (error) {
    if (error?.code === "ER_DUP_KEYNAME" || error?.code === "ER_MULTIPLE_PRI_KEY") {
      return
    }
    throw error
  }
}

async function main() {
  loadEnv()

  const ssl = process.env.DB_CA_PATH
    ? { ca: fs.readFileSync(process.env.DB_CA_PATH, "utf8"), rejectUnauthorized: true }
    : { rejectUnauthorized: true, minVersion: "TLSv1.2" }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? "4000"),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl,
  })

  try {
    console.log("Patching auth runtime schema...")

    await conn.query(`
      ALTER TABLE user_sessions
        MODIFY COLUMN user_agent VARCHAR(700) NULL,
        MODIFY COLUMN ip_address VARCHAR(255) NULL
    `)

    await conn.query(`
      ALTER TABLE auth_security_events
        MODIFY COLUMN email VARCHAR(700) NULL,
        ADD COLUMN IF NOT EXISTS email_hash CHAR(64) NULL AFTER email,
        MODIFY COLUMN ip_address VARCHAR(255) NULL,
        MODIFY COLUMN user_agent VARCHAR(700) NULL
    `)

    await runIgnoreDuplicateKey(conn, `
      ALTER TABLE auth_security_events
        ADD KEY idx_auth_event_email_hash (email_hash)
    `)

    console.log("Done.")
  } finally {
    await conn.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
