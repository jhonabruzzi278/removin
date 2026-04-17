import crypto from 'crypto';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { getSupabaseAdmin } from './supabase.js';
import {
  createTempAccessToken,
  parseAndVerifyTempAccessToken,
  sha256,
  decryptSecret,
  encryptSecret,
  encryptBinary,
  decryptBinary,
} from './crypto.js';

function parseBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

function mapUserForFrontend(user) {
  return {
    uid: user.id,
    email: user.email,
    displayName: user.name || user.email,
    photoURL: user.picture_url || null,
  };
}

async function getOrCreateUserFromClerk(clerkUserId) {
  const supabase = getSupabaseAdmin();
  const clerkUser = await clerkClient.users.getUser(clerkUserId);

  const email =
    clerkUser.emailAddresses?.find((item) => item.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ||
    clerkUser.emailAddresses?.[0]?.emailAddress ||
    `${clerkUserId}@clerk.local`;

  const name = clerkUser.fullName || clerkUser.firstName || email.split('@')[0];
  const pictureUrl = clerkUser.imageUrl || null;

  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        id: clerkUserId,
        clerk_id: clerkUserId,
        email,
        name,
        picture_url: pictureUrl,
        updated_at: nowIso,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single();

  if (error) {
    throw new Error(`No se pudo sincronizar usuario en Supabase: ${error.message}`);
  }

  return data;
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
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('replicate_credentials')
      .select('token_cipher')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return { token: null, error: null };
    }

    const token = decryptSecret(data.token_cipher);
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
    const supabase = getSupabaseAdmin();
    const tokenCipher = encryptSecret(token);

    const { error } = await supabase.from('replicate_credentials').upsert(
      {
        user_id: uid,
        token_cipher: tokenCipher,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      throw new Error(error.message);
    }

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
  const supabase = getSupabaseAdmin();
  const uploadId = `upl_${crypto.randomUUID().replace(/-/g, '')}`;
  const { raw: accessToken, hash: accessTokenHash, expiresAt } = createTempAccessToken(uploadId, uid);

  const encryptedPayload = encryptBinary(payload);
  const payloadCipher = encryptedPayload.payload.toString('base64url');

  const { data, error } = await supabase
    .from('temporary_uploads')
    .insert({
      id: uploadId,
      user_id: uid,
      logical_path: logicalPath,
      file_name: fileName,
      mime_type: mimeType,
      byte_size: payload.length,
      payload_cipher: payloadCipher,
      payload_iv: encryptedPayload.iv,
      payload_auth_tag: encryptedPayload.authTag,
      access_token_hash: accessTokenHash,
      expires_at: expiresAt.toISOString(),
    })
    .select('id, logical_path, expires_at')
    .single();

  if (error) {
    throw new Error(`No se pudo guardar upload temporal en Supabase: ${error.message}`);
  }

  return {
    uploadId: data.id,
    logicalPath: data.logical_path,
    internalUrl: makeInternalTempUrl(data.id, accessToken),
    expiresAt: data.expires_at,
  };
}

export async function resolveTemporaryUploadFromInternalUrl(url, expectedUid = null) {
  const parsed = parseInternalTempUrl(url);
  if (!parsed) {
    return { upload: null, error: 'URL temporal invalida' };
  }

  const supabase = getSupabaseAdmin();
  const { data: record, error } = await supabase
    .from('temporary_uploads')
    .select('*')
    .eq('id', parsed.uploadId)
    .maybeSingle();

  if (error) {
    return { upload: null, error: 'No se pudo leer archivo temporal' };
  }

  if (!record) return { upload: null, error: 'Archivo temporal no encontrado' };
  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { upload: null, error: 'Archivo temporal expirado' };
  }
  if (expectedUid && record.user_id !== expectedUid) {
    return { upload: null, error: 'No autorizado para usar este archivo temporal' };
  }

  const validation = parseAndVerifyTempAccessToken(parsed.token, record.id, record.user_id);
  if (!validation.valid) {
    return { upload: null, error: 'Token temporal invalido' };
  }

  if (sha256(parsed.token) !== record.access_token_hash) {
    return { upload: null, error: 'Token temporal no coincide' };
  }

  try {
    const payloadBuffer = Buffer.from(record.payload_cipher, 'base64url');
    const decryptedPayload = decryptBinary(payloadBuffer, record.payload_iv, record.payload_auth_tag);

    return {
      upload: {
        id: record.id,
        userId: record.user_id,
        logicalPath: record.logical_path,
        fileName: record.file_name,
        mimeType: record.mime_type,
        byteSize: record.byte_size,
        payload: decryptedPayload,
        expiresAt: new Date(record.expires_at),
      },
      error: null,
    };
  } catch {
    return { upload: null, error: 'No se pudo descifrar el archivo temporal' };
  }
}

export async function deleteTemporaryUpload({ uploadId, uid }) {
  if (!uploadId || !uid) return { success: false, error: 'Parametros invalidos' };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('temporary_uploads')
    .delete()
    .eq('id', uploadId)
    .eq('user_id', uid)
    .select('id');

  if (error) {
    return { success: false, error: 'No se pudo eliminar archivo temporal' };
  }

  return data && data.length > 0
    ? { success: true, error: null }
    : { success: false, error: 'Archivo temporal no encontrado' };
}

export async function cleanupExpiredData() {
  const supabase = getSupabaseAdmin();
  await supabase.from('temporary_uploads').delete().lt('expires_at', new Date().toISOString());
}

export function initializeFirebase() {
  return null;
}
