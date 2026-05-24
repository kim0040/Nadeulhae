import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mysql from "mysql2/promise";

// ---------------------------------------------------------------------------
// Env loader (mirrors build-score-history.mjs)
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

for (const key of ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]) {
  if (!process.env[key]) throw new Error(`Missing env: ${key}`);
}

console.log(`Connecting to ${process.env.DB_HOST}:${process.env.DB_PORT || 3306} / ${process.env.DB_NAME} ...`);

// ---------------------------------------------------------------------------
// SSL (mirrors build-score-history.mjs)
// ---------------------------------------------------------------------------
function resolveSsl() {
  const caPath = process.env.DB_CA_PATH;
  if (caPath && fs.existsSync(caPath)) {
    return { ca: fs.readFileSync(caPath, "utf8"), rejectUnauthorized: true };
  }
  for (const c of ["/etc/ssl/certs/ca-certificates.crt", "/etc/ssl/cert.pem"]) {
    if (fs.existsSync(c))
      return { ca: fs.readFileSync(c, "utf8"), rejectUnauthorized: true };
  }
  return { rejectUnauthorized: true, minVersion: "TLSv1.2" };
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: resolveSsl(),
});

console.log("Connected!\n");

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
const queries = [
  {
    label: "1. Row count & date range",
    sql: "SELECT COUNT(*) as total, MIN(date) as earliest, MAX(date) as latest FROM daily_weather_history",
  },
  {
    label: "2. Status distribution",
    sql: "SELECT status, COUNT(*) as cnt FROM daily_weather_history GROUP BY status ORDER BY cnt DESC",
  },
  {
    label: "3. Score statistics",
    sql: "SELECT AVG(score) as avg_score, MIN(score) as min_score, MAX(score) as max_score FROM daily_weather_history",
  },
];

for (const { label, sql } of queries) {
  console.log(`--- ${label} ---`);
  const [rows] = await connection.execute(sql);
  if (rows.length > 0) {
    console.table(rows);
  } else {
    console.log("  (empty)");
  }
  console.log();
}

await connection.end();
console.log("Done.");
