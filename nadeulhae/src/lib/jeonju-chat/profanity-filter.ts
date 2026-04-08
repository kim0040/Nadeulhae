/**
 * 한국어 비속어 필터 (기본 목록 + 패턴 매칭)
 * 비속어 목록은 최소한으로 유지하되, 일반적으로 알려진 것들을 커버합니다.
 */

const PROFANITY_PATTERNS: RegExp[] = [
  // 한국어 비속어 패턴
  /[시씨쒸쓔슈쉬쉽시][이ㅣ][바빠팔발벌불블][ㄹ라]?/gi,
  /[ㅅㅆ][ㅂㅃ]/g,
  /씨[발빨팔밸]/gi,
  /지[랄럴]/gi,
  /개[새세걸]끼/gi,
  /[병벼][신싄씬]/gi,
  /머저리/gi,
  /또라이/gi,
  /미친[놈년것뇬닌]/gi,
  /꺼[져저]/gi,
  /닥[쳐치칠]/gi,
  /[좆좇]/gi,
  /ㅂㅅ/g,
  /ㅅㅂ/g,
  /ㅈㄹ/g,
  /ㄱㅅㄲ/g,
  /느금마/gi,
  /엠창/gi,
  /애[ ]?미/gi,
  // 영어 비속어 패턴
  /fuck/gi,
  /shit/gi,
  /ass\s?hole/gi,
  /bitch/gi,
  /damn/gi,
  /dick/gi,
  /bastard/gi,
  /wtf/gi,
  /stfu/gi,
]

const EXACT_PROFANITY_WORDS = new Set([
  "씹", "좆", "엿", "새끼", "개새끼", "병신", "지랄",
  "꺼져", "닥쳐", "또라이", "미친놈", "미친년",
  "fuck", "shit", "bitch", "asshole", "dick", "bastard",
])

/**
 * 텍스트에 비속어가 포함되어 있는지 검사합니다.
 * @returns true면 비속어가 감지된 것
 */
export function containsProfanity(text: string): boolean {
  const normalized = text
    .replace(/\s+/g, "")
    .toLowerCase()

  // 패턴 매칭
  for (const pattern of PROFANITY_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(normalized)) return true
  }

  // 정확한 단어 매칭 (원본 텍스트의 각 단어)
  const words = text.toLowerCase().split(/\s+/)
  for (const word of words) {
    if (EXACT_PROFANITY_WORDS.has(word)) return true
  }

  return false
}

/**
 * 비속어를 마스킹(***) 처리합니다.
 */
export function maskProfanity(text: string): string {
  let result = text

  for (const pattern of PROFANITY_PATTERNS) {
    const freshPattern = new RegExp(pattern.source, pattern.flags)
    result = result.replace(freshPattern, (match) =>
      "*".repeat(match.length)
    )
  }

  return result
}
