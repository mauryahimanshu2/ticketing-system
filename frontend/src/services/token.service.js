let accessToken = null
const REFRESH_TOKEN_KEY = 'ticketing_refresh_token'

export function setAccessToken(token) {
  accessToken = token || null
}

export function getAccessToken() {
  return accessToken
}

export function clearAccessToken() {
  accessToken = null
}

export function setRefreshToken(token) {
  if (token) sessionStorage.setItem(REFRESH_TOKEN_KEY, token)
  else sessionStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getRefreshToken() {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY)
}

export function saveSessionTokens({ accessToken: nextAccessToken, refreshToken }) {
  setAccessToken(nextAccessToken)
  setRefreshToken(refreshToken)
}

export function clearSessionTokens() {
  clearAccessToken()
  setRefreshToken(null)
}
