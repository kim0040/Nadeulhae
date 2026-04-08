import {
  createDecipheriv,
  createHash,
  createHmac,
  createCipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto"

const ENCRYPTED_PREFIX = "enc:v1:"
const DEV_FALLBACK_SECRET = "nadeulhae-dev-only-data-protection-key"
const KEY_BYTES = 32
const IV_BYTES = 12
const SALT_BYTES = 16
const AUTH_TAG_BYTES = 16

let warnedAboutFallback = false

function getProtectionSecret() {
  const configured =
    process.env.DATA_PROTECTION_KEY
    || process.env.AUTH_PEPPER
    || ""

  if (configured) {
    return configured
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing DATA_PROTECTION_KEY (or AUTH_PEPPER) for database field protection.")
  }

  if (!warnedAboutFallback) {
    warnedAboutFallback = true
    console.warn("[security] Using development fallback key for DATA_PROTECTION_KEY.")
  }

  return DEV_FALLBACK_SECRET
}

function getMasterKey() {
  return createHash("sha256")
    .update(getProtectionSecret())
    .digest()
}

function deriveKey(context: string, salt: Buffer) {
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

function encodePart(value: Buffer) {
  return value.toString("base64url")
}

function decodePart(value: string) {
  return Buffer.from(value, "base64url")
}

export function isEncryptedDatabaseValue(value: string) {
  return value.startsWith(ENCRYPTED_PREFIX)
}

export function encryptDatabaseValue(plainText: string, context: string) {
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = deriveKey(context, salt)

  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return `${ENCRYPTED_PREFIX}${encodePart(salt)}:${encodePart(iv)}:${encodePart(authTag)}:${encodePart(encrypted)}`
}

export function decryptDatabaseValue(value: string, context: string) {
  if (!isEncryptedDatabaseValue(value)) {
    return value
  }

  const payload = value.slice(ENCRYPTED_PREFIX.length)
  const [saltPart, ivPart, tagPart, encryptedPart] = payload.split(":")

  if (!saltPart || !ivPart || !tagPart || !encryptedPart) {
    throw new Error("Malformed encrypted database value.")
  }

  const salt = decodePart(saltPart)
  const iv = decodePart(ivPart)
  const authTag = decodePart(tagPart)
  const encrypted = decodePart(encryptedPart)

  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error("Invalid encrypted database value dimensions.")
  }

  const key = deriveKey(context, salt)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)

  const plain = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  return plain.toString("utf8")
}

export function decryptDatabaseValueSafely(value: string | null | undefined, context: string) {
  if (value == null) {
    return null
  }

  return decryptDatabaseValue(value, context)
}

export function encryptDatabaseValueSafely(value: string | null | undefined, context: string) {
  if (!value) {
    return null
  }

  return encryptDatabaseValue(value, context)
}

export function createBlindIndex(value: string, context: string) {
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
