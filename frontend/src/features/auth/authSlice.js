import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { authService } from '../../services/auth.service.js'
import {
  clearSessionTokens,
  getRefreshToken,
  saveSessionTokens,
} from '../../services/token.service.js'

export const restoreSession = createAsyncThunk('auth/restoreSession', async () => {
  try {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return null
    const result = await authService.refreshSession(refreshToken)
    saveSessionTokens(result)
    return result
  } catch {
    clearSessionTokens()
    return null
  }
})

export const registerAccount = createAsyncThunk('auth/register', async (form) => (
  authService.register(form)
))

export const verifyRegistration = createAsyncThunk('auth/verifyRegistration', async (form) => (
  authService.verifyRegistration(form)
))

export const loginWithPassword = createAsyncThunk('auth/login', async ({ expectedRole, ...form }) => {
  const result = await authService.loginWithPassword(form)
  if (expectedRole && result.user?.role !== expectedRole) {
    throw new Error(`This account is registered as ${result.user?.role || 'another role'}`)
  }
  saveSessionTokens(result)
  return result
})

export const requestLoginOtp = createAsyncThunk('auth/requestLoginOtp', async ({ email }) => {
  const result = await authService.requestLoginOtp(email)
  return { ...result, email }
})

export const verifyLoginOtp = createAsyncThunk('auth/verifyLoginOtp', async (form) => {
  const result = await authService.verifyLoginOtp(form)
  if (result.user?.role !== 'user') {
    throw new Error('Email OTP login is available only for customers')
  }
  saveSessionTokens(result)
  return result
})

export const logoutUser = createAsyncThunk('auth/logout', async (_, { getState }) => {
  const refreshToken = getState().auth.refreshToken || getRefreshToken()
  try {
    if (refreshToken) await authService.logout(refreshToken)
  } catch {
    // Local logout must still complete when the session is already unavailable.
  } finally {
    clearSessionTokens()
  }
})

export const requestPasswordReset = createAsyncThunk('auth/requestPasswordReset', async ({ email }) => {
  const result = await authService.requestPasswordReset(email)
  return { ...result, email }
})

export const resetPassword = createAsyncThunk('auth/resetPassword', async (form) => (
  authService.resetPassword(form)
))

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    accessToken: null,
    refreshToken: null,
    pendingEmail: '',
    status: 'restoring',
    error: null,
  },
  reducers: {
    clearAuthFeedback(state) {
      state.status = 'idle'
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.pending, (state) => {
        state.status = 'restoring'
        state.error = null
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        if (!action.payload) {
          state.status = 'idle'
          return
        }
        state.status = 'authenticated'
        state.user = action.payload.user
        state.accessToken = action.payload.accessToken
        state.refreshToken = action.payload.refreshToken
      })
      .addCase(registerAccount.fulfilled, (state, action) => {
        state.status = 'registrationOtpRequired'
        state.pendingEmail = action.meta.arg.email
      })
      .addCase(verifyRegistration.fulfilled, (state, action) => {
        state.status = 'registrationVerified'
        state.user = action.payload.user || null
      })
      .addCase(loginWithPassword.fulfilled, (state, action) => {
        state.status = 'authenticated'
        state.user = action.payload.user
        state.accessToken = action.payload.accessToken
        state.refreshToken = action.payload.refreshToken
      })
      .addCase(requestLoginOtp.fulfilled, (state, action) => {
        state.status = 'loginOtpRequired'
        state.pendingEmail = action.payload.email
      })
      .addCase(verifyLoginOtp.fulfilled, (state, action) => {
        state.status = 'authenticated'
        state.user = action.payload.user
        state.accessToken = action.payload.accessToken
        state.refreshToken = action.payload.refreshToken
      })
      .addCase(requestPasswordReset.fulfilled, (state, action) => {
        state.status = 'passwordResetOtpRequired'
        state.pendingEmail = action.payload.email
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.status = 'passwordResetComplete'
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null
        state.accessToken = null
        state.refreshToken = null
        state.status = 'idle'
        state.error = null
      })
      .addMatcher(
        (action) => action.type.startsWith('auth/')
          && !action.type.startsWith('auth/restoreSession')
          && action.type.endsWith('/pending'),
        (state) => { state.status = 'loading'; state.error = null },
      )
      .addMatcher(
        (action) => action.type.startsWith('auth/')
          && !action.type.startsWith('auth/restoreSession')
          && action.type.endsWith('/rejected'),
        (state, action) => {
          state.status = 'failed'
          state.error = action.error.message || 'Unable to continue'
        },
      )
  },
})

export const { clearAuthFeedback } = authSlice.actions
export default authSlice.reducer
