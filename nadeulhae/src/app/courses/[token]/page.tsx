import type { Metadata } from "next"

import { getSavedCourseByShareToken } from "@/lib/saved-courses/repository"
import { SharedCourseView } from "./shared-course-view"

export const runtime = "nodejs"

const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{8,32}$/

async function resolveCourse(token: string) {
  if (!SHARE_TOKEN_RE.test(token)) return null
  try {
    return await getSavedCourseByShareToken(token)
  } catch {
    return null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params
  const course = await resolveCourse(token)

  if (!course) {
    return { title: "공유된 코스 | 나들해", robots: { index: false, follow: false } }
  }

  const title = course.title || "나들해 추천 코스"
  const description = "나들AI가 만든 전주 나들이 코스를 확인해 보세요."
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary", title, description },
    // User content behind a random share token — shareable by link, not indexed.
    robots: { index: false, follow: false },
  }
}

export default async function SharedCoursePage(
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const course = await resolveCourse(token)
  return (
    <SharedCourseView
      course={course ? { title: course.title, slots: course.slots } : null}
    />
  )
}
