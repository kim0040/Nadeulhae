/**
 * Password hashing and verification using scrypt with a server-side pepper.
 * Provides constant-time comparison to mitigate timing attacks.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

const SCRYPT_KEY_LENGTH = 64
const SCRYPT_COST = 16384
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 1
const SCRYPT_MAX_MEMORY = 32 * 1024 * 1024
const DUMMY_PASSWORD_SALT = "0123456789abcdeffedcba9876543210"

export const PASSWORD_ALGORITHM = "scrypt-v1"

// Appends the server-side pepper to the password before hashing.
// The pepper is stored in an env variable and is not in the DB,
// so a DB leak alone is insufficient to crack passwords.
function getPepperedPassword(password: string) {
  return `${password}${process.env.AUTH_PEPPER ?? ""}`
}

// Pre-computed dummy hash for constant-time comparison on unknown accounts.
// Prevents user-enumeration via timing differences.
const DUMMY_PASSWORD_HASH = scryptSync(
  getPepperedPassword("nadeulhae_dummy_password"),
  DUMMY_PASSWORD_SALT,
  SCRYPT_KEY_LENGTH,
  {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: SCRYPT_MAX_MEMORY,
  }
)

/** Generates a random salt and returns a scrypt-derived password hash. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const derivedKey = scryptSync(getPepperedPassword(password), salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: SCRYPT_MAX_MEMORY,
  })

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
  const derivedKey = scryptSync(getPepperedPassword(password), salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: SCRYPT_MAX_MEMORY,
  })

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
  const attemptedDerived = scryptSync(
    getPepperedPassword(password),
    DUMMY_PASSWORD_SALT,
    SCRYPT_KEY_LENGTH,
    {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELIZATION,
      maxmem: SCRYPT_MAX_MEMORY,
    }
  )

  return timingSafeEqual(DUMMY_PASSWORD_HASH, attemptedDerived)
}
