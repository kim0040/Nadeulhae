export type AuthLocale = "ko" | "en" | "zh" | "ja"

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
  if (header.startsWith("zh")) return "zh"
  if (header.startsWith("ja")) return "ja"
  return header.startsWith("en") ? "en" : "ko"
}

export function getAuthMessage(
  locale: AuthLocale,
  key: AuthMessageKey,
  params?: { maxSelections?: number }
) {
  switch (key) {
    case "invalidRequestOrigin":
      return locale === "ko" ? "허용되지 않은 요청 출처입니다." : locale === "zh" ? "不允许的请求来源。" : locale === "ja" ? "許可されていないリクエスト元です。" : "Request origin is not allowed."
    case "crossSiteBlocked":
      return locale === "ko" ? "교차 사이트 요청은 허용되지 않습니다." : locale === "zh" ? "不允许跨站请求。" : locale === "ja" ? "クロスサイトリクエストは許可されていません。" : "Cross-site requests are not allowed."
    case "jsonOnly":
      return locale === "ko" ? "JSON 요청만 허용됩니다." : locale === "zh" ? "只允许 JSON 请求。" : locale === "ja" ? "JSONリクエストのみ許可されています。" : "Only JSON requests are allowed."
    case "requestBodyTooLarge":
      return locale === "ko" ? "요청 본문이 너무 큽니다." : locale === "zh" ? "请求体过大。" : locale === "ja" ? "リクエストボディが大きすぎます。" : "Request body is too large."
    case "loginInvalidRequest":
      return locale === "ko" ? "잘못된 로그인 요청입니다." : locale === "zh" ? "无效的登录请求。" : locale === "ja" ? "無効なログインリクエストです。" : "Invalid login request."
    case "emailFormatInvalid":
      return locale === "ko" ? "올바른 이메일 형식을 입력해 주세요." : locale === "zh" ? "请输入有效的电子邮件地址。" : locale === "ja" ? "有効なメールアドレスを入力してください。" : "Please enter a valid email address."
    case "emailTooLong":
      return locale === "ko" ? "이메일 길이가 너무 깁니다." : locale === "zh" ? "电子邮件地址过长。" : locale === "ja" ? "メールアドレスが長すぎます。" : "Email is too long."
    case "passwordRequired":
      return locale === "ko" ? "비밀번호를 입력해 주세요." : locale === "zh" ? "请输入密码。" : locale === "ja" ? "パスワードを入力してください。" : "Please enter your password."
    case "passwordTooLong":
      return locale === "ko" ? "비밀번호 길이가 너무 깁니다." : locale === "zh" ? "密码过长。" : locale === "ja" ? "パスワードが長すぎます。" : "Password is too long."
    case "registerInvalidRequest":
      return locale === "ko" ? "잘못된 회원가입 요청입니다." : locale === "zh" ? "无效的注册请求。" : locale === "ja" ? "無効な登録リクエストです。" : "Invalid sign-up request."
    case "displayNameLengthInvalid":
      return locale === "ko"
        ? "이름은 2자 이상 32자 이하로 입력해 주세요."
        : locale === "zh"
        ? "姓名长度必须在2到32个字符之间。"
        : locale === "ja"
        ? "名前は2文字以上32文字以下で入力してください。"
        : "Name must be between 2 and 32 characters."
    case "nicknameLengthInvalid":
      return locale === "ko"
        ? "닉네임은 2자 이상 16자 이하로 입력해 주세요."
        : locale === "zh"
        ? "昵称长度必须在2到16个字符之间。"
        : locale === "ja"
        ? "ニックネームは2文字以上16文字以下で入力してください。"
        : "Nickname must be between 2 and 16 characters."
    case "nicknameCharsInvalid":
      return locale === "ko"
        ? "닉네임에 #, @, 공백은 사용할 수 없습니다."
        : locale === "zh"
        ? "昵称不能包含 #、@ 或空格。"
        : locale === "ja"
        ? "ニックネームに #、@、スペースは使用できません。"
        : "Nickname cannot include #, @, or spaces."
    case "passwordTooLongForRegister":
      return locale === "ko"
        ? "비밀번호는 256자 이하로 입력해 주세요."
        : locale === "zh"
        ? "密码不得超过256个字符。"
        : locale === "ja"
        ? "パスワードは256文字以下で入力してください。"
        : "Password must be 256 characters or fewer."
    case "passwordWeak":
      return locale === "ko"
        ? "비밀번호는 10자 이상이며 영문과 숫자를 모두 포함해야 합니다."
        : locale === "zh"
        ? "密码长度至少为10个字符，且必须包含字母和数字。"
        : locale === "ja"
        ? "パスワードは10文字以上で、英字と数字を両方含める必要があります。"
        : "Password must be at least 10 characters and include both letters and numbers."
    case "ageBandRequired":
      return locale === "ko" ? "연령대를 선택해 주세요." : locale === "zh" ? "请选择年龄段。" : locale === "ja" ? "年齢層を選択してください。" : "Please select an age range."
    case "primaryRegionRequired":
      return locale === "ko" ? "주 사용 지역을 선택해 주세요." : locale === "zh" ? "请选择主要活动区域。" : locale === "ja" ? "主な利用地域を選択してください。" : "Please select your primary region."
    case "preferredTimeRequired":
      return locale === "ko" ? "선호 시간대를 선택해 주세요." : locale === "zh" ? "请选择偏好时间段。" : locale === "ja" ? "希望の時間帯を選択してください。" : "Please select your preferred time slot."
    case "interestRequired":
      return locale === "ko"
        ? "관심 취미를 최소 1개 이상 선택해 주세요."
        : locale === "zh"
        ? "请至少选择一个兴趣。"
        : locale === "ja"
        ? "趣味を1つ以上選択してください。"
        : "Please select at least one interest."
    case "interestMax": {
      const max = params?.maxSelections ?? 5
      return locale === "ko"
        ? `관심 취미는 최대 ${max}개까지 선택할 수 있습니다.`
        : locale === "zh"
        ? `最多可选择 ${max} 个兴趣。`
        : locale === "ja"
        ? `趣味は最大${max}つまで選択できます。`
        : `You can select up to ${max} interests.`
    }
    case "interestOtherRequired":
      return locale === "ko"
        ? "기타 취미를 선택했다면 내용을 함께 적어 주세요."
        : locale === "zh"
        ? "如果选择了其他兴趣，请填写具体内容。"
        : locale === "ja"
        ? "その他の趣味を選択した場合は、内容を記入してください。"
        : "If you selected other interest, please provide details."
    case "interestOtherTooLong":
      return locale === "ko"
        ? "기타 취미는 120자 이하로 입력해 주세요."
        : locale === "zh"
        ? "其他兴趣内容不得超过120个字符。"
        : locale === "ja"
        ? "その他の趣味は120文字以下で入力してください。"
        : "Other interest must be 120 characters or fewer."
    case "requiredConsents":
      return locale === "ko"
        ? "필수 약관과 연령 확인에 모두 동의해 주세요."
        : locale === "zh"
        ? "请同意所有必要条款并确认年龄。"
        : locale === "ja"
        ? "必須の利用規約と年齢確認にすべて同意してください。"
        : "Please agree to all required terms and age confirmation."
    case "profileInvalidRequest":
      return locale === "ko" ? "잘못된 프로필 수정 요청입니다." : locale === "zh" ? "无效的个人资料修改请求。" : locale === "ja" ? "無効なプロフィール更新リクエストです。" : "Invalid profile update request."
    case "loginTooManyAttempts":
      return locale === "ko"
        ? "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
        : locale === "zh"
        ? "登录尝试次数过多。请稍后再试。"
        : locale === "ja"
        ? "ログイン試行回数が多すぎます。しばらくしてからもう一度お試しください。"
        : "Too many login attempts. Please try again later."
    case "invalidJsonRequest":
      return locale === "ko" ? "잘못된 JSON 요청입니다." : locale === "zh" ? "无效的 JSON 请求。" : locale === "ja" ? "無効なJSONリクエストです。" : "Invalid JSON request."
    case "loginInvalidCredentials":
      return locale === "ko"
        ? "이메일 또는 비밀번호가 올바르지 않습니다."
        : locale === "zh"
        ? "电子邮件或密码不正确。"
        : locale === "ja"
        ? "メールアドレスまたはパスワードが正しくありません。"
        : "The email or password is incorrect."
    case "loginInternalError":
      return locale === "ko"
        ? "로그인 처리 중 오류가 발생했습니다."
        : locale === "zh"
        ? "登录处理时发生错误。"
        : locale === "ja"
        ? "ログイン処理中にエラーが発生しました。"
        : "An error occurred while processing login."
    case "registerTooManyAttempts":
      return locale === "ko"
        ? "회원가입 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
        : locale === "zh"
        ? "注册尝试次数过多。请稍后再试。"
        : locale === "ja"
        ? "登録試行回数が多すぎます。しばらくしてからもう一度お試しください。"
        : "Too many sign-up attempts. Please try again later."
    case "registerDuplicateEmail":
      return locale === "ko"
        ? "사용할 수 없는 이메일입니다. 다른 이메일을 사용해 주세요."
        : locale === "zh"
        ? "此电子邮件地址不可用。请使用其他电子邮件。"
        : locale === "ja"
        ? "このメールアドレスは使用できません。別のメールアドレスをご利用ください。"
        : "This email is unavailable. Please use a different one."
    case "registerInternalError":
      return locale === "ko"
        ? "회원가입 처리 중 오류가 발생했습니다."
        : locale === "zh"
        ? "注册处理时发生错误。"
        : locale === "ja"
        ? "登録処理中にエラーが発生しました。"
        : "An error occurred while processing sign-up."
    case "authRequired":
      return locale === "ko" ? "로그인이 필요합니다." : locale === "zh" ? "您需要登录。" : locale === "ja" ? "ログインが必要です。" : "You need to log in."
    case "accountNotFound":
      return locale === "ko" ? "계정 정보를 찾을 수 없습니다." : locale === "zh" ? "未找到账户信息。" : locale === "ja" ? "アカウント情報が見つかりません。" : "Account information was not found."
    case "duplicateNickname":
      return locale === "ko"
        ? "이미 사용 중인 닉네임 조합입니다. 잠시 후 다시 시도해 주세요."
        : locale === "zh"
        ? "该昵称已被使用。请稍后再试。"
        : locale === "ja"
        ? "このニックネームは既に使用されています。しばらくしてからもう一度お試しください。"
        : "This nickname combination is already in use. Please try again later."
    case "profileUpdateInternalError":
      return locale === "ko"
        ? "회원 정보를 수정하는 중 오류가 발생했습니다."
        : locale === "zh"
        ? "更新个人资料时发生错误。"
        : locale === "ja"
        ? "プロフィール情報の更新中にエラーが発生しました。"
        : "An error occurred while updating profile information."
    case "accountDeleteConfirm":
      return locale === "ko"
        ? "계정 탈퇴를 진행하려면 DELETE를 정확히 입력해 주세요."
        : locale === "zh"
        ? "要删除账户，请准确输入 DELETE。"
        : locale === "ja"
        ? "アカウントを削除するには、DELETE と正確に入力してください。"
        : "To delete your account, please type DELETE exactly."
    case "accountDeleteInternalError":
      return locale === "ko"
        ? "회원 탈퇴 처리 중 오류가 발생했습니다."
        : locale === "zh"
        ? "删除账户时发生错误。"
        : locale === "ja"
        ? "アカウント削除処理中にエラーが発生しました。"
        : "An error occurred while deleting the account."
    case "sessionMissing":
      return locale === "ko" ? "인증된 세션이 없습니다." : locale === "zh" ? "未找到已验证的会话。" : locale === "ja" ? "認証されたセッションが見つかりません。" : "No authenticated session was found."
    case "sessionCheckError":
      return locale === "ko"
        ? "세션 확인 중 오류가 발생했습니다."
        : locale === "zh"
        ? "检查会话时发生错误。"
        : locale === "ja"
        ? "セッション確認中にエラーが発生しました。"
        : "An error occurred while checking the session."
    case "logoutInternalError":
      return locale === "ko"
        ? "로그아웃 처리 중 오류가 발생했습니다."
        : locale === "zh"
        ? "登出处理时发生错误。"
        : locale === "ja"
        ? "ログアウト処理中にエラーが発生しました。"
        : "An error occurred while processing logout."
  }
}
