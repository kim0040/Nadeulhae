export type AuthLocale = "ko" | "en"

type AuthMessageKey =
  | "invalidRequestOrigin"
  | "crossSiteBlocked"
  | "jsonOnly"
  | "requestBodyTooLarge"
  | "loginInvalidRequest"
  | "emailFormatInvalid"
  | "emailTooLong"
  | "passwordRequired"
  | "passwordTooLong"
  | "registerInvalidRequest"
  | "displayNameLengthInvalid"
  | "nicknameLengthInvalid"
  | "nicknameCharsInvalid"
  | "passwordTooLongForRegister"
  | "passwordWeak"
  | "ageBandRequired"
  | "primaryRegionRequired"
  | "preferredTimeRequired"
  | "interestRequired"
  | "interestMax"
  | "interestOtherRequired"
  | "interestOtherTooLong"
  | "requiredConsents"
  | "profileInvalidRequest"
  | "loginTooManyAttempts"
  | "invalidJsonRequest"
  | "loginInvalidCredentials"
  | "loginInternalError"
  | "registerTooManyAttempts"
  | "registerDuplicateEmail"
  | "registerInternalError"
  | "authRequired"
  | "accountNotFound"
  | "duplicateNickname"
  | "profileUpdateInternalError"
  | "accountDeleteConfirm"
  | "accountDeleteInternalError"
  | "sessionMissing"
  | "sessionCheckError"
  | "logoutInternalError"

export function resolveAuthLocale(acceptLanguageHeader: string | null | undefined): AuthLocale {
  const header = (acceptLanguageHeader ?? "").trim().toLowerCase()
  return header.startsWith("en") ? "en" : "ko"
}

export function getAuthMessage(
  locale: AuthLocale,
  key: AuthMessageKey,
  params?: { maxSelections?: number }
) {
  switch (key) {
    case "invalidRequestOrigin":
      return locale === "ko" ? "허용되지 않은 요청 출처입니다." : "Request origin is not allowed."
    case "crossSiteBlocked":
      return locale === "ko" ? "교차 사이트 요청은 허용되지 않습니다." : "Cross-site requests are not allowed."
    case "jsonOnly":
      return locale === "ko" ? "JSON 요청만 허용됩니다." : "Only JSON requests are allowed."
    case "requestBodyTooLarge":
      return locale === "ko" ? "요청 본문이 너무 큽니다." : "Request body is too large."
    case "loginInvalidRequest":
      return locale === "ko" ? "잘못된 로그인 요청입니다." : "Invalid login request."
    case "emailFormatInvalid":
      return locale === "ko" ? "올바른 이메일 형식을 입력해 주세요." : "Please enter a valid email address."
    case "emailTooLong":
      return locale === "ko" ? "이메일 길이가 너무 깁니다." : "Email is too long."
    case "passwordRequired":
      return locale === "ko" ? "비밀번호를 입력해 주세요." : "Please enter your password."
    case "passwordTooLong":
      return locale === "ko" ? "비밀번호 길이가 너무 깁니다." : "Password is too long."
    case "registerInvalidRequest":
      return locale === "ko" ? "잘못된 회원가입 요청입니다." : "Invalid sign-up request."
    case "displayNameLengthInvalid":
      return locale === "ko"
        ? "이름은 2자 이상 32자 이하로 입력해 주세요."
        : "Name must be between 2 and 32 characters."
    case "nicknameLengthInvalid":
      return locale === "ko"
        ? "닉네임은 2자 이상 16자 이하로 입력해 주세요."
        : "Nickname must be between 2 and 16 characters."
    case "nicknameCharsInvalid":
      return locale === "ko"
        ? "닉네임에 #, @, 공백은 사용할 수 없습니다."
        : "Nickname cannot include #, @, or spaces."
    case "passwordTooLongForRegister":
      return locale === "ko"
        ? "비밀번호는 256자 이하로 입력해 주세요."
        : "Password must be 256 characters or fewer."
    case "passwordWeak":
      return locale === "ko"
        ? "비밀번호는 10자 이상이며 영문과 숫자를 모두 포함해야 합니다."
        : "Password must be at least 10 characters and include both letters and numbers."
    case "ageBandRequired":
      return locale === "ko" ? "연령대를 선택해 주세요." : "Please select an age range."
    case "primaryRegionRequired":
      return locale === "ko" ? "주 사용 지역을 선택해 주세요." : "Please select your primary region."
    case "preferredTimeRequired":
      return locale === "ko" ? "선호 시간대를 선택해 주세요." : "Please select your preferred time slot."
    case "interestRequired":
      return locale === "ko"
        ? "관심 취미를 최소 1개 이상 선택해 주세요."
        : "Please select at least one interest."
    case "interestMax": {
      const max = params?.maxSelections ?? 5
      return locale === "ko"
        ? `관심 취미는 최대 ${max}개까지 선택할 수 있습니다.`
        : `You can select up to ${max} interests.`
    }
    case "interestOtherRequired":
      return locale === "ko"
        ? "기타 취미를 선택했다면 내용을 함께 적어 주세요."
        : "If you selected other interest, please provide details."
    case "interestOtherTooLong":
      return locale === "ko"
        ? "기타 취미는 120자 이하로 입력해 주세요."
        : "Other interest must be 120 characters or fewer."
    case "requiredConsents":
      return locale === "ko"
        ? "필수 약관과 연령 확인에 모두 동의해 주세요."
        : "Please agree to all required terms and age confirmation."
    case "profileInvalidRequest":
      return locale === "ko" ? "잘못된 프로필 수정 요청입니다." : "Invalid profile update request."
    case "loginTooManyAttempts":
      return locale === "ko"
        ? "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
        : "Too many login attempts. Please try again later."
    case "invalidJsonRequest":
      return locale === "ko" ? "잘못된 JSON 요청입니다." : "Invalid JSON request."
    case "loginInvalidCredentials":
      return locale === "ko"
        ? "이메일 또는 비밀번호가 올바르지 않습니다."
        : "The email or password is incorrect."
    case "loginInternalError":
      return locale === "ko"
        ? "로그인 처리 중 오류가 발생했습니다."
        : "An error occurred while processing login."
    case "registerTooManyAttempts":
      return locale === "ko"
        ? "회원가입 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
        : "Too many sign-up attempts. Please try again later."
    case "registerDuplicateEmail":
      return locale === "ko"
        ? "사용할 수 없는 이메일입니다. 다른 이메일을 사용해 주세요."
        : "This email is unavailable. Please use a different one."
    case "registerInternalError":
      return locale === "ko"
        ? "회원가입 처리 중 오류가 발생했습니다."
        : "An error occurred while processing sign-up."
    case "authRequired":
      return locale === "ko" ? "로그인이 필요합니다." : "You need to log in."
    case "accountNotFound":
      return locale === "ko" ? "계정 정보를 찾을 수 없습니다." : "Account information was not found."
    case "duplicateNickname":
      return locale === "ko"
        ? "이미 사용 중인 닉네임 조합입니다. 잠시 후 다시 시도해 주세요."
        : "This nickname combination is already in use. Please try again later."
    case "profileUpdateInternalError":
      return locale === "ko"
        ? "회원 정보를 수정하는 중 오류가 발생했습니다."
        : "An error occurred while updating profile information."
    case "accountDeleteConfirm":
      return locale === "ko"
        ? "계정 탈퇴를 진행하려면 DELETE를 정확히 입력해 주세요."
        : "To delete your account, please type DELETE exactly."
    case "accountDeleteInternalError":
      return locale === "ko"
        ? "회원 탈퇴 처리 중 오류가 발생했습니다."
        : "An error occurred while deleting the account."
    case "sessionMissing":
      return locale === "ko" ? "인증된 세션이 없습니다." : "No authenticated session was found."
    case "sessionCheckError":
      return locale === "ko"
        ? "세션 확인 중 오류가 발생했습니다."
        : "An error occurred while checking the session."
    case "logoutInternalError":
      return locale === "ko"
        ? "로그아웃 처리 중 오류가 발생했습니다."
        : "An error occurred while processing logout."
  }
}
