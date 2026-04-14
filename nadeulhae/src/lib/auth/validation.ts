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
import {
  type AuthLocale,
  getAuthMessage,
} from "@/lib/auth/messages"
import type {
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
} from "@/lib/auth/types"

function asTrimmedString(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
}

function asBoolean(value: unknown) {
  return value === true
}

function asNormalizedNickname(value: unknown) {
  return asTrimmedString(value).normalize("NFKC")
}

const MAX_EMAIL_LENGTH = 254
const MAX_PASSWORD_LENGTH = 256
const MAX_INTEREST_OTHER_LENGTH = 120

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function hasPasswordStrength(value: string) {
  return value.length >= MIN_PASSWORD_LENGTH
    && /[A-Za-z]/.test(value)
    && /\d/.test(value)
}

export function validateLoginPayload(payload: unknown, locale: AuthLocale = "ko") {
  if (!payload || typeof payload !== "object") {
    return { error: getAuthMessage(locale, "loginInvalidRequest") }
  }

  const { email, password } = payload as Partial<LoginPayload>

  const normalizedEmail = asTrimmedString(email).toLowerCase()
  const normalizedPassword = asTrimmedString(password)

  if (!isEmail(normalizedEmail)) {
    return { error: getAuthMessage(locale, "emailFormatInvalid") }
  }

  if (normalizedEmail.length > MAX_EMAIL_LENGTH) {
    return { error: getAuthMessage(locale, "emailTooLong") }
  }

  if (!normalizedPassword) {
    return { error: getAuthMessage(locale, "passwordRequired") }
  }

  if (normalizedPassword.length > MAX_PASSWORD_LENGTH) {
    return { error: getAuthMessage(locale, "passwordTooLong") }
  }

  return {
    data: {
      email: normalizedEmail,
      password: normalizedPassword,
    },
  }
}

export function validateRegisterPayload(payload: unknown, locale: AuthLocale = "ko") {
  if (!payload || typeof payload !== "object") {
    return { error: getAuthMessage(locale, "registerInvalidRequest") }
  }

  const {
    displayName,
    nickname,
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
    analyticsAccepted,
  } = payload as Partial<RegisterPayload>

  const normalizedDisplayName = asTrimmedString(displayName)
  const normalizedNickname = asNormalizedNickname(nickname)
  const normalizedEmail = asTrimmedString(email).toLowerCase()
  const normalizedPassword = asTrimmedString(password)
  const normalizedInterestOther = asTrimmedString(interestOther)

  if (/[<>"'&\/\\]/.test(normalizedDisplayName)) {
    return { error: getAuthMessage(locale, "displayNameLengthInvalid") }
  }

  const sanitizedInterestTags = filterAllowedValues(
    Array.isArray(interestTags) ? interestTags : [],
    INTEREST_OPTIONS
  )
  const sanitizedWeatherSensitivity = filterAllowedValues(
    Array.isArray(weatherSensitivity) ? weatherSensitivity : [],
    WEATHER_SENSITIVITY_OPTIONS
  )

  if (normalizedDisplayName.length < 2 || normalizedDisplayName.length > 32) {
    return { error: getAuthMessage(locale, "displayNameLengthInvalid") }
  }

  if (normalizedNickname.length < 2 || normalizedNickname.length > 16) {
    return { error: getAuthMessage(locale, "nicknameLengthInvalid") }
  }

  if (/[#@\s]/.test(normalizedNickname)) {
    return { error: getAuthMessage(locale, "nicknameCharsInvalid") }
  }

  if (/[<>"'&\/\\]/.test(normalizedNickname)) {
    return { error: getAuthMessage(locale, "nicknameCharsInvalid") }
  }

  if (!isEmail(normalizedEmail)) {
    return { error: getAuthMessage(locale, "emailFormatInvalid") }
  }

  if (normalizedEmail.length > MAX_EMAIL_LENGTH) {
    return { error: getAuthMessage(locale, "emailTooLong") }
  }

  if (normalizedPassword.length > MAX_PASSWORD_LENGTH) {
    return { error: getAuthMessage(locale, "passwordTooLongForRegister") }
  }

  if (!hasPasswordStrength(normalizedPassword)) {
    return { error: getAuthMessage(locale, "passwordWeak") }
  }

  if (!ageBand || !isAllowedValue(ageBand, AGE_BAND_OPTIONS)) {
    return { error: getAuthMessage(locale, "ageBandRequired") }
  }

  if (!primaryRegion || !isAllowedValue(primaryRegion, PRIMARY_REGION_OPTIONS)) {
    return { error: getAuthMessage(locale, "primaryRegionRequired") }
  }

  if (!preferredTimeSlot || !isAllowedValue(preferredTimeSlot, TIME_SLOT_OPTIONS)) {
    return { error: getAuthMessage(locale, "preferredTimeRequired") }
  }

  if (sanitizedInterestTags.length === 0) {
    return { error: getAuthMessage(locale, "interestRequired") }
  }

  if (sanitizedInterestTags.length > MAX_INTEREST_SELECTIONS) {
    return {
      error: getAuthMessage(locale, "interestMax", {
        maxSelections: MAX_INTEREST_SELECTIONS,
      }),
    }
  }

  if (sanitizedInterestTags.includes("other") && !normalizedInterestOther) {
    return { error: getAuthMessage(locale, "interestOtherRequired") }
  }

  if (normalizedInterestOther.length > MAX_INTEREST_OTHER_LENGTH) {
    return { error: getAuthMessage(locale, "interestOtherTooLong") }
  }

  if (!asBoolean(termsAccepted) || !asBoolean(privacyAccepted) || !asBoolean(ageConfirmed)) {
    return { error: getAuthMessage(locale, "requiredConsents") }
  }

  return {
    data: {
      displayName: normalizedDisplayName,
      nickname: normalizedNickname,
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
      analyticsAccepted: asBoolean(analyticsAccepted),
    },
  }
}

export function validateUpdateProfilePayload(payload: unknown, locale: AuthLocale = "ko") {
  if (!payload || typeof payload !== "object") {
    return { error: getAuthMessage(locale, "profileInvalidRequest") }
  }

  const {
    displayName,
    nickname,
    ageBand,
    primaryRegion,
    interestTags,
    interestOther,
    preferredTimeSlot,
    weatherSensitivity,
    marketingAccepted,
    analyticsAccepted,
    labEnabled,
  } = payload as Partial<UpdateProfilePayload>

  const normalizedDisplayName = asTrimmedString(displayName)
  const normalizedNickname = asNormalizedNickname(nickname)
  const normalizedInterestOther = asTrimmedString(interestOther)

  if (/[<>"'&\/\\]/.test(normalizedDisplayName)) {
    return { error: getAuthMessage(locale, "displayNameLengthInvalid") }
  }

  const sanitizedInterestTags = filterAllowedValues(
    Array.isArray(interestTags) ? interestTags : [],
    INTEREST_OPTIONS
  )
  const sanitizedWeatherSensitivity = filterAllowedValues(
    Array.isArray(weatherSensitivity) ? weatherSensitivity : [],
    WEATHER_SENSITIVITY_OPTIONS
  )

  if (normalizedDisplayName.length < 2 || normalizedDisplayName.length > 32) {
    return { error: getAuthMessage(locale, "displayNameLengthInvalid") }
  }

  if (normalizedNickname.length < 2 || normalizedNickname.length > 16) {
    return { error: getAuthMessage(locale, "nicknameLengthInvalid") }
  }

  if (/[#@\s]/.test(normalizedNickname)) {
    return { error: getAuthMessage(locale, "nicknameCharsInvalid") }
  }

  if (/[<>"'&\/\\]/.test(normalizedNickname)) {
    return { error: getAuthMessage(locale, "nicknameCharsInvalid") }
  }

  if (!ageBand || !isAllowedValue(ageBand, AGE_BAND_OPTIONS)) {
    return { error: getAuthMessage(locale, "ageBandRequired") }
  }

  if (!primaryRegion || !isAllowedValue(primaryRegion, PRIMARY_REGION_OPTIONS)) {
    return { error: getAuthMessage(locale, "primaryRegionRequired") }
  }

  if (!preferredTimeSlot || !isAllowedValue(preferredTimeSlot, TIME_SLOT_OPTIONS)) {
    return { error: getAuthMessage(locale, "preferredTimeRequired") }
  }

  if (sanitizedInterestTags.length === 0) {
    return { error: getAuthMessage(locale, "interestRequired") }
  }

  if (sanitizedInterestTags.length > MAX_INTEREST_SELECTIONS) {
    return {
      error: getAuthMessage(locale, "interestMax", {
        maxSelections: MAX_INTEREST_SELECTIONS,
      }),
    }
  }

  if (sanitizedInterestTags.includes("other") && !normalizedInterestOther) {
    return { error: getAuthMessage(locale, "interestOtherRequired") }
  }

  if (normalizedInterestOther.length > MAX_INTEREST_OTHER_LENGTH) {
    return { error: getAuthMessage(locale, "interestOtherTooLong") }
  }

  return {
    data: {
      displayName: normalizedDisplayName,
      nickname: normalizedNickname,
      ageBand,
      primaryRegion,
      interestTags: sanitizedInterestTags,
      interestOther: normalizedInterestOther || "",
      preferredTimeSlot,
      weatherSensitivity: sanitizedWeatherSensitivity,
      marketingAccepted: asBoolean(marketingAccepted),
      analyticsAccepted: asBoolean(analyticsAccepted),
      labEnabled: asBoolean(labEnabled),
    },
  }
}
