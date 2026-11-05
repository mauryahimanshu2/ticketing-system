import { httpError } from '../../utils/http.js';
import { rejectUnknownFields } from '../../utils/validation.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedRegistrationFields = new Set(['name', 'email', 'phone', 'password']);
const allowedOtpFields = new Set(['email', 'otp']);
const allowedLoginFields = new Set(['email', 'password']);
const allowedEmailFields = new Set(['email']);
const allowedRefreshFields = new Set(['refreshToken']);
const allowedResetPasswordFields = new Set(['email', 'otp', 'newPassword']);

function invalidInput(message) {
  return httpError(message, 400);
}

export function validateRegistrationInput(input) {
  rejectUnknownFields(input, allowedRegistrationFields);

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const phone = typeof input.phone === 'string'
    ? input.phone.replace(/[\s().-]/g, '')
    : '';
  const password = input.password;

  if (name.length < 1 || name.length > 120) {
    throw invalidInput('Name is required and must be at most 120 characters');
  }
  if (email.length > 254 || !emailPattern.test(email)) {
    throw invalidInput('A valid email address is required');
  }
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    throw invalidInput('Phone must be a valid international number in E.164 format');
  }
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw invalidInput('Password must be at least 8 characters and at most 72 UTF-8 bytes');
  }

  return { name, email, phone, password };
}

export function validateOtpInput(input) {
  rejectUnknownFields(input, allowedOtpFields);

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (email.length > 254 || !emailPattern.test(email)) {
    throw invalidInput('A valid email address is required');
  }
  if (typeof input.otp !== 'string' || !/^\d{6}$/.test(input.otp)) {
    throw invalidInput('OTP must be a six-digit string');
  }

  return { email, otp: input.otp };
}

function validateEmail(input, allowedFields = allowedEmailFields) {
  rejectUnknownFields(input, allowedFields);

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (email.length > 254 || !emailPattern.test(email)) {
    throw invalidInput('A valid email address is required');
  }
  return email;
}

export function validatePasswordLoginInput(input) {
  const email = validateEmail(input, allowedLoginFields);
  if (
    typeof input.password !== 'string' ||
    input.password.length === 0 ||
    Buffer.byteLength(input.password, 'utf8') > 72
  ) {
    throw invalidInput('Password is required and must be at most 72 UTF-8 bytes');
  }
  return { email, password: input.password };
}

export function validateEmailInput(input) {
  return { email: validateEmail(input) };
}

export function validateRefreshTokenInput(input) {
  rejectUnknownFields(input, allowedRefreshFields);
  if (
    typeof input.refreshToken !== 'string' ||
    input.refreshToken.length < 40 ||
    input.refreshToken.length > 200 ||
    !/^[A-Za-z0-9_-]+$/.test(input.refreshToken)
  ) {
    throw invalidInput('A valid refresh token is required');
  }
  return { refreshToken: input.refreshToken };
}

export function validateResetPasswordInput(input) {
  rejectUnknownFields(input, allowedResetPasswordFields);
  const { email, otp } = validateOtpInput({
    email: input.email,
    otp: input.otp,
  });
  if (
    typeof input.newPassword !== 'string' ||
    input.newPassword.length < 8 ||
    Buffer.byteLength(input.newPassword, 'utf8') > 72
  ) {
    throw invalidInput('Password must be at least 8 characters and at most 72 UTF-8 bytes');
  }
  return { email, otp, newPassword: input.newPassword };
}
