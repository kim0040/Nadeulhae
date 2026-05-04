/**
 * Data-at-Rest Protection Utilities
 *
 * Provides AES-256-GCM encryption, decryption, and blind-indexing (HMAC)
 * for sensitive database fields. Uses HKDF key derivation so each
 * encryption context produces an independent sub-key. Values are stored
 * in an "enc:v1:<salt>:<iv>:<authTag>:<ciphertext>" format.
 */
import {
  createDecipheriv,
  createHash,
  createHmac,
  createCipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto"

const ENCRYPTED_PREFIX = "enc:v1:"
const KEY_BYTES = 32
const IV_BYTES = 12
const SALT_BYTES = 16
const AUTH_TAG_BYTES = 16

let devFallbackSecret: string | null = null

/**
 * Returns the DATA_PROTECTION_KEY from the environment, or generates a
 * random dev-only fallback. In production, a missing key throws an error.
 */
function getProtectionSecret() {
  const configured =
    process.env.DATA_PROTECTION_KEY
    || ""

  if (configured) {
    return configured
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing DATA_PROTECTION_KEY for database field protection. Set DATA_PROTECTION_KEY in production.")
  }

  // Development only: generate a random key for this session.
  // Encrypted data will NOT survive a server restart.
  if (!devFallbackSecret) {
    devFallbackSecret = randomBytes(32).toString("hex")
    console.warn(
      "[security] DATA_PROTECTION_KEY is not set. " +
      "A random key was generated for this session. " +
      "Encrypted data will NOT be readable after a server restart. " +
      "Set DATA_PROTECTION_KEY for consistent encryption."
    )
  }

  return devFallbackSecret
}

/** Derives a 256-bit master key from the protection secret via SHA-256. */
function getMasterKey() {
  return createHash("sha256")
    .update(getProtectionSecret())
    .digest()
}

/**
 * Derives a context-specific sub-key via HKDF-SHA256. Each encryption
 * context (e.g. "email", "phone") produces an independent key so that
 * compromising one context does not expose data from another.
 */
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

/** Base64url-encodes a Buffer into a URL-safe, padding-free string. */
function encodePart(value: Buffer) {
  return value.toString("base64url")
}

/** Decodes a base64url string back into a Buffer. */
function decodePart(value: string) {
  return Buffer.from(value, "base64url")
}

/** Checks whether a database value has been encrypted by this module. Encrypted values always start with the "enc:v1:" prefix. */
export function isEncryptedDatabaseValue(value: string) {
  return value.startsWith(ENCRYPTED_PREFIX)
}

/**
 * Encrypts a plaintext using AES-256-GCM with a context-specific key.
 * Produces: enc:v1:<salt>:<iv>:<authTag>:<ciphertext>.
 * Each call uses a fresh random salt and IV for IND-CCA2 security.
 */
export function encryptDatabaseValue(plainText: string, context: string) {
  // Fresh salt and IV per encryption — required for IND-CCA2 nonce reuse resistance
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = deriveKey(context, salt)

  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ])
  // GCM appends the authentication tag after final(); retrieve it for integrity verification
  const authTag = cipher.getAuthTag()

  return `${ENCRYPTED_PREFIX}${encodePart(salt)}:${encodePart(iv)}:${encodePart(authTag)}:${encodePart(encrypted)}`
}

/**
 * Decrypts a value previously encrypted by encryptDatabaseValue. Validates
 * the format prefix and component dimensions before decryption. Returns
 * the plaintext as-is if the value is not encrypted (no prefix).
 */
export function decryptDatabaseValue(value: string, context: string) {
  if (!isEncryptedDatabaseValue(value)) {
    return value
  }

  // Strip the "enc:v1:" prefix and split the four colon-delimited components
  const payload = value.slice(ENCRYPTED_PREFIX.length)
  const [saltPart, ivPart, tagPart, encryptedPart] = payload.split(":")

  if (!saltPart || !ivPart || !tagPart || !encryptedPart) {
    throw new Error("Malformed encrypted database value.")
  }

  const salt = decodePart(saltPart)
  const iv = decodePart(ivPart)
  const authTag = decodePart(tagPart)
  const encrypted = decodePart(encryptedPart)

  // Verify component dimensions — guards against truncated or corrupted values
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

/** Null-safe wrapper around decryptDatabaseValue. Returns null for null/undefined inputs. */
export function decryptDatabaseValueSafely(value: string | null | undefined, context: string) {
  if (value == null) {
    return null
  }

  return decryptDatabaseValue(value, context)
}

/** Null-safe wrapper around encryptDatabaseValue. Returns null for null/undefined/empty inputs. */
export function encryptDatabaseValueSafely(value: string | null | undefined, context: string) {
  if (!value) {
    return null
  }

  return encryptDatabaseValue(value, context)
}

/**
 * Creates a deterministic, context-scoped HMAC-SHA256 hash of a value.
 * Used for blind indexing — allows equality lookups on encrypted fields
 * without exposing the plaintext. Same input always produces the same
 * output within the same context.
 */
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
