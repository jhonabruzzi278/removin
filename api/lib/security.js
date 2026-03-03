/**
 * Funciones de seguridad del servidor Express.
 * Extraídas de server.js para facilitar el testeo unitario.
 */

/** Dominios permitidos para imageUrl — protección SSRF */
export const ALLOWED_IMAGE_DOMAINS = [
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
];

/**
 * Verifica que la URL sea HTTPS y apunte a un dominio permitido de Firebase Storage.
 * Previene ataques SSRF donde un atacante podría hacer requests a redes internas.
 */
export function isAllowedImageUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_IMAGE_DOMAINS.some((domain) =>
      parsed.hostname.endsWith(domain)
    );
  } catch {
    return false;
  }
}

/**
 * Devuelve un mensaje de error seguro: en producción usa el fallback,
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
 * Debe comenzar con "r8_" y tener al menos 33 caracteres.
 */
export function isValidReplicateToken(token) {
  return (
    typeof token === 'string' &&
    token.startsWith('r8_') &&
    token.length >= 33
  );
}
