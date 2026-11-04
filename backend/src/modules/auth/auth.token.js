import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getAuthConfig } from '../../config/auth.js';

export function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createTokenPair(user, sessionId = randomUUID(), now = new Date()) {
  const { accessSecret, accessExpiresIn, refreshExpiresInMs } = getAuthConfig();
  const refreshToken = randomBytes(64).toString('base64url');
  const expiresAt = new Date(now.getTime() + refreshExpiresInMs);
  const accessToken = jwt.sign(
    { role: user.role },
    accessSecret,
    {
      subject: String(user._id),
      expiresIn: accessExpiresIn,
      jwtid: sessionId,
    },
  );

  return {
    accessToken,
    refreshToken,
    refreshTokenHash: hashRefreshToken(refreshToken),
    sessionId,
    expiresAt,
  };
}

export function verifyAccessToken(token) {
  const { accessSecret } = getAuthConfig();
  return jwt.verify(token, accessSecret, {
    algorithms: ['HS256'],
  });
}
