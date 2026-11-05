export function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function sendHttpError(res, error, { logLabel, fallbackMessage }) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  console.error(`${logLabel} (${error.name})`);
  return res.status(503).json({ error: fallbackMessage });
}

export function createHandler(operation, options) {
  const { status = 200, ...errorOptions } = options;

  return async (req, res) => {
    try {
      const body = await operation(req);
      const responseStatus = typeof status === 'function' ? status(body) : status;
      return res.status(responseStatus).json(body);
    } catch (error) {
      return sendHttpError(res, error, errorOptions);
    }
  };
}

export function actorFromRequest(req) {
  return {
    userId: req.auth.userId,
    role: req.auth.role,
    ipAddress: req.ip,
  };
}

export function adminContextFromRequest(req) {
  return {
    actorId: req.auth.userId,
    actorRole: req.auth.role,
    ipAddress: req.ip,
  };
}
