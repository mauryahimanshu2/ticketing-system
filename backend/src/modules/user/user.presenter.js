const publicFields = [
  '_id',
  'name',
  'email',
  'phone',
  'role',
  'isVerified',
  'isBlocked',
  'blockedAt',
  'blockReason',
  'createdAt',
  'updatedAt',
];

export function publicUser(user) {
  if (!user) return null;

  const value = typeof user.toObject === 'function' ? user.toObject() : user;
  return Object.fromEntries(publicFields
    .filter((field) => value[field] !== undefined)
    .map((field) => [field, value[field]]));
}
