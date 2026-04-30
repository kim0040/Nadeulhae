import { ko } from "./ko"
import { en } from "./en"
import { zh } from "./zh"
import { ja } from "./ja"

export type Language = "ko" | "en" | "zh" | "ja"

export const translations: Record<Language, Record<string, string | string[]>> = {
  ko,
  en,
  zh,
  ja,
}
