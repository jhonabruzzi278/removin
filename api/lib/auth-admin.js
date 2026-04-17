import crypto from 'crypto';
import { prisma } from './prisma.js';
import {
  createTempAccessToken,
  parseAndVerifyTempAccessToken,
  sha256,
  decryptSecret,
  encryptSecret,
} from './crypto.js';
import { getSupabaseAdminClient } from './supabase.js';

const ENCRYPTED_PAYLOAD_PREFIX = 'enc:v1:';

function parseBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

async function getOrCreateUserFromSupabase(supabaseUser) {
  const supabaseUserId = supabaseUser.id;
  const email = supabaseUser.email || `${supabaseUserId}@supabase.local`;
  const metadata = supabaseUser.user_metadata || {};
  const name = metadata.full_name || metadata.name || metadata.user_name || email.split('@')[0];
  const pictureUrl = metadata.avatar_url || metadata.picture || null;

  return prisma.user.upsert({
    where: { authUserId: supabaseUserId },
    update: {
      email,
      name,
      pictureUrl,
    },
    create: {
      authUserId: supabaseUserId,
      email,
      name,
      pictureUrl,
    },
  });
}

function mapUserForFrontend(user) {
  return {
    uid: user.id,
    email: user.email,
    displayName: user.name || user.email,
    photoURL: user.pictureUrl || null,
  };
}

async function verifySupabaseToken(rawToken) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(rawToken);

  if (error || !data?.user?.id) {
    throw new Error(error?.message || 'Token de Supabase invalido');
  }

  return data.user;
}

export async function verifyAuthToken(authHeader) {
  const rawToken = parseBearerToken(authHeader);
  if (!rawToken) {
    return { uid: null, error: 'Token de autenticacion requerido' };
  }

  try {
    const supabaseUser = await verifySupabaseToken(rawToken);
    const user = await getOrCreateUserFromSupabase(supabaseUser);
    return { uid: user.id, error: null, user: mapUserForFrontend(user) };
  } catch (error) {
    console.error('Error verificando token:', error.message);
    return { uid: null, error: 'Token invalido o expirado' };
  }
}

export async function getUserReplicateToken(uid) {
  if (!uid) return { token: null, error: 'Usuario requerido' };

  try {
    const credential = await prisma.replicateCredential.findUnique({
      where: { userId: uid },
    });

    if (!credential) {
      return { token: null, error: null };
    }

    const token = decryptSecret(credential.tokenCipher);
    return { token, error: null };
  } catch (error) {
    console.error('Error obteniendo token de usuario:', error.message);
    return { token: null, error: 'Error al obtener token' };
  }
}

export async function saveUserReplicateToken(uid, token) {
  if (!uid || !token) {
    return { success: false, error: 'Usuario y token requeridos' };
  }

  try {
    const tokenCipher = encryptSecret(token);
    await prisma.replicateCredential.upsert({
      where: { userId: uid },
      update: { tokenCipher },
      create: { userId: uid, tokenCipher },
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Error guardando token cifrado:', error.message);
    return { success: false, error: 'No fue posible guardar el token' };
  }
}

function makeInternalTempUrl(uploadId, accessToken) {
  return `removin-temp://${uploadId}?token=${encodeURIComponent(accessToken)}`;
}

function encryptTemporaryPayload(payloadBuffer) {
  const base64Payload = Buffer.from(payloadBuffer).toString('base64');
  const cipherText = encryptSecret(base64Payload);
  return Buffer.from(`${ENCRYPTED_PAYLOAD_PREFIX}${cipherText}`, 'utf8');
}

function decryptTemporaryPayload(storedPayload) {
  const payloadBuffer = Buffer.isBuffer(storedPayload)
    ? storedPayload
    : Buffer.from(storedPayload || []);

  const asText = payloadBuffer.toString('utf8');
  if (!asText.startsWith(ENCRYPTED_PAYLOAD_PREFIX)) {
    // Backward compatibility for legacy rows created before encryption-at-rest.
    return payloadBuffer;
  }

  const cipherText = asText.slice(ENCRYPTED_PAYLOAD_PREFIX.length);
  const plainBase64 = decryptSecret(cipherText);
  return Buffer.from(plainBase64, 'base64');
}

export function parseInternalTempUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'removin-temp:') return null;
    const uploadId = parsed.hostname;
    const token = parsed.searchParams.get('token');
    if (!uploadId || !token) return null;
    return { uploadId, token };
  } catch {
    return null;
  }
}

export async function createTemporaryUpload({ uid, logicalPath, fileName, mimeType, payload }) {
  const uploadId = `upl_${crypto.randomUUID().replace(/-/g, '')}`;
  const { raw: accessToken, hash: accessTokenHash, expiresAt } = createTempAccessToken(uploadId, uid);
  const encryptedPayload = encryptTemporaryPayload(payload);

  const record = await prisma.temporaryUpload.create({
    data: {
      id: uploadId,
      userId: uid,
      logicalPath,
      fileName,
      mimeType,
      byteSize: payload.length,
      payload: encryptedPayload,
      accessTokenHash,
      expiresAt,
    },
  });

  return {
    uploadId: record.id,
    logicalPath: record.logicalPath,
    internalUrl: makeInternalTempUrl(record.id, accessToken),
    expiresAt: record.expiresAt.toISOString(),
  };
}

export async function resolveTemporaryUploadFromInternalUrl(url, expectedUid = null) {
  const parsed = parseInternalTempUrl(url);
  if (!parsed) {
    return { upload: null, error: 'URL temporal invalida' };
  }

  const record = await prisma.temporaryUpload.findUnique({
    where: { id: parsed.uploadId },
  });

  if (!record) return { upload: null, error: 'Archivo temporal no encontrado' };
  if (record.expiresAt.getTime() < Date.now()) {
    return { upload: null, error: 'Archivo temporal expirado' };
  }
  if (expectedUid && record.userId !== expectedUid) {
    return { upload: null, error: 'No autorizado para usar este archivo temporal' };
  }

  const validation = parseAndVerifyTempAccessToken(parsed.token, record.id, record.userId);
  if (!validation.valid) {
    return { upload: null, error: 'Token temporal invalido' };
  }

  if (sha256(parsed.token) !== record.accessTokenHash) {
    return { upload: null, error: 'Token temporal no coincide' };
  }

  let decryptedPayload;
  try {
    decryptedPayload = decryptTemporaryPayload(record.payload);
  } catch (error) {
    return { upload: null, error: 'No se pudo leer el archivo temporal' };
  }

  return {
    upload: {
      ...record,
      payload: decryptedPayload,
    },
    error: null,
  };
}

export async function deleteTemporaryUpload({ uploadId, uid }) {
  if (!uploadId || !uid) return { success: false, error: 'Parametros invalidos' };

  const deleted = await prisma.temporaryUpload.deleteMany({
    where: { id: uploadId, userId: uid },
  });

  return deleted.count > 0
    ? { success: true, error: null }
    : { success: false, error: 'Archivo temporal no encontrado' };
}

export async function cleanupExpiredData() {
  const now = new Date();
  await prisma.temporaryUpload.deleteMany({ where: { expiresAt: { lt: now } } });
}

export function initializeAuthAdmin() {
  return null;
}
