import {
  logoutAllSessions,
  logoutCurrentSession,
  passwordLogin,
  register,
  requestLoginOtp,
  requestPasswordReset,
  resetPassword,
  rotateRefreshToken,
  verifyLoginOtp,
  verifyRegistrationOtp,
} from './auth.service.js';
import { createHandler } from '../../utils/http.js';

const handler = (operation, status = 200) => createHandler(operation, {
  status,
  logLabel: 'Authentication request failed',
  fallbackMessage: 'Authentication request could not be completed',
});

function requestContext(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

export const registerUser = handler(async (req) => {
  const result = await register(req.body);
  return {
    status: result.status,
    jobId: result.jobId,
    message: 'Verification email queued; delivery is not yet confirmed.',
  };
}, 202);

export const verifyRegistration = handler(async (req) => {
  const user = await verifyRegistrationOtp(req.body);
  return {
    message: 'Registration verified and account created.',
    user,
  };
}, 201);

export const loginWithPassword = handler((req) => passwordLogin(req.body, requestContext(req)));

export const requestLoginOtpCode = handler(async (req) => {
  await requestLoginOtp(req.body, requestContext(req));
  return {
    message: 'A login verification code has been queued for this customer account.',
  };
}, 202);

export const loginWithOtp = handler((req) => verifyLoginOtp(req.body, requestContext(req)));

export const refreshTokens = handler((req) => rotateRefreshToken(req.body));

export const logout = handler((req) => logoutCurrentSession(req.body));

export const logoutAll = handler((req) => logoutAllSessions(req.auth.userId));

export const forgotPassword = handler(async (req) => {
  await requestPasswordReset(req.body, requestContext(req));
  return {
    message: 'If the account is eligible, a password reset code has been queued.',
  };
}, 202);

export const resetUserPassword = handler((req) => resetPassword(req.body));
