/**
 * Funciones de seguridad del servidor Express.
 * Extraidas de server.js para facilitar el testeo unitario.
 */

/** Dominios HTTPS permitidos para URLs remotas de imagen (proteccion SSRF). */
export const ALLOWED_IMAGE_DOMAINS = [
  'storage.googleapis.com',
];

/**
 * Verifica que la URL sea segura y aceptada.
 * - Acepta esquema interno removin-temp:// con token firmado.
 * - Acepta HTTPS solo en dominios permitidos.
 */
export function isAllowedImageUrl(url) {
  try {
    const parsed = new URL(url);

    if (parsed.protocol === 'removin-temp:') {
      return Boolean(parsed.hostname && parsed.searchParams.get('token'));
    }

    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_IMAGE_DOMAINS.some((domain) => parsed.hostname.endsWith(domain));
  } catch {
    return false;
  }
}

/**
 * Devuelve un mensaje de error seguro: en produccion usa el fallback,
 * en desarrollo expone el mensaje real para facilitar el debug.
 */
export function safeErrorMessage(
  err,
  fallback = 'Error interno del servidor',
  isProduction = process.env.NODE_ENV === 'production'
) {
  if (isProduction) return fallback;
  return err?.message || fallback;
}

/**
 * Valida el formato del token de Replicate.
 * Debe comenzar con "r8_" y tener longitud segura (>= 33 total aprox).
 */
export function isValidReplicateToken(token) {
  return typeof token === 'string' && /^r8_[A-Za-z0-9_-]{30,}$/.test(token);
}
