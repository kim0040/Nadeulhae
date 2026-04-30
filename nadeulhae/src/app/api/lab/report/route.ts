import { NextRequest } from "next/server"

import { withApiAnalytics } from "@/lib/analytics/route"
import { createAuthJsonResponse } from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import type { LabLocale } from "@/lib/lab/types"
import { getLabReportSnapshot } from "@/lib/lab/repository"

export const runtime = "nodejs"

const LAB_REPORT_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    disabled: "실험실 기능이 비활성화되어 있습니다. 대시보드 설정에서 먼저 활성화해 주세요.",
    invalidPeriod: "보고 기간 값이 올바르지 않습니다.",
    failed: "학습 보고서를 불러오지 못했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    disabled: "Lab is disabled. Enable it first from dashboard settings.",
    invalidPeriod: "Invalid report period value.",
    failed: "Failed to load lab report.",
  },
  zh: {
    unauthorized: "请先登录。",
    disabled: "实验室功能未开启。请先在仪表盘设置中启用。",
    invalidPeriod: "报告期间值无效。",
    failed: "无法加载学习报告。",
  },
  ja: {
    unauthorized: "ログインが必要です。",
    disabled: "ラボ機能が無効です。ダッシュボード設定から先に有効にしてください。",
    invalidPeriod: "レポート期間の値が正しくありません。",
    failed: "学習レポートの読み込みに失敗しました。",
  },
} as const

function getLocale(request: NextRequest): LabLocale {
  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
  if (header.startsWith("zh")) return "zh"
  if (header.startsWith("ja")) return "ja"
  return header.startsWith("en") ? "en" : "ko"
}

function parsePeriodDays(value: string | null) {
  if (!value) {
    return 14
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  const integer = Math.floor(parsed)
  if (integer < 7 || integer > 60) {
    return null
  }

  return integer
}

async function handleGET(request: NextRequest) {
  const locale = getLocale(request)

  try {
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: LAB_REPORT_ERRORS[locale].unauthorized },
          { status: 401 }
        )
      )
    }

    if (!authenticatedSession.user.labEnabled) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_REPORT_ERRORS[locale].disabled },
          { status: 403 }
        ),
        authenticatedSession
      )
    }

    const periodDays = parsePeriodDays(request.nextUrl.searchParams.get("days"))
    if (periodDays == null) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_REPORT_ERRORS[locale].invalidPeriod },
          { status: 400 }
        ),
        authenticatedSession
      )
    }

    const report = await getLabReportSnapshot({
      userId: authenticatedSession.user.id,
      periodDays,
    })

    return attachRefreshedAuthCookie(
      createAuthJsonResponse({ report }),
      authenticatedSession
    )
  } catch (error) {
    console.error("Lab report API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_REPORT_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

export const GET = withApiAnalytics(handleGET)
