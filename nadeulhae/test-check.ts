import { executeStatement } from "@/lib/db"
async function main() {
  const users = await executeStatement("SELECT email, nickname FROM users")
  console.log("Users:", users)
  process.exit(0)
}
main().catch(console.error)
