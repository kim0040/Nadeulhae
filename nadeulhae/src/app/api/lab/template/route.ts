import { NextRequest, NextResponse } from "next/server"

import { withApiAnalytics } from "@/lib/analytics/route"
import { createAuthJsonResponse } from "@/lib/auth/request-security"
import {
  buildLabTemplateCsv,
  buildLabTemplateJson,
} from "@/lib/lab/transfer"

export const runtime = "nodejs"

function parseFormat(value: string | null) {
  if (value === "json") {
    return "json" as const
  }

  if (!value || value === "csv") {
    return "csv" as const
  }

  return null
}

async function handleGET(request: NextRequest) {
  const format = parseFormat(request.nextUrl.searchParams.get("format"))
  if (!format) {
    return createAuthJsonResponse(
      { error: "Invalid template format. Use csv or json." },
      { status: 400 }
    )
  }

  if (format === "json") {
    return new NextResponse(buildLabTemplateJson(), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"lab-import-template.json\"",
        "Cache-Control": "public, max-age=300",
      },
    })
  }

  return new NextResponse(buildLabTemplateCsv(), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"lab-import-template.csv\"",
      "Cache-Control": "public, max-age=300",
    },
  })
}

export const GET = withApiAnalytics(handleGET)
