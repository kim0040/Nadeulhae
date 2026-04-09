import { randomBytes, randomUUID, scryptSync, createCipheriv, createHash, createHmac, hkdfSync } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import mysql from "mysql2/promise"

const ENCRYPTED_PREFIX = "enc:v1:"
const KEY_BYTES = 32
const IV_BYTES = 12
const SALT_BYTES = 16
const PASSWORD_ALGORITHM = "scrypt-v1"
const SCRYPT_KEY_LENGTH = 64
const SCRYPT_COST = 16384
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 1
const SCRYPT_MAX_MEMORY = 32 * 1024 * 1024

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

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing env var: ${name}`)
  }
  return value
}

function getProtectionSecret() {
  return process.env.DATA_PROTECTION_KEY || process.env.AUTH_PEPPER || "nadeulhae-dev-only-data-protection-key"
}

function getMasterKey() {
  return createHash("sha256")
    .update(getProtectionSecret())
    .digest()
}

function deriveContextKey(context, salt) {
  return Buffer.from(
    hkdfSync(
      "sha256",
      getMasterKey(),
      salt,
      Buffer.from(`nadeulhae:${context}:v1`, "utf8"),
      KEY_BYTES
    )
  )
}

function toBase64Url(buffer) {
  return buffer.toString("base64url")
}

function encryptDatabaseValue(plainText, context) {
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = deriveContextKey(context, salt)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${ENCRYPTED_PREFIX}${toBase64Url(salt)}:${toBase64Url(iv)}:${toBase64Url(authTag)}:${toBase64Url(encrypted)}`
}

function createBlindIndex(value, context) {
  const key = Buffer.from(
    hkdfSync(
      "sha256",
      getMasterKey(),
      Buffer.from("nadeulhae-blind-index", "utf8"),
      Buffer.from(`nadeulhae:blind:${context}:v1`, "utf8"),
      KEY_BYTES
    )
  )

  return createHmac("sha256", key)
    .update(value, "utf8")
    .digest("hex")
}

function hashPassword(password) {
  const peppered = `${password}${process.env.AUTH_PEPPER ?? ""}`
  const salt = randomBytes(16).toString("hex")
  const derived = scryptSync(peppered, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: SCRYPT_MAX_MEMORY,
  })

  return {
    hash: derived.toString("hex"),
    salt,
    algorithm: PASSWORD_ALGORITHM,
  }
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.execute(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_name = ?
      LIMIT 1
    `,
    [process.env.DB_NAME, tableName]
  )

  return Array.isArray(rows) && rows.length > 0
}

async function ensureUsersTableForSeed(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      email VARCHAR(700) NOT NULL,
      email_hash CHAR(64) NULL,
      display_name VARCHAR(255) NOT NULL,
      nickname VARCHAR(700) NOT NULL DEFAULT '',
      nickname_hash CHAR(64) NULL,
      nickname_tag CHAR(4) NOT NULL DEFAULT '0000',
      password_hash CHAR(128) NOT NULL,
      password_salt CHAR(32) NOT NULL,
      password_algo VARCHAR(24) NOT NULL DEFAULT 'scrypt-v1',
      age_band VARCHAR(700) NOT NULL,
      primary_region VARCHAR(700) NOT NULL,
      interest_tags LONGTEXT NOT NULL,
      interest_other VARCHAR(512) NULL,
      preferred_time_slot VARCHAR(700) NOT NULL,
      weather_sensitivity LONGTEXT NOT NULL,
      terms_agreed_at DATETIME NOT NULL,
      privacy_agreed_at DATETIME NOT NULL,
      age_confirmed_at DATETIME NOT NULL,
      marketing_accepted TINYINT(1) NOT NULL DEFAULT 0,
      marketing_agreed_at DATETIME NULL,
      analytics_accepted TINYINT(1) NOT NULL DEFAULT 0,
      analytics_agreed_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await connection.query(`
    ALTER TABLE users
      MODIFY COLUMN email VARCHAR(700) NOT NULL,
      ADD COLUMN IF NOT EXISTS email_hash CHAR(64) NULL AFTER email,
      MODIFY COLUMN display_name VARCHAR(255) NOT NULL,
      ADD COLUMN IF NOT EXISTS nickname VARCHAR(700) NOT NULL DEFAULT '' AFTER display_name,
      MODIFY COLUMN nickname VARCHAR(700) NOT NULL,
      ADD COLUMN IF NOT EXISTS nickname_hash CHAR(64) NULL AFTER nickname,
      ADD COLUMN IF NOT EXISTS nickname_tag CHAR(4) NOT NULL DEFAULT '0000' AFTER nickname_hash,
      MODIFY COLUMN age_band VARCHAR(700) NOT NULL,
      MODIFY COLUMN primary_region VARCHAR(700) NOT NULL,
      MODIFY COLUMN interest_tags LONGTEXT NOT NULL,
      MODIFY COLUMN interest_other VARCHAR(512) NULL,
      MODIFY COLUMN preferred_time_slot VARCHAR(700) NOT NULL,
      MODIFY COLUMN weather_sensitivity LONGTEXT NOT NULL,
      ADD COLUMN IF NOT EXISTS analytics_accepted TINYINT(1) NOT NULL DEFAULT 0 AFTER marketing_agreed_at,
      ADD COLUMN IF NOT EXISTS analytics_agreed_at DATETIME NULL AFTER analytics_accepted
  `)

  try {
    await connection.query(`
      ALTER TABLE users
        ADD UNIQUE KEY uq_users_email_hash (email_hash)
    `)
  } catch (error) {
    if (error?.code !== "ER_DUP_KEYNAME") {
      throw error
    }
  }

  try {
    await connection.query(`
      ALTER TABLE users
        ADD UNIQUE KEY uq_users_nickname_hash_tag (nickname_hash, nickname_tag)
    `)
  } catch (error) {
    if (error?.code !== "ER_DUP_KEYNAME") {
      throw error
    }
  }
}

async function deleteAllRowsIfExists(connection, tableName) {
  if (!(await tableExists(connection, tableName))) {
    console.log(`- skip (table missing): ${tableName}`)
    return
  }

  await connection.query(`DELETE FROM \`${tableName}\``)
  console.log(`- cleared: ${tableName}`)
}

async function main() {
  loadEnvFile()

  const ssl = process.env.DB_CA_PATH
    ? { ca: fs.readFileSync(process.env.DB_CA_PATH, "utf8"), rejectUnauthorized: true }
    : { rejectUnauthorized: true, minVersion: "TLSv1.2" }

  const connection = await mysql.createConnection({
    host: requireEnv("DB_HOST"),
    port: Number(process.env.DB_PORT ?? "4000"),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    database: requireEnv("DB_NAME"),
    ssl,
  })

  const testAccount = {
    id: randomUUID(),
    email: "test@nadeulhae.com",
    password: "testpassword",
    displayName: "테스터",
    nickname: "테스트봇",
    ageBand: "2x",
    primaryRegion: "Jeonju",
    interestTags: ["family", "nature"],
    preferredTimeSlot: "night",
    weatherSensitivity: [],
  }

  try {
    console.log("Resetting account/chat data...")
    await ensureUsersTableForSeed(connection)
    await connection.beginTransaction()

    // Chat domain
    await deleteAllRowsIfExists(connection, "user_chat_request_events")
    await deleteAllRowsIfExists(connection, "user_chat_usage_daily")
    await deleteAllRowsIfExists(connection, "user_chat_memory")
    await deleteAllRowsIfExists(connection, "user_chat_messages")
    await deleteAllRowsIfExists(connection, "user_chat_sessions")
    await deleteAllRowsIfExists(connection, "jeonju_chat_messages")

    // Auth domain
    await deleteAllRowsIfExists(connection, "user_sessions")
    await deleteAllRowsIfExists(connection, "auth_attempt_buckets")
    await deleteAllRowsIfExists(connection, "auth_security_events")
    await deleteAllRowsIfExists(connection, "users")

    const password = hashPassword(testAccount.password)
    const normalizedEmail = testAccount.email.trim().toLowerCase()
    const normalizedNickname = testAccount.nickname.trim().normalize("NFKC")
    const now = new Date()

    await connection.execute(
      `
        INSERT INTO users (
          id,
          email,
          email_hash,
          display_name,
          nickname,
          nickname_hash,
          nickname_tag,
          password_hash,
          password_salt,
          password_algo,
          age_band,
          primary_region,
          interest_tags,
          interest_other,
          preferred_time_slot,
          weather_sensitivity,
          terms_agreed_at,
          privacy_agreed_at,
          age_confirmed_at,
          marketing_accepted,
          marketing_agreed_at,
          analytics_accepted,
          analytics_agreed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        testAccount.id,
        encryptDatabaseValue(normalizedEmail, "users.email"),
        createBlindIndex(normalizedEmail, "users.email"),
        encryptDatabaseValue(testAccount.displayName, "users.display_name"),
        encryptDatabaseValue(normalizedNickname, "users.nickname"),
        createBlindIndex(normalizedNickname, "users.nickname"),
        "0000",
        password.hash,
        password.salt,
        password.algorithm,
        encryptDatabaseValue(testAccount.ageBand, "users.age_band"),
        encryptDatabaseValue(testAccount.primaryRegion, "users.primary_region"),
        encryptDatabaseValue(JSON.stringify(testAccount.interestTags), "users.interest_tags"),
        null,
        encryptDatabaseValue(testAccount.preferredTimeSlot, "users.preferred_time_slot"),
        encryptDatabaseValue(JSON.stringify(testAccount.weatherSensitivity), "users.weather_sensitivity"),
        now,
        now,
        now,
        0,
        null,
        0,
        null,
      ]
    )

    await connection.commit()

    console.log("Done.")
    console.log(`Test account email: ${testAccount.email}`)
    console.log(`Test account password: ${testAccount.password}`)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
