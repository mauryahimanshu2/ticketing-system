import mongoose from 'mongoose';

const { Schema } = mongoose;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sessionSchema = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      trim: true,
    },
    tokenHash: {
      type: String,
      required: true,
      trim: true,
      select: false,
    },
    previousTokenHashes: {
      type: [String],
      default: [],
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: emailPattern,
    },
    phone: {
      type: String,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'agent', 'admin'],
      default: 'user',
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
      required: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      required: true,
    },
    blockedAt: {
      type: Date,
      default: null,
    },
    blockReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    otpHash: {
      type: String,
      select: false,
    },
    otpExpiresAt: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
    },
    lockUntil: {
      type: Date,
    },
    sessions: {
      type: [sessionSchema],
      default: [],
      select: false,
    },
  },
  { timestamps: true, collection: 'users' },
);

userSchema.index({ email: 1 }, { unique: true, name: 'user_email_unique' });
userSchema.index({ role: 1, isVerified: 1 }, { name: 'user_role_verified' });
userSchema.index({ role: 1, isBlocked: 1, createdAt: -1 }, { name: 'user_role_blocked_created' });
userSchema.index({ 'sessions.tokenHash': 1 }, { name: 'user_session_token_hash' });
userSchema.index({ 'sessions.sessionId': 1 }, { name: 'user_session_id' });

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
