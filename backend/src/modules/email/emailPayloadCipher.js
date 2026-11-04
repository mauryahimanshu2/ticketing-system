import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function getEncryptionKey() {
  const encodedKey = process.env.EMAIL_PAYLOAD_ENCRYPTION_KEY;
  const key = encodedKey ? Buffer.from(encodedKey, 'base64') : Buffer.alloc(0);

  if (key.length !== 32) {
    const error = new Error('EMAIL_PAYLOAD_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
    error.statusCode = 503;
    throw error;
  }

  return key;
}

export function encryptEmailPayload(payload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);

  return {
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
}

export function decryptEmailPayload(encryptedPayload) {
  if (
    !encryptedPayload ||
    typeof encryptedPayload.iv !== 'string' ||
    typeof encryptedPayload.authTag !== 'string' ||
    typeof encryptedPayload.ciphertext !== 'string'
  ) {
    throw new Error('Invalid encrypted email payload');
  }

  const iv = Buffer.from(encryptedPayload.iv, 'base64');
  const authTag = Buffer.from(encryptedPayload.authTag, 'base64');
  const ciphertext = Buffer.from(encryptedPayload.ciphertext, 'base64');

  if (iv.length !== 12 || authTag.length !== 16) {
    throw new Error('Invalid encrypted email payload format');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    iv,
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}
