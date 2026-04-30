import { NextRequest } from "next/server"

import { withApiAnalytics } from "@/lib/analytics/route"
import { createAuthJsonResponse } from "@/lib/auth/request-security"
import {
  attachRefreshedAuthCookie,
  clearAuthCookie,
  getAuthenticatedSessionFromRequest,
} from "@/lib/auth/session"
import { getLabState } from "@/lib/lab/repository"
import type { LabLocale } from "@/lib/lab/types"

export const runtime = "nodejs"

function getLocale(request: NextRequest): LabLocale {
  const header = request.headers.get("accept-language")?.toLowerCase() ?? ""
  if (header.startsWith("zh")) return "zh"
  if (header.startsWith("ja")) return "ja"
  return header.startsWith("en") ? "en" : "ko"
}

const LAB_STATE_ERRORS = {
  ko: {
    unauthorized: "로그인이 필요합니다.",
    disabled: "실험실 기능이 비활성화되어 있습니다. 대시보드 설정에서 먼저 활성화해 주세요.",
    failed: "실험실 상태를 불러오지 못했습니다.",
  },
  en: {
    unauthorized: "You need to log in first.",
    disabled: "Lab is disabled. Enable it first from dashboard settings.",
    failed: "Failed to load lab state.",
  },
  zh: {
    unauthorized: "请先登录。",
    disabled: "实验室功能未开启。请先在仪表盘设置中启用。",
    failed: "无法加载实验室状态。",
  },
  ja: {
    unauthorized: "ログインが必要です。",
    disabled: "ラボ機能が無効です。ダッシュボード設定から先に有効にしてください。",
    failed: "ラボの状態を読み込めませんでした。",
  },
} as const

async function handleGET(request: NextRequest) {
  const locale = getLocale(request)

  try {
    const authenticatedSession = await getAuthenticatedSessionFromRequest(request)
    if (!authenticatedSession) {
      return clearAuthCookie(
        createAuthJsonResponse(
          { error: LAB_STATE_ERRORS[locale].unauthorized },
          { status: 401 }
        )
      )
    }

    if (!authenticatedSession.user.labEnabled) {
      return attachRefreshedAuthCookie(
        createAuthJsonResponse(
          { error: LAB_STATE_ERRORS[locale].disabled },
          { status: 403 }
        ),
        authenticatedSession
      )
    }

    const state = await getLabState(authenticatedSession.user.id)

    return attachRefreshedAuthCookie(
      createAuthJsonResponse({ state }),
      authenticatedSession
    )
  } catch (error) {
    console.error("Lab state API failed:", error)
    return createAuthJsonResponse(
      { error: LAB_STATE_ERRORS[locale].failed },
      { status: 500 }
    )
  }
}

export const GET = withApiAnalytics(handleGET)
