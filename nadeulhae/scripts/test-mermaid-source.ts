import assert from "node:assert/strict"

import {
  getMermaidErrorDetails,
  isUnsupportedMermaidSource,
  normalizeMermaidSource,
} from "../src/lib/markdown/mermaid-source"

function run() {
  assert.equal(
    normalizeMermaidSource("\uFEFF```mermaid\r\nflowchart TD\r\n  A[시작] --> B[완료]\r\n```"),
    "flowchart TD\n  A[시작] --> B[완료]"
  )

  assert.equal(
    normalizeMermaidSource("mermaid\nsequenceDiagram\n  participant U as 사용자\n  U->>A: 요청"),
    "sequenceDiagram\n  participant U as 사용자\n  U->>A: 요청"
  )

  assert.equal(
    normalizeMermaidSource("flowchart TD\n  A[시\u200B작]\u00A0--> B[완료]"),
    "flowchart TD\n  A[시작] --> B[완료]"
  )

  assert.equal(
    normalizeMermaidSource("flowchart TD\n  B -->|실패| D[수정]D --> B"),
    "flowchart TD\n  B -->|실패| D[수정]\n  D --> B"
  )

  assert.equal(
    normalizeMermaidSource('flowchart TD\n  A["문자 ]D --> 유지"] --> B'),
    'flowchart TD\n  A["문자 ]D --> 유지"] --> B'
  )

  assert.equal(
    normalizeMermaidSource("sequenceDiagram\n  A->>B: D[수정]D --> B"),
    "sequenceDiagram\n  A->>B: D[수정]D --> B"
  )

  assert.equal(isUnsupportedMermaidSource("useCaseDiagram\n  actor User"), true)
  assert.equal(isUnsupportedMermaidSource("flowchart TD\n  User --> Login"), false)

  assert.deepEqual(
    getMermaidErrorDetails(new Error("Parse error on line 7:\nExpecting 'TEXT', got 'PS'")),
    {
      kind: "syntax",
      line: 7,
      token: "PS",
      rawMessage: "Parse error on line 7:\nExpecting 'TEXT', got 'PS'",
    }
  )

  assert.deepEqual(
    getMermaidErrorDetails({ str: "No diagram type detected matching given configuration" }),
    {
      kind: "unsupported",
      line: null,
      token: null,
      rawMessage: "No diagram type detected matching given configuration",
    }
  )

  console.log("Mermaid source normalization tests passed")
}

run()
