import { apiRequest } from './api.js'

export const authService = {
  register(data) {
    return apiRequest('/auth/register', { method: 'POST', data })
  },

  verifyRegistration(data) {
    return apiRequest('/auth/verify-registration-otp', { method: 'POST', data })
  },

  loginWithPassword(data) {
    return apiRequest('/auth/login-password', { method: 'POST', data })
  },

  requestLoginOtp(email) {
    return apiRequest('/auth/login-otp', { method: 'POST', data: { email } })
  },

  verifyLoginOtp(data) {
    return apiRequest('/auth/verify-login-otp', { method: 'POST', data })
  },

  requestPasswordReset(email) {
    return apiRequest('/auth/forgot-password', { method: 'POST', data: { email } })
  },

  resetPassword(data) {
    return apiRequest('/auth/reset-password', { method: 'POST', data })
  },

  logout(refreshToken) {
    return apiRequest('/auth/logout', { method: 'POST', data: { refreshToken } })
  },

  refreshSession(refreshToken) {
    return apiRequest('/auth/refresh-token', { method: 'POST', data: { refreshToken } })
  },
}
