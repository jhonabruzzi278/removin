import crypto from 'crypto';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { prisma } from './prisma.js';
import {
  createTempAccessToken,
  parseAndVerifyTempAccessToken,
  sha256,
  decryptSecret,
  encryptSecret,
} from './crypto.js';

function parseBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

async function getOrCreateUserFromClerk(clerkUserId) {
  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const email = clerkUser.emailAddresses?.find((item) => item.id === clerkUser.primaryEmailAddressId)?.emailAddress
    || clerkUser.emailAddresses?.[0]?.emailAddress
    || `${clerkUserId}@clerk.local`;

  const name = clerkUser.fullName || clerkUser.firstName || email.split('@')[0];
  const pictureUrl = clerkUser.imageUrl || null;

  return prisma.user.upsert({
    where: { clerkId: clerkUserId },
    update: {
      email,
      name,
      pictureUrl,
    },
    create: {
      clerkId: clerkUserId,
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

async function verifyClerkToken(rawToken) {
  const { verifyToken } = await import('@clerk/clerk-sdk-node');
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY no configurado');
  }

  const result = await verifyToken(rawToken, { secretKey });
  if (!result || !result.sub) {
    throw new Error('Token de Clerk invalido');
  }

  return result.sub;
}

export async function verifyAuthToken(authHeader) {
  const rawToken = parseBearerToken(authHeader);
  if (!rawToken) {
    return { uid: null, error: 'Token de autenticacion requerido' };
  }

  try {
    const clerkUserId = await verifyClerkToken(rawToken);
    const user = await getOrCreateUserFromClerk(clerkUserId);
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

  const record = await prisma.temporaryUpload.create({
    data: {
      id: uploadId,
      userId: uid,
      logicalPath,
      fileName,
      mimeType,
      byteSize: payload.length,
      payload,
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

  return { upload: record, error: null };
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

export function initializeFirebase() {
  return null;
}
