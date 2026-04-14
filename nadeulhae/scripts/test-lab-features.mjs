import fs from "node:fs"
import path from "node:path"
import process from "node:process"

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const raw = fs.readFileSync(filePath, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex <= 0) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    let value = trimmed.slice(separatorIndex + 1).trim()

    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function runTransferParserTests(parseLabImportPayload, buildLabExportCsv) {
  const jsonFenced = parseLabImportPayload({
    format: "json",
    source: "```json\n{\"cards\":[{\"term\":\"breeze\",\"meaning\":\"산들바람\",}],}\n```",
  })
  assert(jsonFenced.parseSucceeded, "JSON codeblock parse should succeed")
  assert(jsonFenced.cards.length === 1, "JSON codeblock should parse 1 card")

  const csvSemicolon = parseLabImportPayload({
    format: "csv",
    source: "term;meaning;example;tip\numbrella;우산;챙겨가자;rain",
  })
  assert(csvSemicolon.cards.length === 1, "Semicolon CSV should parse 1 card")

  const csvTab = parseLabImportPayload({
    format: "csv",
    source: "term\tmeaning\texample\ttip\ntrail\t산책로\tThe trail is clear.\toutdoor",
  })
  assert(csvTab.cards.length === 1, "TSV should parse 1 card")

  const csvLoose = parseLabImportPayload({
    format: "csv",
    source: "breeze - 산들바람\nrainy | 비 오는",
  })
  assert(csvLoose.cards.length === 2, "Loose single-column rows should parse term/meaning")

  const exportedCsv = buildLabExportCsv({
    deckTitle: "Test Deck",
    deckTopic: "Roundtrip",
    cards: [
      {
        id: "1",
        deckId: "1",
        term: "mist",
        meaning: "안개",
        example: "Morning mist covered the park.",
        tip: "weather",
        learningState: "new",
        stage: 0,
        stabilityDays: 0.2,
        difficulty: 5,
        retrievability: null,
        totalReviews: 0,
        lapses: 0,
        nextReviewAt: new Date().toISOString(),
        lastReviewedAt: null,
        createdAt: new Date().toISOString(),
      },
    ],
  })
  const roundTrip = parseLabImportPayload({
    format: "csv",
    source: exportedCsv,
  })
  assert(roundTrip.cards.length === 1, "Exported CSV should roundtrip into 1 card")

  return {
    jsonFenced: jsonFenced.cards.length,
    csvSemicolon: csvSemicolon.cards.length,
    csvTab: csvTab.cards.length,
    csvLoose: csvLoose.cards.length,
    roundTrip: roundTrip.cards.length,
  }
}

function runSrsLogicSmokeTest(constantsModule) {
  const {
    LAB_REVIEW_GRADE_AGAIN,
    LAB_REVIEW_GRADE_GOOD,
    LAB_LEARNING_STEPS_MINUTES,
    LAB_RELEARNING_STEPS_MINUTES,
  } = constantsModule

  function computeLearningState(state, grade, consecutiveCorrect) {
    if (grade === LAB_REVIEW_GRADE_AGAIN) {
      return {
        state: state === "new" ? "learning" : state,
        consecutiveCorrect: 0,
        nextStepMinutes: LAB_LEARNING_STEPS_MINUTES[0],
      }
    }

    const nextConsecutive = consecutiveCorrect + 1
    if (nextConsecutive >= 2) {
      return {
        state: "review",
        consecutiveCorrect: 0,
        nextStepMinutes: 24 * 60,
      }
    }

    return {
      state: state === "new" ? "learning" : state,
      consecutiveCorrect: nextConsecutive,
      nextStepMinutes: LAB_LEARNING_STEPS_MINUTES[Math.min(nextConsecutive - 1, LAB_LEARNING_STEPS_MINUTES.length - 1)],
    }
  }

  function computeReviewState(grade) {
    if (grade === LAB_REVIEW_GRADE_AGAIN) {
      return {
        state: "relearning",
        nextStepMinutes: LAB_RELEARNING_STEPS_MINUTES[0],
      }
    }

    return {
      state: "review",
      nextStepMinutes: 24 * 60,
    }
  }

  const first = computeLearningState("new", LAB_REVIEW_GRADE_GOOD, 0)
  assert(first.state === "learning", "First good answer should move new card to learning")
  assert(first.consecutiveCorrect === 1, "First good answer should increase consecutive count")

  const second = computeLearningState(first.state, LAB_REVIEW_GRADE_GOOD, first.consecutiveCorrect)
  assert(second.state === "review", "Second consecutive good answer should graduate card to review")

  const third = computeReviewState(LAB_REVIEW_GRADE_AGAIN)
  assert(third.state === "relearning", "Again in review state should move card to relearning")

  return {
    firstState: first.state,
    secondState: second.state,
    thirdState: third.state,
    firstStepMinutes: first.nextStepMinutes,
    thirdStepMinutes: third.nextStepMinutes,
  }
}

async function main() {
  const projectRoot = process.cwd()
  loadEnvFile(path.join(projectRoot, ".env.local"))

  const transferModule = await import("../src/lib/lab/transfer.ts")
  const constantsModule = await import("../src/lib/lab/constants.ts")

  const transferSummary = await runTransferParserTests(
    transferModule.parseLabImportPayload,
    transferModule.buildLabExportCsv
  )
  const srsSummary = runSrsLogicSmokeTest(constantsModule)

  console.log("Lab feature self-test passed.")
  console.log("Transfer:", transferSummary)
  console.log("SRS:", srsSummary)
}

main().catch((error) => {
  console.error("Lab feature self-test failed:", error)
  process.exitCode = 1
})
