function normalizeOrigin(value) {
  return value.trim().replace(/\/$/, '')
}

function getAllowedOrigins() {
  return new Set(
    String(process.env.CORS_ORIGINS || '')
      .split(',')
      .map(normalizeOrigin)
      .filter(Boolean),
  )
}

export const corsOptions = {
  origin(origin, callback) {
    // Requests from Postman, server jobs and same-origin clients have no Origin header.
    if (!origin) return callback(null, true)

    const allowedOrigins = getAllowedOrigins()
    return callback(null, allowedOrigins.has(normalizeOrigin(origin)))
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-inbound-email-secret'],
  credentials: false,
  maxAge: 86400,
}
