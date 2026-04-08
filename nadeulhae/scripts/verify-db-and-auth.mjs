/**
 * 원격 DB 연결 + 비밀번호 해싱/검증 확인 스크립트
 */
import { createPool } from 'mysql2/promise'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envContent = readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIndex = trimmed.indexOf('=')
  if (eqIndex < 0) continue
  const key = trimmed.slice(0, eqIndex)
  const value = trimmed.slice(eqIndex + 1)
  if (!process.env[key]) process.env[key] = value
}

const SCRYPT_KEY_LENGTH = 64
const SCRYPT_COST = 16384
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 1
const SCRYPT_MAX_MEMORY = 32 * 1024 * 1024

function getPepper() {
  return process.env.AUTH_PEPPER ?? ''
}

function hashPassword(password) {
  const peppered = `${password}${getPepper()}`
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(peppered, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: SCRYPT_MAX_MEMORY,
  })
  return { hash: derivedKey.toString('hex'), salt }
}

function verifyPassword(password, expectedHash, salt) {
  const peppered = `${password}${getPepper()}`
  const derivedKey = scryptSync(peppered, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: SCRYPT_MAX_MEMORY,
  })
  const expectedBuffer = Buffer.from(expectedHash, 'hex')
  return expectedBuffer.length === derivedKey.length && timingSafeEqual(expectedBuffer, derivedKey)
}

async function main() {
  console.log('\n=== 나들해 DB & Auth 검증 ===\n')

  // 1. 환경변수 확인
  console.log('📋 환경변수 확인:')
  const requiredVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'AUTH_PEPPER']
  for (const v of requiredVars) {
    const val = process.env[v]
    if (!val) {
      console.log(`  ❌ ${v}: 미설정`)
    } else {
      const display = v.includes('PASSWORD') || v.includes('PEPPER')
        ? `${val.slice(0, 4)}***`
        : val
      console.log(`  ✅ ${v}: ${display}`)
    }
  }

  // 2. DB 연결 테스트
  console.log('\n🔗 원격 DB 연결 테스트:')
  let pool
  try {
    const sslOpts = process.env.DB_CA_PATH
      ? { ca: readFileSync(process.env.DB_CA_PATH, 'utf8'), rejectUnauthorized: true }
      : { rejectUnauthorized: true, minVersion: 'TLSv1.2' }

    pool = createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? '4000'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: sslOpts,
      connectionLimit: 2,
    })

    const [rows] = await pool.query('SELECT 1 AS ok')
    console.log(`  ✅ 연결 성공 (result: ${JSON.stringify(rows[0])})`)
    
    const [versionRows] = await pool.query('SELECT VERSION() AS version')
    console.log(`  ✅ DB 버전: ${versionRows[0].version}`)

    // 테이블 확인
    const [tables] = await pool.query('SHOW TABLES')
    const tableNames = tables.map(r => Object.values(r)[0])
    console.log(`  ✅ 테이블 목록: ${tableNames.length ? tableNames.join(', ') : '(없음)'}`)

    // users 테이블 구조 확인
    if (tableNames.includes('users')) {
      const [cols] = await pool.query('DESCRIBE users')
      console.log(`  ✅ users 테이블 컬럼: ${cols.map(c => c.Field).join(', ')}`)
      
      const [userCount] = await pool.query('SELECT COUNT(*) AS cnt FROM users')
      console.log(`  ✅ 등록된 사용자 수: ${userCount[0].cnt}`)

      // 샘플 사용자 해시 검증
      const [sampleUsers] = await pool.query(
        'SELECT id, email, password_hash, password_salt, password_algo FROM users LIMIT 1'
      )
      if (sampleUsers.length > 0) {
        const u = sampleUsers[0]
        console.log(`\n🔐 샘플 사용자 해시 정보:`)
        console.log(`  이메일: ${u.email}`)
        console.log(`  알고리즘: ${u.password_algo}`)
        console.log(`  salt 길이: ${u.password_salt.length} chars (${u.password_salt.length / 2} bytes hex)`)
        console.log(`  hash 길이: ${u.password_hash.length} chars (${u.password_hash.length / 2} bytes hex)`)
        console.log(`  ✅ salt가 32자(16바이트 hex): ${u.password_salt.length === 32 ? '정상' : '⚠️ 비정상'}`)
        console.log(`  ✅ hash가 128자(64바이트 hex): ${u.password_hash.length === 128 ? '정상' : '⚠️ 비정상'}`)
      }
    }

    // 세션 테이블
    if (tableNames.includes('user_sessions')) {
      const [sessionCount] = await pool.query('SELECT COUNT(*) AS cnt FROM user_sessions')
      console.log(`  ✅ 활성 세션 수: ${sessionCount[0].cnt}`)
    }

  } catch (err) {
    console.log(`  ❌ DB 연결 실패: ${err.message}`)
  }

  // 3. 비밀번호 해싱 검증
  console.log('\n🔑 비밀번호 해싱 독립 검증:')
  const testPassword = 'TestPassword123!'
  console.log(`  테스트 비밀번호: ${testPassword}`)
  console.log(`  Pepper 적용: ${getPepper() ? '✅ 설정됨' : '⚠️ 미설정'}`)

  const { hash, salt } = hashPassword(testPassword)
  console.log(`  생성된 salt: ${salt} (${salt.length}자 = ${salt.length / 2}바이트)`)
  console.log(`  생성된 hash: ${hash.slice(0, 20)}... (${hash.length}자 = ${hash.length / 2}바이트)`)

  const verified = verifyPassword(testPassword, hash, salt)
  console.log(`  ✅ 같은 비밀번호 검증: ${verified ? '통과' : '실패'}`)

  const wrongVerified = verifyPassword('WrongPassword999!', hash, salt)
  console.log(`  ✅ 틀린 비밀번호 검증: ${!wrongVerified ? '통과 (올바르게 거부)' : '⚠️ 실패 (잘못 통과)'}`)

  // 다른 salt로 같은 비밀번호
  const { hash: hash2, salt: salt2 } = hashPassword(testPassword)
  console.log(`  ✅ 매번 다른 salt 생성: ${salt !== salt2 ? '통과' : '⚠️ 실패'}`)
  console.log(`  ✅ 같은 비밀번호도 다른 hash: ${hash !== hash2 ? '통과' : '⚠️ 실패'}`)

  // Timing safe comparison
  console.log(`  ✅ timingSafeEqual 사용: 타이밍 공격 방지 적용됨`)

  console.log('\n=== 검증 완료 ===\n')

  if (pool) await pool.end()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
