import fs from "node:fs"
import path from "node:path"

import mysql from "mysql2/promise"

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) return

  const content = fs.readFileSync(envPath, "utf8")
  for (const line of content.split(/\r?\n/)) {
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

async function main() {
  loadEnvFile()

  const ssl = process.env.DB_CA_PATH
    ? { ca: fs.readFileSync(process.env.DB_CA_PATH, "utf8"), rejectUnauthorized: true }
    : { rejectUnauthorized: true, minVersion: "TLSv1.2" }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? "4000"),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl,
  })

  const tables = [
    "users",
    "user_chat_messages",
    "jeonju_chat_messages",
    "user_sessions",
    "user_chat_sessions",
    "user_chat_memory",
  ]

  for (const table of tables) {
    try {
      const [rows] = await connection.query(`SELECT COUNT(*) AS cnt FROM \`${table}\``)
      console.log(`${table}: ${rows[0].cnt}`)
    } catch {
      console.log(`${table}: (missing)`)
    }
  }

  const [rows] = await connection.query("SELECT id, email, nickname, nickname_tag FROM users LIMIT 1")
  console.log("sampleUser:", rows[0] ?? null)

  await connection.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
