import { executeStatement } from "@/lib/db"
import { hashPassword } from "@/lib/auth/password"
import { ensureAuthSchema } from "@/lib/auth/schema"

async function main() {
  console.log("Ensuring schema...")
  await ensureAuthSchema()

  console.log("Resetting auth tables...")
  await executeStatement("DELETE FROM user_sessions")
  await executeStatement("DELETE FROM auth_attempt_buckets")
  await executeStatement("DELETE FROM users")
  
  console.log("Creating test account (test@nadeulhae.com / testpassword)...")
  
  const { hash, salt, algorithm } = await hashPassword("testpassword")
  
  const userId = crypto.randomUUID()
  
  const insertSql = `
    INSERT INTO users (
      id, email, display_name, nickname, nickname_tag,
      password_hash, password_salt, password_algo,
      age_band, primary_region, interest_tags, preferred_time_slot,
      weather_sensitivity, terms_agreed_at, privacy_agreed_at, age_confirmed_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, NOW(), NOW(), NOW()
    )
  `
  
  await executeStatement(insertSql, [
    userId,
    "test@nadeulhae.com",
    "테스터",
    "테스트봇",
    "0000",
    hash,
    salt,
    algorithm,
    "2x",
    "Jeonju",
    JSON.stringify(["family", "nature"]),
    "night",
    JSON.stringify([])
  ])
  
  console.log("All done.")
  process.exit(0)
}

main().catch(console.error)
