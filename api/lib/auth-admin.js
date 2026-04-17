import crypto from 'crypto';
import {
  createTempAccessToken,
  parseAndVerifyTempAccessToken,
  sha256,
  decryptSecret,
  encryptSecret,
} from './crypto.js';
import { getSupabaseAdminClient } from './supabase.js';

const ENCRYPTED_PAYLOAD_PREFIX = 'enc:v1:';
const REPLICATE_CREDENTIALS_TABLE = 'replicate_credentials';
const TEMP_UPLOADS_TABLE = 'temporary_uploads';

function parseBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

function mapUserForFrontend(supabaseUser) {
  const metadata = supabaseUser.user_metadata || {};
  const email = supabaseUser.email || `${supabaseUser.id}@supabase.local`;
  return {
    uid: supabaseUser.id,
    email,
    displayName:
      metadata.full_name || metadata.name || metadata.user_name || email.split('@')[0],
    photoURL: metadata.avatar_url || metadata.picture || null,
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
    return { uid: supabaseUser.id, error: null, user: mapUserForFrontend(supabaseUser) };
  } catch (error) {
    console.error('Error verificando token:', error.message);
    return { uid: null, error: 'Token invalido o expirado' };
  }
}

export async function getUserReplicateToken(uid) {
  if (!uid) return { token: null, error: 'Usuario requerido' };

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(REPLICATE_CREDENTIALS_TABLE)
      .select('token_cipher')
      .eq('auth_user_id', uid)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data?.token_cipher) {
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
    const supabase = getSupabaseAdminClient();
    const tokenCipher = encryptSecret(token);
    const { error } = await supabase.from(REPLICATE_CREDENTIALS_TABLE).upsert(
      {
        auth_user_id: uid,
        token_cipher: tokenCipher,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'auth_user_id',
      }
    );

    if (error) {
      throw error;
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

function encryptTemporaryPayload(payloadBuffer) {
  const base64Payload = Buffer.from(payloadBuffer).toString('base64');
  const cipherText = encryptSecret(base64Payload);
  return `${ENCRYPTED_PAYLOAD_PREFIX}${cipherText}`;
}

function decryptTemporaryPayload(storedPayload) {
  const asText =
    typeof storedPayload === 'string'
      ? storedPayload
      : Buffer.isBuffer(storedPayload)
        ? storedPayload.toString('utf8')
        : String(storedPayload || '');
  if (!asText.startsWith(ENCRYPTED_PAYLOAD_PREFIX)) {
    // Backward compatibility for legacy rows created before encryption-at-rest.
    return Buffer.from(asText, 'base64');
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
  const supabase = getSupabaseAdminClient();
  const uploadId = `upl_${crypto.randomUUID().replace(/-/g, '')}`;
  const { raw: accessToken, hash: accessTokenHash, expiresAt } = createTempAccessToken(uploadId, uid);
  const encryptedPayload = encryptTemporaryPayload(payload);

  const { data, error } = await supabase
    .from(TEMP_UPLOADS_TABLE)
    .insert({
      id: uploadId,
      auth_user_id: uid,
      logical_path: logicalPath,
      file_name: fileName,
      mime_type: mimeType,
      byte_size: payload.length,
      payload_cipher: encryptedPayload,
      access_token_hash: accessTokenHash,
      expires_at: expiresAt.toISOString(),
    })
    .select('id, logical_path, expires_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'No fue posible crear la carga temporal');
  }

  return {
    uploadId: data.id,
    logicalPath: data.logical_path,
    internalUrl: makeInternalTempUrl(data.id, accessToken),
    expiresAt: data.expires_at,
  };
}

export async function resolveTemporaryUploadFromInternalUrl(url, expectedUid = null) {
  const supabase = getSupabaseAdminClient();
  const parsed = parseInternalTempUrl(url);
  if (!parsed) {
    return { upload: null, error: 'URL temporal invalida' };
  }

  const { data: record, error } = await supabase
    .from(TEMP_UPLOADS_TABLE)
    .select(
      'id, auth_user_id, logical_path, file_name, mime_type, byte_size, payload_cipher, access_token_hash, expires_at'
    )
    .eq('id', parsed.uploadId)
    .maybeSingle();

  if (error) {
    return { upload: null, error: 'No se pudo consultar el archivo temporal' };
  }

  if (!record) return { upload: null, error: 'Archivo temporal no encontrado' };
  const expiresAt = new Date(record.expires_at);
  if (expiresAt.getTime() < Date.now()) {
    return { upload: null, error: 'Archivo temporal expirado' };
  }
  if (expectedUid && record.auth_user_id !== expectedUid) {
    return { upload: null, error: 'No autorizado para usar este archivo temporal' };
  }

  const validation = parseAndVerifyTempAccessToken(parsed.token, record.id, record.auth_user_id);
  if (!validation.valid) {
    return { upload: null, error: 'Token temporal invalido' };
  }

  if (sha256(parsed.token) !== record.access_token_hash) {
    return { upload: null, error: 'Token temporal no coincide' };
  }

  let decryptedPayload;
  try {
    decryptedPayload = decryptTemporaryPayload(record.payload_cipher);
  } catch (error) {
    return { upload: null, error: 'No se pudo leer el archivo temporal' };
  }

  return {
    upload: {
      id: record.id,
      userId: record.auth_user_id,
      logicalPath: record.logical_path,
      fileName: record.file_name,
      mimeType: record.mime_type,
      byteSize: record.byte_size,
      accessTokenHash: record.access_token_hash,
      expiresAt,
      payload: decryptedPayload,
    },
    error: null,
  };
}

export async function deleteTemporaryUpload({ uploadId, uid }) {
  if (!uploadId || !uid) return { success: false, error: 'Parametros invalidos' };

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TEMP_UPLOADS_TABLE)
    .delete()
    .eq('id', uploadId)
    .eq('auth_user_id', uid)
    .select('id');

  if (error) {
    return { success: false, error: 'No se pudo eliminar el archivo temporal' };
  }

  return Array.isArray(data) && data.length > 0
    ? { success: true, error: null }
    : { success: false, error: 'Archivo temporal no encontrado' };
}

export async function cleanupExpiredData() {
  const supabase = getSupabaseAdminClient();
  await supabase.from(TEMP_UPLOADS_TABLE).delete().lt('expires_at', new Date().toISOString());
}

export function initializeAuthAdmin() {
  return null;
}
