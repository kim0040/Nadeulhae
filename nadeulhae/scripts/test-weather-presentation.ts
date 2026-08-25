import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { mockWeatherData } from "../src/data/mockData"
import {
  detectLanguageFromAcceptLanguage,
  parseLanguage,
  resolvePreferredLanguage,
} from "../src/lib/language"
import {
  AIR_QUALITY_FALLBACK_WARNING_KEY,
  classifyCurrentWeatherIcon,
  classifyForecastWeatherIcon,
  getFallbackWarningKey,
  isWetForecastDay,
  localizeUvLabel,
  markWeatherAsFallback,
  resolveObservedRegionPresentation,
  scoreToBand,
} from "../src/lib/weather-presentation"

const JEONJU = { key: "jeonju", displayName: "전주", englishName: "Jeonju" }
const SEOUL = { key: "seoul", displayName: "서울", englishName: "Seoul" }

function run() {
  // 1. Air-quality fallback must keep the observed city, not relabel as Jeonju.
  const awayFallback = resolveObservedRegionPresentation({
    isAirQualityFallback: true,
    profile: SEOUL,
    homeRegion: JEONJU,
    scoreBand: scoreToBand(88),
  })
  assert.equal(awayFallback.isHomeRegion, false)
  assert.equal(awayFallback.locationLabel, "서울")
  assert.equal(awayFallback.locationLabelEn, "Seoul")
  assert.equal(awayFallback.regionKey, "seoul")
  assert.equal(awayFallback.messageKey, "msg_away_excellent")
  assert.equal(awayFallback.airQualityFallbackWarningKey, AIR_QUALITY_FALLBACK_WARNING_KEY)

  const homeLive = resolveObservedRegionPresentation({
    isAirQualityFallback: false,
    profile: JEONJU,
    homeRegion: JEONJU,
    scoreBand: "good",
  })
  assert.equal(homeLive.isHomeRegion, true)
  assert.equal(homeLive.messageKey, "msg_home_good")
  assert.equal(homeLive.airQualityFallbackWarningKey, null)

  // 2. Total API failure is fallback — never treat mock 95 as live data.
  assert.equal(mockWeatherData.score, 95)
  assert.equal(mockWeatherData.isFallback, false)
  const failed = markWeatherAsFallback(mockWeatherData)
  assert.equal(failed.isFallback, true)
  assert.equal(failed.fallbackReason, "weather")
  assert.equal(failed.score, 95)
  assert.notEqual(failed.isFallback, mockWeatherData.isFallback)
  assert.equal(getFallbackWarningKey("air_quality"), AIR_QUALITY_FALLBACK_WARNING_KEY)
  assert.equal(getFallbackWarningKey("weather"), "fallback_message")

  // 3. Dashboard icon uses PTY / isRain / SKY codes, not i18n status keys.
  assert.equal(
    classifyCurrentWeatherIcon({ isRain: false, pty: 0, sky: 1 }),
    "sun",
  )
  assert.equal(
    classifyCurrentWeatherIcon({ isRain: false, pty: 0, sky: 4 }),
    "cloud",
  )
  assert.equal(
    classifyCurrentWeatherIcon({ isRain: true, pty: 0, sky: 1 }),
    "rain",
  )
  assert.equal(
    classifyCurrentWeatherIcon({ isRain: false, pty: 1, sky: 1 }),
    "rain",
  )
  assert.equal(
    classifyCurrentWeatherIcon({ isRain: false, forecastPty: 3, sky: 1 }),
    "rain",
  )
  assert.notEqual(
    classifyCurrentWeatherIcon({ isRain: false, pty: 0, sky: 1 }),
    "cloud",
    "clear SKY=1 must not fall through to the cloudy default",
  )

  // i18n status strings must not drive the icon (the old buggy check).
  const statusKey = "status_excellent"
  assert.equal(statusKey.includes("맑음") || statusKey.includes("비"), false)

  // 4. Picnic rain detection prefers precipChance / PTY-like tokens.
  assert.equal(isWetForecastDay({ sky: "맑음", precipChance: 10 }), false)
  assert.equal(isWetForecastDay({ sky: "구름많음", precipChance: 70 }), true)
  assert.equal(isWetForecastDay({ sky: "Rain", precipChance: 20 }), true)
  assert.equal(isWetForecastDay({ sky: "비", precipChance: 0 }), true)
  assert.equal(isWetForecastDay({ sky: "맑음", precipChance: 0, pty: 1 }), true)
  assert.equal(isWetForecastDay({ sky: "맑음", knockout: "rain" }), true)
  assert.equal(classifyForecastWeatherIcon({ sky: "맑음", precipChance: 0 }), "sun")
  assert.equal(classifyForecastWeatherIcon({ sky: "흐림", precipChance: 10 }), "cloud")
  assert.equal(classifyForecastWeatherIcon({ sky: "Cloudy", precipChance: 80 }), "rain")

  // 5. UV labels cover zh/ja as well as en.
  assert.equal(localizeUvLabel("낮음", "en"), "Low")
  assert.equal(localizeUvLabel("보통", "zh"), "中等")
  assert.equal(localizeUvLabel("매우높음", "ja"), "非常に高い")
  assert.equal(localizeUvLabel("위험", "zh"), "极高")
  assert.equal(localizeUvLabel("낮음", "ko", (key) => `t:${key}`), "t:uv_low")
  assert.equal(localizeUvLabel(undefined, "en"), "--")

  // Language resolution honors saved preferences and Accept-Language priority.
  assert.equal(parseLanguage("en-US"), "en")
  assert.equal(detectLanguageFromAcceptLanguage("en-US,en;q=0.9"), "en")
  assert.equal(detectLanguageFromAcceptLanguage("en-US;q=0.1,ko-KR;q=0.9"), "ko")
  assert.equal(detectLanguageFromAcceptLanguage("ko-KR;q=0,en-US;q=0.9"), "en")
  assert.equal(
    resolvePreferredLanguage({ stored: "ja", acceptLanguage: "ko-KR" }),
    "ja",
  )
  assert.equal(
    resolvePreferredLanguage({ stored: null, acceptLanguage: "zh-CN,zh;q=0.8" }),
    "zh",
  )

  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const routeSource = readFileSync(resolve(projectRoot, "src/app/api/weather/current/route.ts"), "utf8")
  const dataServiceSource = readFileSync(resolve(projectRoot, "src/services/dataService.ts"), "utf8")
  const weatherPresentationSource = readFileSync(resolve(projectRoot, "src/lib/weather-presentation.ts"), "utf8")
  const layoutSource = readFileSync(resolve(projectRoot, "src/app/layout.tsx"), "utf8")
  const skipLinkSource = readFileSync(resolve(projectRoot, "src/components/skip-to-content-link.tsx"), "utf8")
  const nextConfigSource = readFileSync(resolve(projectRoot, "next.config.ts"), "utf8")
  const dashboardSource = readFileSync(resolve(projectRoot, "src/app/dashboard/page.tsx"), "utf8")

  assert.equal(routeSource.includes("const isHomeRegion = isFallback"), false)
  assert.equal(routeSource.includes("locationLabel = isFallback ? HOME_REGION.displayName"), false)
  assert.match(routeSource, /resolveObservedRegionPresentation/)
  assert.match(routeSource, /fallbackReason: isFallback \? "air_quality" : undefined/)
  assert.match(dataServiceSource, /markWeatherAsFallback\(mockWeatherData\)/)
  assert.match(weatherPresentationSource, /fallbackReason: "weather"/)
  assert.equal(dataServiceSource.includes("return mockWeatherData; // Fallback to mock on error"), false)
  assert.equal(layoutSource.includes("from \"next/headers\""), false)
  assert.equal(layoutSource.includes("<SkipToContentLink />"), true)
  assert.match(skipLinkSource, /t\("skip_to_content"\)/)
  assert.match(nextConfigSource, /src\/proxy\.ts/)
  assert.equal(dashboardSource.includes('weatherData.status.includes("비")'), false)
  assert.match(dashboardSource, /classifyCurrentWeatherIcon/)

  console.log("Weather presentation regression tests passed")
}

run()
