import express from 'express';
import { authenticateAccessToken } from '../../middleware/authenticate.js';
import {
  forgotPassword,
  loginWithOtp,
  loginWithPassword,
  logout,
  logoutAll,
  refreshTokens,
  registerUser,
  requestLoginOtpCode,
  resetUserPassword,
  verifyRegistration,
} from './auth.controller.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/verify-registration-otp', verifyRegistration);
router.post('/login-password', loginWithPassword);
router.post('/login-otp', requestLoginOtpCode);
router.post('/verify-login-otp', loginWithOtp);
router.post('/refresh-token', refreshTokens);
router.post('/logout', logout);
router.post('/logout-all', authenticateAccessToken, logoutAll);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetUserPassword);

export default router;
