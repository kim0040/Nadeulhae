import {
  AGE_BAND_OPTIONS,
  INTEREST_OPTIONS,
  MAX_INTEREST_SELECTIONS,
  MIN_PASSWORD_LENGTH,
  PRIMARY_REGION_OPTIONS,
  TIME_SLOT_OPTIONS,
  WEATHER_SENSITIVITY_OPTIONS,
  filterAllowedValues,
  isAllowedValue,
} from "@/lib/auth/profile-options"
import type {
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
} from "@/lib/auth/types"

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function asBoolean(value: unknown) {
  return value === true
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function hasPasswordStrength(value: string) {
  return value.length >= MIN_PASSWORD_LENGTH
    && /[A-Za-z]/.test(value)
    && /\d/.test(value)
}

export function validateLoginPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { error: "잘못된 로그인 요청입니다." }
  }

  const { email, password } = payload as Partial<LoginPayload>

  const normalizedEmail = asTrimmedString(email).toLowerCase()
  const normalizedPassword = asTrimmedString(password)

  if (!isEmail(normalizedEmail)) {
    return { error: "올바른 이메일 형식을 입력해 주세요." }
  }

  if (!normalizedPassword) {
    return { error: "비밀번호를 입력해 주세요." }
  }

  return {
    data: {
      email: normalizedEmail,
      password: normalizedPassword,
    },
  }
}

export function validateRegisterPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { error: "잘못된 회원가입 요청입니다." }
  }

  const {
    displayName,
    email,
    password,
    ageBand,
    primaryRegion,
    interestTags,
    interestOther,
    preferredTimeSlot,
    weatherSensitivity,
    termsAccepted,
    privacyAccepted,
    ageConfirmed,
    marketingAccepted,
  } = payload as Partial<RegisterPayload>

  const normalizedDisplayName = asTrimmedString(displayName)
  const normalizedEmail = asTrimmedString(email).toLowerCase()
  const normalizedPassword = asTrimmedString(password)
  const normalizedInterestOther = asTrimmedString(interestOther)

  const sanitizedInterestTags = filterAllowedValues(
    Array.isArray(interestTags) ? interestTags : [],
    INTEREST_OPTIONS
  )
  const sanitizedWeatherSensitivity = filterAllowedValues(
    Array.isArray(weatherSensitivity) ? weatherSensitivity : [],
    WEATHER_SENSITIVITY_OPTIONS
  )

  if (normalizedDisplayName.length < 2 || normalizedDisplayName.length > 32) {
    return { error: "이름은 2자 이상 32자 이하로 입력해 주세요." }
  }

  if (!isEmail(normalizedEmail)) {
    return { error: "올바른 이메일 형식을 입력해 주세요." }
  }

  if (!hasPasswordStrength(normalizedPassword)) {
    return { error: "비밀번호는 10자 이상이며 영문과 숫자를 모두 포함해야 합니다." }
  }

  if (!ageBand || !isAllowedValue(ageBand, AGE_BAND_OPTIONS)) {
    return { error: "연령대를 선택해 주세요." }
  }

  if (!primaryRegion || !isAllowedValue(primaryRegion, PRIMARY_REGION_OPTIONS)) {
    return { error: "주 사용 지역을 선택해 주세요." }
  }

  if (!preferredTimeSlot || !isAllowedValue(preferredTimeSlot, TIME_SLOT_OPTIONS)) {
    return { error: "선호 시간대를 선택해 주세요." }
  }

  if (sanitizedInterestTags.length === 0) {
    return { error: "관심 취미를 최소 1개 이상 선택해 주세요." }
  }

  if (sanitizedInterestTags.length > MAX_INTEREST_SELECTIONS) {
    return { error: `관심 취미는 최대 ${MAX_INTEREST_SELECTIONS}개까지 선택할 수 있습니다.` }
  }

  if (sanitizedInterestTags.includes("other") && !normalizedInterestOther) {
    return { error: "기타 취미를 선택했다면 내용을 함께 적어 주세요." }
  }

  if (!asBoolean(termsAccepted) || !asBoolean(privacyAccepted) || !asBoolean(ageConfirmed)) {
    return { error: "필수 약관과 연령 확인에 모두 동의해 주세요." }
  }

  return {
    data: {
      displayName: normalizedDisplayName,
      email: normalizedEmail,
      password: normalizedPassword,
      ageBand,
      primaryRegion,
      interestTags: sanitizedInterestTags,
      interestOther: normalizedInterestOther || "",
      preferredTimeSlot,
      weatherSensitivity: sanitizedWeatherSensitivity,
      termsAccepted: true,
      privacyAccepted: true,
      ageConfirmed: true,
      marketingAccepted: asBoolean(marketingAccepted),
    },
  }
}

export function validateUpdateProfilePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { error: "잘못된 프로필 수정 요청입니다." }
  }

  const {
    displayName,
    ageBand,
    primaryRegion,
    interestTags,
    interestOther,
    preferredTimeSlot,
    weatherSensitivity,
    marketingAccepted,
  } = payload as Partial<UpdateProfilePayload>

  const normalizedDisplayName = asTrimmedString(displayName)
  const normalizedInterestOther = asTrimmedString(interestOther)

  const sanitizedInterestTags = filterAllowedValues(
    Array.isArray(interestTags) ? interestTags : [],
    INTEREST_OPTIONS
  )
  const sanitizedWeatherSensitivity = filterAllowedValues(
    Array.isArray(weatherSensitivity) ? weatherSensitivity : [],
    WEATHER_SENSITIVITY_OPTIONS
  )

  if (normalizedDisplayName.length < 2 || normalizedDisplayName.length > 32) {
    return { error: "이름은 2자 이상 32자 이하로 입력해 주세요." }
  }

  if (!ageBand || !isAllowedValue(ageBand, AGE_BAND_OPTIONS)) {
    return { error: "연령대를 선택해 주세요." }
  }

  if (!primaryRegion || !isAllowedValue(primaryRegion, PRIMARY_REGION_OPTIONS)) {
    return { error: "주 사용 지역을 선택해 주세요." }
  }

  if (!preferredTimeSlot || !isAllowedValue(preferredTimeSlot, TIME_SLOT_OPTIONS)) {
    return { error: "선호 시간대를 선택해 주세요." }
  }

  if (sanitizedInterestTags.length === 0) {
    return { error: "관심 취미를 최소 1개 이상 선택해 주세요." }
  }

  if (sanitizedInterestTags.length > MAX_INTEREST_SELECTIONS) {
    return { error: `관심 취미는 최대 ${MAX_INTEREST_SELECTIONS}개까지 선택할 수 있습니다.` }
  }

  if (sanitizedInterestTags.includes("other") && !normalizedInterestOther) {
    return { error: "기타 취미를 선택했다면 내용을 함께 적어 주세요." }
  }

  return {
    data: {
      displayName: normalizedDisplayName,
      ageBand,
      primaryRegion,
      interestTags: sanitizedInterestTags,
      interestOther: normalizedInterestOther || "",
      preferredTimeSlot,
      weatherSensitivity: sanitizedWeatherSensitivity,
      marketingAccepted: asBoolean(marketingAccepted),
    },
  }
}
