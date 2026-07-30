/**
 * Password hashing and verification using scrypt with a server-side pepper.
 * Provides constant-time comparison to mitigate timing attacks.
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"

const SCRYPT_KEY_LENGTH = 64
const SCRYPT_COST = 16384
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 1
const SCRYPT_MAX_MEMORY = 32 * 1024 * 1024
// Dynamically generated dummy salt to prevent any potential precomputation attacks
const DUMMY_PASSWORD_SALT = randomBytes(16).toString("hex")

export const PASSWORD_ALGORITHM = "scrypt-v1"

// Warn once at startup if the pepper is missing in production. We deliberately
// do NOT throw (unlike DATA_PROTECTION_KEY) to stay backward-compatible with
// existing deploys, but a missing pepper silently drops the "a DB leak alone
// can't crack hashes" property, so it should be loud in the logs.
if (process.env.NODE_ENV === "production" && !process.env.AUTH_PEPPER) {
  console.warn(
    "[auth] AUTH_PEPPER is not set in production — password hashes lose the server-side pepper (defense-in-depth). Set AUTH_PEPPER to restore it."
  )
}

// Appends the server-side pepper to the password before hashing.
// The pepper is stored in an env variable and is not in the DB,
// so a DB leak alone is insufficient to crack passwords.
function getPepperedPassword(password: string) {
  return `${password}${process.env.AUTH_PEPPER ?? ""}`
}

function derivePasswordKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      getPepperedPassword(password),
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error)
          return
        }
        resolve(Buffer.from(derivedKey))
      }
    )
  })
}

// Pre-computed dummy hash for constant-time comparison on unknown accounts.
// Prevents user-enumeration via timing differences.
const DUMMY_PASSWORD_HASH = derivePasswordKey(
  "nadeulhae_dummy_password",
  DUMMY_PASSWORD_SALT
)

/** Generates a random salt and returns a scrypt-derived password hash. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const derivedKey = await derivePasswordKey(password, salt)

  return {
    hash: derivedKey.toString("hex"),
    salt,
    algorithm: PASSWORD_ALGORITHM,
  }
}

/** Verifies a password against a previously stored hash+salt using constant-time comparison. */
export async function verifyPassword(
  password: string,
  expectedHash: string,
  salt: string
) {
  const derivedKey = await derivePasswordKey(password, salt)

  const expectedBuffer = Buffer.from(expectedHash, "hex")
  return (
    expectedBuffer.length === derivedKey.length
    && timingSafeEqual(expectedBuffer, derivedKey)
  )
}

/**
 * Runs a dummy password verification when the account does not exist.
 * Returns a constant result so the caller spends similar CPU time as a real verification.
 */
export async function verifyPasswordAgainstDummy(password: string) {
  const attemptedDerived = await derivePasswordKey(password, DUMMY_PASSWORD_SALT)
  const dummyHash = await DUMMY_PASSWORD_HASH

  return timingSafeEqual(dummyHash, attemptedDerived)
}
