import { httpError } from './http.js';

export function requireAdmin(actor) {
  const role = actor?.role ?? actor?.actorRole;
  if (role !== 'admin') {
    throw httpError('Admin access is required', 403);
  }
}
