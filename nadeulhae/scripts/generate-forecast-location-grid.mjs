#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

const DEFAULT_INPUT = resolve(process.cwd(), "..", "동네예보지점좌표(위경도)_202510.xlsx")
const DEFAULT_OUTPUT = resolve(process.cwd(), "src", "data", "forecast-location-grid.json")

const inputPath = resolve(process.cwd(), process.argv[2] ?? DEFAULT_INPUT)
const outputPath = resolve(process.cwd(), process.argv[3] ?? DEFAULT_OUTPUT)

function unzipXml(xlsxPath, entryPath) {
  return execFileSync("unzip", ["-p", xlsxPath, entryPath], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 250,
  })
}

function decodeXmlText(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
}

function parseSharedStrings(xml) {
  const result = []
  const siPattern = /<si>([\s\S]*?)<\/si>/g
  const textPattern = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g

  for (const siMatch of xml.matchAll(siPattern)) {
    const siBody = siMatch[1]
    let text = ""
    for (const textMatch of siBody.matchAll(textPattern)) {
      text += textMatch[1]
    }
    result.push(decodeXmlText(text))
  }

  return result
}

function parseCellMap(rowXml, sharedStrings) {
  const cells = {}
  const cellPattern = /<c[^>]*r="([A-Z]+)([0-9]+)"([^>]*)>([\s\S]*?)<\/c>/g
  const valuePattern = /<v>([^<]*)<\/v>/

  for (const cellMatch of rowXml.matchAll(cellPattern)) {
    const column = cellMatch[1]
    const attrs = cellMatch[3]
    const cellBody = cellMatch[4]
    const raw = cellBody.match(valuePattern)?.[1]
    if (raw == null) continue

    const isSharedString = /t="s"/.test(attrs)
    cells[column] = isSharedString ? sharedStrings[Number(raw)] ?? "" : raw
  }

  return cells
}

function toNumber(value) {
  if (value == null || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toStringValue(value) {
  if (value == null) return ""
  return String(value).trim()
}

function buildLocationRecord(cells) {
  const adminCode = toStringValue(cells.B)
  const level1 = toStringValue(cells.C)
  const level2 = toStringValue(cells.D)
  const level3 = toStringValue(cells.E)
  const gridX = toNumber(cells.F)
  const gridY = toNumber(cells.G)
  const lon = toNumber(cells.N)
  const lat = toNumber(cells.O)

  if (!adminCode || lat == null || lon == null || gridX == null || gridY == null) {
    return null
  }

  return {
    adminCode,
    level1,
    level2,
    level3,
    gridX,
    gridY,
    lon,
    lat,
  }
}

function main() {
  const sharedStringsXml = unzipXml(inputPath, "xl/sharedStrings.xml")
  const sheetXml = unzipXml(inputPath, "xl/worksheets/sheet1.xml")
  const sharedStrings = parseSharedStrings(sharedStringsXml)

  const rowPattern = /<row[^>]*r="([0-9]+)"[\s\S]*?<\/row>/g
  const dedupMap = new Map()

  for (const rowMatch of sheetXml.matchAll(rowPattern)) {
    const rowNumber = Number(rowMatch[1])
    if (!Number.isFinite(rowNumber) || rowNumber <= 1) continue

    const rowXml = rowMatch[0]
    const cells = parseCellMap(rowXml, sharedStrings)
    const record = buildLocationRecord(cells)
    if (!record) continue

    // Keep the latest row when duplicated admin code appears in source data.
    dedupMap.set(record.adminCode, record)
  }

  const records = Array.from(dedupMap.values())
  records.sort((a, b) => a.adminCode.localeCompare(b.adminCode))

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(records)}\n`, "utf8")

  console.log(`Generated ${records.length} forecast location records`)
  console.log(`Input: ${inputPath}`)
  console.log(`Output: ${outputPath}`)
}

main()
