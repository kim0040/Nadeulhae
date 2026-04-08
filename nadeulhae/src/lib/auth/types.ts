export interface AuthUser {
  id: string
  email: string
  displayName: string
  nickname: string
  nicknameTag: string
  ageBand: string
  primaryRegion: string
  interestTags: string[]
  interestOther: string | null
  preferredTimeSlot: string
  weatherSensitivity: string[]
  marketingAccepted: boolean
  analyticsAccepted: boolean
  createdAt: string
}

export interface AuthResponseBody {
  user: AuthUser
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload extends LoginPayload {
  displayName: string
  nickname: string
  ageBand: string
  primaryRegion: string
  interestTags: string[]
  interestOther: string
  preferredTimeSlot: string
  weatherSensitivity: string[]
  termsAccepted: boolean
  privacyAccepted: boolean
  ageConfirmed: boolean
  marketingAccepted: boolean
  analyticsAccepted: boolean
}

export interface UpdateProfilePayload {
  displayName: string
  nickname: string
  ageBand: string
  primaryRegion: string
  interestTags: string[]
  interestOther: string
  preferredTimeSlot: string
  weatherSensitivity: string[]
  marketingAccepted: boolean
  analyticsAccepted: boolean
}
