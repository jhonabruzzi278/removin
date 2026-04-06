import crypto from 'crypto';

const SESSION_TOKEN_BYTES = 48;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const TEMP_UPLOAD_TTL_MS = 1000 * 60 * 15; // 15 minutes

function getEnvOrThrow(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createSessionToken() {
  const raw = crypto.randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  return { raw, hash: sha256(raw), expiresAt };
}

export function hashSessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  return sha256(token);
}

function getTokenEncryptionKey() {
  const keyFromEnv = getEnvOrThrow('TOKEN_ENCRYPTION_KEY');
  // Allows base64url key or long plain-text key.
  const isBase64Url = /^[A-Za-z0-9\-_]+$/.test(keyFromEnv) && keyFromEnv.length >= 43;
  const key = isBase64Url ? base64UrlDecode(keyFromEnv) : Buffer.from(keyFromEnv, 'utf8');
  if (key.length < 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must provide at least 32 bytes of entropy');
  }
  return crypto.createHash('sha256').update(key).digest();
}

export function encryptSecret(plainText) {
  const key = getTokenEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${authTag.toString('base64url')}`;
}

export function decryptSecret(cipherText) {
  const [ivB64, payloadB64, tagB64] = String(cipherText || '').split('.');
  if (!ivB64 || !payloadB64 || !tagB64) {
    throw new Error('Invalid encrypted payload format');
  }

  const key = getTokenEncryptionKey();
  const iv = base64UrlDecode(ivB64);
  const payload = base64UrlDecode(payloadB64);
  const authTag = base64UrlDecode(tagB64);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return decrypted.toString('utf8');
}

function getTempUploadSecret() {
  return getEnvOrThrow('SESSION_SECRET');
}

export function createTempAccessToken(uploadId, userId) {
  const nonce = crypto.randomBytes(16).toString('base64url');
  const expiresAt = new Date(Date.now() + TEMP_UPLOAD_TTL_MS);
  const expiresMs = String(expiresAt.getTime());
  const body = `${uploadId}.${userId}.${nonce}.${expiresMs}`;
  const signature = crypto
    .createHmac('sha256', getTempUploadSecret())
    .update(body)
    .digest('base64url');

  const raw = `${body}.${signature}`;
  return { raw, hash: sha256(raw), expiresAt };
}

export function parseAndVerifyTempAccessToken(token, expectedUploadId, expectedUserId) {
  const parts = String(token || '').split('.');
  if (parts.length !== 5) return { valid: false, reason: 'Formato invalido' };

  const [uploadId, userId, nonce, expiresMs, providedSignature] = parts;
  if (!uploadId || !userId || !nonce || !expiresMs || !providedSignature) {
    return { valid: false, reason: 'Formato invalido' };
  }

  if (uploadId !== expectedUploadId || userId !== expectedUserId) {
    return { valid: false, reason: 'Token no corresponde al recurso' };
  }

  const body = `${uploadId}.${userId}.${nonce}.${expiresMs}`;
  const expectedSignature = crypto
    .createHmac('sha256', getTempUploadSecret())
    .update(body)
    .digest('base64url');

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: 'Firma invalida' };
  }

  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return { valid: false, reason: 'Firma invalida' };
  }

  const expiration = Number(expiresMs);
  if (!Number.isFinite(expiration) || Date.now() > expiration) {
    return { valid: false, reason: 'Token expirado' };
  }

  return { valid: true, expiresAt: new Date(expiration) };
}
