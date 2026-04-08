import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

const SCRYPT_KEY_LENGTH = 64
const SCRYPT_COST = 16384
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 1
const SCRYPT_MAX_MEMORY = 32 * 1024 * 1024
const DUMMY_PASSWORD_SALT = "0123456789abcdeffedcba9876543210"

export const PASSWORD_ALGORITHM = "scrypt-v1"

function getPepperedPassword(password: string) {
  return `${password}${process.env.AUTH_PEPPER ?? ""}`
}

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
