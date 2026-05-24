import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mysql from "mysql2/promise";

// ---------------------------------------------------------------------------
// Env loader (mirrors bootstrap-forecast-location-db.mjs)
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

// ---------------------------------------------------------------------------
// SSL
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
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: resolveSsl(),
});

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS daily_weather_history (
    date            DATE PRIMARY KEY,
    score           TINYINT UNSIGNED NOT NULL,
    status          VARCHAR(16) NOT NULL,
    knockout        VARCHAR(16) DEFAULT 'clear',
    air_score       TINYINT UNSIGNED DEFAULT 0,
    temp_score      TINYINT UNSIGNED DEFAULT 0,
    sky_score       TINYINT UNSIGNED DEFAULT 0,
    wind_score      TINYINT UNSIGNED DEFAULT 0,
    avg_temp        DECIMAL(4,1),
    min_temp        DECIMAL(4,1),
    max_temp        DECIMAL(4,1),
    avg_wind        DECIMAL(4,1),
    max_wind        DECIMAL(4,1),
    cloud_cover     DECIMAL(3,1),
    daily_rain      DECIMAL(5,1),
    sunshine_hours  DECIMAL(4,1),
    avg_humidity    DECIMAL(4,1),
    fog_hours       DECIMAL(4,1),
    avg_pm10        DECIMAL(5,1),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

console.log("Creating table daily_weather_history ...");
await connection.execute(CREATE_TABLE);
console.log("Table ready.");

// ---------------------------------------------------------------------------
// Scoring functions (identical to /api/weather/current logic)
// ---------------------------------------------------------------------------

/** PM10 → KHAI grade approximation (PM10-only fallback) */
function estimateKhairGrade(pm10) {
  if (pm10 <= 30) return 1;
  if (pm10 <= 80) return 2;
  if (pm10 <= 150) return 3;
  return 4;
}

function getAirScore(khaiGrade) {
  if (khaiGrade === 1) return 40;
  if (khaiGrade === 2) return 30;
  if (khaiGrade === 3) return 10;
  return 0;
}

function getTemperatureScore(temp) {
  if (temp >= 17 && temp <= 24) return 30;
  if ((temp >= 12 && temp <= 16) || (temp >= 25 && temp <= 28)) return 20;
  if ((temp >= 10 && temp <= 11) || (temp >= 29 && temp <= 31)) return 10;
  return 0;
}

/** 전운량(1/10) → sky code */
function cloudToSkyCode(cloud) {
  if (cloud <= 2) return 1; // 맑음
  if (cloud <= 7) return 3; // 구름많음
  return 4; // 흐림
}

function getSkyScore(skyCode) {
  if (skyCode === 1 || skyCode === 3) return 20;
  return 10;
}

function getWindScore(wind) {
  if (wind <= 3) return 10;
  if (wind <= 6) return 5;
  return 0;
}

function isRainDay(dailyRain) {
  return dailyRain > 0;
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------
function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseAsosDayRow(row) {
  return {
    date: row[1],
    avgTemp: safeNum(row[2]),
    minTemp: safeNum(row[3]),
    maxTemp: safeNum(row[5]),
    dailyRain: safeNum(row[12]) ?? 0,
    maxWind: safeNum(row[13]),
    avgWind: safeNum(row[19]),
    avgHumidity: safeNum(row[24]),
    sunshineHours: safeNum(row[33]),
    cloudCover: safeNum(row[42]),
    fogHours: safeNum(row[58]),
  };
}

// ---------------------------------------------------------------------------
// Load PM10 hourly → daily average
// ---------------------------------------------------------------------------
console.log("Loading PM10 data ...");
const pm10Daily = new Map(); // date → { sum, count }

const DATA_DIR = path.join(__dirname, "..", "..", "low data", "original");
const envFiles = fs
  .readdirSync(DATA_DIR)
  .filter((f) => f.startsWith("ENV_YDST_146_HR_"));

for (const file of envFiles) {
  const content = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
  const lines = content.trim().split("\n");
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const datetime = cols[1]?.trim();
    const pm10 = safeNum(cols[2]);
    if (!datetime || pm10 == null) continue;
    const date = datetime.slice(0, 10);
    const existing = pm10Daily.get(date) || { sum: 0, count: 0 };
    existing.sum += pm10;
    existing.count += 1;
    pm10Daily.set(date, existing);
  }
}

const pm10Avg = new Map();
for (const [date, v] of pm10Daily) {
  pm10Avg.set(date, Math.round((v.sum / v.count) * 10) / 10);
}
console.log(`  PM10 loaded for ${pm10Avg.size} days`);

// ---------------------------------------------------------------------------
// Load ASOS day files, compute scores, insert
// ---------------------------------------------------------------------------
const INSERT_SQL = `
  INSERT INTO daily_weather_history
    (date, score, status, knockout, air_score, temp_score, sky_score, wind_score,
     avg_temp, min_temp, max_temp, avg_wind, max_wind, cloud_cover,
     daily_rain, sunshine_hours, avg_humidity, fog_hours, avg_pm10)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON DUPLICATE KEY UPDATE
    score=VALUES(score), status=VALUES(status), knockout=VALUES(knockout),
    air_score=VALUES(air_score), temp_score=VALUES(temp_score),
    sky_score=VALUES(sky_score), wind_score=VALUES(wind_score),
    avg_temp=VALUES(avg_temp), min_temp=VALUES(min_temp), max_temp=VALUES(max_temp),
    avg_wind=VALUES(avg_wind), max_wind=VALUES(max_wind), cloud_cover=VALUES(cloud_cover),
    daily_rain=VALUES(daily_rain), sunshine_hours=VALUES(sunshine_hours),
    avg_humidity=VALUES(avg_humidity), fog_hours=VALUES(fog_hours), avg_pm10=VALUES(avg_pm10)
`;

const asosFiles = fs
  .readdirSync(DATA_DIR)
  .filter((f) => f.startsWith("SURFACE_ASOS_146_DAY_"));
let inserted = 0;

for (const file of asosFiles) {
  console.log(`Processing ${file} ...`);
  const content = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
  const lines = content.trim().split("\n");

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const row = parseAsosDayRow(cols);
    if (!row.date) continue;

    const avgPm10 = pm10Avg.get(row.date) ?? null;
    const khaiGrade = avgPm10 != null ? estimateKhairGrade(avgPm10) : 2; // default 보통
    const skyCode = row.cloudCover != null ? cloudToSkyCode(row.cloudCover) : 3;

    // Knockout check
    if (isRainDay(row.dailyRain)) {
      await connection.execute(INSERT_SQL, [
        row.date,
        10,
        "poor",
        "rain",
        0,
        0,
        0,
        0,
        row.avgTemp,
        row.minTemp,
        row.maxTemp,
        row.avgWind,
        row.maxWind,
        row.cloudCover,
        row.dailyRain,
        row.sunshineHours,
        row.avgHumidity,
        row.fogHours,
        avgPm10,
      ]);
    } else {
      const airScore = getAirScore(khaiGrade);
      const tempScore = getTemperatureScore(row.avgTemp ?? 0);
      const skyScore = getSkyScore(skyCode);
      const windScore = getWindScore(row.avgWind ?? 0);
      const total = Math.max(
        10,
        Math.min(100, airScore + tempScore + skyScore + windScore),
      );

      let status;
      if (total >= 86) status = "excellent";
      else if (total >= 66) status = "good";
      else if (total >= 36) status = "fair";
      else status = "poor";

      await connection.execute(INSERT_SQL, [
        row.date,
        total,
        status,
        "clear",
        airScore,
        tempScore,
        skyScore,
        windScore,
        row.avgTemp,
        row.minTemp,
        row.maxTemp,
        row.avgWind,
        row.maxWind,
        row.cloudCover,
        row.dailyRain,
        row.sunshineHours,
        row.avgHumidity,
        row.fogHours,
        avgPm10,
      ]);
    }
    inserted++;
    if (inserted % 200 === 0) console.log(`  ${inserted} rows inserted ...`);
  }
}

console.log(`Done! ${inserted} rows inserted/updated.`);
await connection.end();
