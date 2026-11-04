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

function sendAuthError(res, error) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  console.error(`Authentication request failed (${error.name})`);
  return res.status(503).json({ error: 'Authentication request could not be completed' });
}

export async function registerUser(req, res) {
  try {
    const result = await register(req.body);
    return res.status(202).json({
      status: result.status,
      jobId: result.jobId,
      message: 'Verification email queued; delivery is not yet confirmed.',
    });
  } catch (error) {
    return sendAuthError(res, error);
  }
}

export async function verifyRegistration(req, res) {
  try {
    const user = await verifyRegistrationOtp(req.body);
    return res.status(201).json({
      message: 'Registration verified and account created.',
      user,
    });
  } catch (error) {
    return sendAuthError(res, error);
  }
}

function requestContext(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

export async function loginWithPassword(req, res) {
  try {
    return res.status(200).json(await passwordLogin(req.body, requestContext(req)));
  } catch (error) {
    return sendAuthError(res, error);
  }
}

export async function requestLoginOtpCode(req, res) {
  try {
    await requestLoginOtp(req.body, requestContext(req));
    return res.status(202).json({
      message: 'If the account is eligible, a login verification code has been queued.',
    });
  } catch (error) {
    return sendAuthError(res, error);
  }
}

export async function loginWithOtp(req, res) {
  try {
    return res.status(200).json(await verifyLoginOtp(req.body, requestContext(req)));
  } catch (error) {
    return sendAuthError(res, error);
  }
}

export async function refreshTokens(req, res) {
  try {
    return res.status(200).json(await rotateRefreshToken(req.body));
  } catch (error) {
    return sendAuthError(res, error);
  }
}

export async function logout(req, res) {
  try {
    return res.status(200).json(await logoutCurrentSession(req.body));
  } catch (error) {
    return sendAuthError(res, error);
  }
}

export async function logoutAll(req, res) {
  try {
    return res.status(200).json(await logoutAllSessions(req.auth.userId));
  } catch (error) {
    return sendAuthError(res, error);
  }
}

export async function forgotPassword(req, res) {
  try {
    await requestPasswordReset(req.body, requestContext(req));
    return res.status(202).json({
      message: 'If the account is eligible, a password reset code has been queued.',
    });
  } catch (error) {
    return sendAuthError(res, error);
  }
}

export async function resetUserPassword(req, res) {
  try {
    return res.status(200).json(await resetPassword(req.body));
  } catch (error) {
    return sendAuthError(res, error);
  }
}
