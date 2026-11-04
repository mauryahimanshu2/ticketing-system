const ACCESS_SECRET_MIN_BYTES = 32;
const DEFAULT_ACCESS_EXPIRY = '15m';
const DEFAULT_REFRESH_EXPIRY = '7d';

function parseDurationMilliseconds(value, variableName) {
  const match = /^([1-9]\d*)(s|m|h|d)$/.exec(value);
  if (!match) {
    throw new Error(`${variableName} must use a positive duration such as 15m or 7d`);
  }

  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const milliseconds = Number(match[1]) * units[match[2]];
  if (!Number.isSafeInteger(milliseconds)) {
    throw new Error(`${variableName} is outside the supported range`);
  }
  return milliseconds;
}

export function getAuthConfig() {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  if (!accessSecret || Buffer.byteLength(accessSecret, 'utf8') < ACCESS_SECRET_MIN_BYTES) {
    throw new Error('JWT_ACCESS_SECRET must be configured with at least 32 bytes');
  }

  const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || DEFAULT_ACCESS_EXPIRY;
  parseDurationMilliseconds(accessExpiresIn, 'JWT_ACCESS_EXPIRES_IN');

  const refreshExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || DEFAULT_REFRESH_EXPIRY;
  const refreshExpiresInMs = parseDurationMilliseconds(
    refreshExpiresIn,
    'REFRESH_TOKEN_EXPIRES_IN',
  );

  return { accessSecret, accessExpiresIn, refreshExpiresInMs };
}

export function validateAuthConfig() {
  getAuthConfig();
}
