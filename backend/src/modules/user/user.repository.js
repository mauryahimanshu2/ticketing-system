import User from './user.model.js';

export async function findUserByEmail(email) {
  return User.findOne({ email });
}

export async function createUser(userData) {
  return User.create(userData);
}

export async function findUserByEmailForAuth(email) {
  return User.findOne({ email }).select('+passwordHash');
}

export async function findAuthUserById(userId) {
  return User.findById(userId).select('_id role isVerified isBlocked');
}

export async function listManagedUsers({ role, page, limit, search, blocked, verified }) {
  const filter = { role };
  if (blocked !== undefined) filter.isBlocked = blocked;
  if (verified !== undefined) filter.isVerified = verified;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    User.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1, _id: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: 'tickets',
          let: { managedUserId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: role === 'agent'
                  ? { $eq: ['$assignedTo', '$$managedUserId'] }
                  : { $eq: ['$requesterId', '$$managedUserId'] },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                open: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', ['open', 'in_progress', 'pending']] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          as: 'ticketStats',
        },
      },
      {
        $set: {
          ticketStats: {
            $ifNull: [{ $arrayElemAt: ['$ticketStats', 0] }, { total: 0, open: 0 }],
          },
        },
      },
      {
        $project: {
          name: 1,
          email: 1,
          phone: 1,
          role: 1,
          isVerified: 1,
          isBlocked: 1,
          blockedAt: 1,
          blockReason: 1,
          createdAt: 1,
          updatedAt: 1,
          ticketStats: 1,
        },
      },
    ]),
    User.countDocuments(filter),
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

export async function findManagedUser(userId, role) {
  return User.findOne({ _id: userId, role })
    .select('name email phone role isVerified isBlocked blockedAt blockReason createdAt updatedAt')
    .lean();
}

export async function createManagedUser(userData) {
  return User.create(userData);
}

export async function updateManagedUser(userId, role, updates, revokeSessions) {
  const update = { $set: updates };
  if (revokeSessions) update.$set.sessions = [];
  return User.findOneAndUpdate(
    { _id: userId, role },
    update,
    { returnDocument: 'after', runValidators: true, projection: '-passwordHash -otpHash -sessions' },
  );
}

export async function setUserBlocked(userId, role, isBlocked, reason = null) {
  return User.findOneAndUpdate(
    { _id: userId, role },
    {
      $set: {
        isBlocked,
        blockedAt: isBlocked ? new Date() : null,
        blockReason: isBlocked ? reason : null,
        ...(isBlocked ? { sessions: [] } : {}),
      },
    },
    { returnDocument: 'after', projection: '-passwordHash -otpHash -sessions' },
  );
}

export async function addSession(
  userId,
  session,
  now = new Date(),
  expectedPasswordHash,
) {
  const result = await User.updateOne(
    {
      _id: userId,
      isVerified: true,
      isBlocked: { $ne: true },
      $or: [{ lockUntil: null }, { lockUntil: { $lte: now } }],
      ...(expectedPasswordHash ? { passwordHash: expectedPasswordHash } : {}),
    },
    {
      $push: { sessions: session },
      $set: { loginAttempts: 0, lockUntil: null },
    },
  );
  return result.modifiedCount === 1;
}

export async function recordFailedLogin(userId, now, maxAttempts, lockDurationMs) {
  return User.updateOne(
    {
      _id: userId,
      $or: [
        { lockUntil: null },
        { lockUntil: { $exists: false } },
        { lockUntil: { $lte: now } },
      ],
    },
    [
      {
        $set: {
          loginAttempts: {
            $add: [
              {
                $cond: [
                  {
                    $and: [
                      { $ne: [{ $ifNull: ['$lockUntil', null] }, null] },
                      { $lte: ['$lockUntil', now] },
                    ],
                  },
                  0,
                  { $ifNull: ['$loginAttempts', 0] },
                ],
              },
              1,
            ],
          },
        },
      },
      {
        $set: {
          lockUntil: {
            $cond: [
              { $gte: ['$loginAttempts', maxAttempts] },
              new Date(now.getTime() + lockDurationMs),
              {
                $cond: [
                  {
                    $and: [
                      { $ne: [{ $ifNull: ['$lockUntil', null] }, null] },
                      { $lte: ['$lockUntil', now] },
                    ],
                  },
                  null,
                  '$lockUntil',
                ],
              },
            ],
          },
        },
      },
    ],
    { updatePipeline: true },
  );
}

export async function findSessionByTokenHash(tokenHash) {
  return User.findOne({ 'sessions.tokenHash': tokenHash }).select(
    '+sessions +sessions.sessionId +sessions.tokenHash +sessions.previousTokenHashes +sessions.expiresAt +sessions.createdAt +sessions.ipAddress +sessions.userAgent',
  );
}

export async function findSessionByPreviousTokenHash(tokenHash) {
  return User.findOne({ 'sessions.previousTokenHashes': tokenHash }).select(
    '+sessions +sessions.sessionId +sessions.tokenHash +sessions.previousTokenHashes +sessions.expiresAt +sessions.createdAt +sessions.ipAddress +sessions.userAgent',
  );
}

export async function rotateSessionToken({
  oldTokenHash,
  newTokenHash,
  expiresAt,
  now,
}) {
  return User.findOneAndUpdate(
    {
      isBlocked: { $ne: true },
      sessions: {
        $elemMatch: {
          tokenHash: oldTokenHash,
          expiresAt: { $gt: now },
        },
      },
    },
    {
      $set: {
        'sessions.$.tokenHash': newTokenHash,
        'sessions.$.expiresAt': expiresAt,
      },
      $addToSet: {
        'sessions.$.previousTokenHashes': oldTokenHash,
      },
    },
    { returnDocument: 'after' },
  );
}

export async function revokeSessionById(userId, sessionId) {
  return User.updateOne(
    { _id: userId, 'sessions.sessionId': sessionId },
    { $pull: { sessions: { sessionId } } },
  );
}

export async function revokeSessionByTokenHash(tokenHash) {
  return User.updateOne(
    {
      $or: [
        { 'sessions.tokenHash': tokenHash },
        { 'sessions.previousTokenHashes': tokenHash },
      ],
    },
    { $pull: { sessions: { $or: [{ tokenHash }, { previousTokenHashes: tokenHash }] } } },
  );
}

export async function revokeAllSessions(userId) {
  return User.updateOne({ _id: userId }, { $set: { sessions: [] } });
}

export async function hasActiveSession(userId, sessionId, now = new Date()) {
  const user = await User.exists({
    _id: userId,
    sessions: {
      $elemMatch: {
        sessionId,
        expiresAt: { $gt: now },
      },
    },
  });
  return Boolean(user);
}

export async function resetPasswordAndRevokeSessions(email, passwordHash) {
  return User.updateOne(
    { email, isVerified: true, role: 'user', isBlocked: { $ne: true } },
    { $set: { passwordHash, sessions: [], loginAttempts: 0, lockUntil: null } },
  );
}
