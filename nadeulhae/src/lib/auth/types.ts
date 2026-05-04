/**
 * Auth type definitions.
 * Defines the core AuthUser interface and API payload shapes
 * for login, registration, and profile updates.
 */

/** Represents the public-facing user profile returned to clients. */
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
  labEnabled: boolean
  createdAt: string
}

/** Standard response body returned on successful auth API calls. */
export interface AuthResponseBody {
  user: AuthUser
}

/** Fields required for a login request. */
export interface LoginPayload {
  email: string
  password: string
}

/** Fields required for a user registration request. */
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

/** Fields accepted in a profile update request. */
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
  labEnabled: boolean
}
