import { verifyAccessToken } from '../modules/auth/auth.token.js';
import { findAuthUserById, hasActiveSession } from '../modules/user/user.repository.js';

export async function authenticate(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = verifyAccessToken(match[1]);
    if (
      typeof payload !== 'object' ||
      typeof payload.sub !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.jti !== 'string'
    ) {
      return res.status(401).json({ error: 'Invalid access token' });
    }

    const user = await findAuthUserById(payload.sub);
    if (!user || !user.isVerified) {
      return res.status(401).json({ error: 'Account is unavailable' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ error: 'Account is blocked' });
    }
    if (!(await hasActiveSession(payload.sub, payload.jti))) {
      return res.status(401).json({ error: 'Access token session has been revoked or expired' });
    }

    req.auth = { userId: payload.sub, role: user.role, sessionId: payload.jti };
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired access token' });
    }
    console.error(`Access token authentication failed (${error.name})`);
    return res.status(503).json({ error: 'Authentication could not be completed' });
  }
}

export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}

export const authenticateAccessToken = authenticate;
export const requireAdmin = [authenticate, authorizeRoles('admin')];
export const requireAgent = [authenticate, authorizeRoles('agent')];
export const requireUser = [authenticate, authorizeRoles('user')];
