/**
 * Tests de las funciones de seguridad del backend.
 * No requieren red.
 */

import {
  isAllowedImageUrl,
  safeErrorMessage,
  isValidReplicateToken,
  ALLOWED_IMAGE_DOMAINS,
} from '../lib/security.js';

describe('isAllowedImageUrl() — proteccion SSRF', () => {
  it('acepta URL de firebasestorage.googleapis.com', () => {
    expect(
      isAllowedImageUrl(
        'https://firebasestorage.googleapis.com/v0/b/proyecto/o/img.jpg?alt=media'
      )
    ).toBe(true);
  });

  it('acepta URL de storage.googleapis.com', () => {
    expect(isAllowedImageUrl('https://storage.googleapis.com/bucket/imagen.png')).toBe(true);
  });

  it('acepta URL interna removin-temp:// con token', () => {
    expect(isAllowedImageUrl('removin-temp://upl_test?token=abc')).toBe(true);
  });

  it('rechaza URL con protocolo http (no seguro)', () => {
    expect(
      isAllowedImageUrl('http://firebasestorage.googleapis.com/v0/b/test/o/img.jpg')
    ).toBe(false);
  });

  it('rechaza URL de dominio arbitrario externo', () => {
    expect(isAllowedImageUrl('https://evil.com/imagen.jpg')).toBe(false);
  });

  it('rechaza intento de SSRF a red interna (localhost)', () => {
    expect(isAllowedImageUrl('https://localhost/internal-endpoint')).toBe(false);
  });

  it('rechaza intento de SSRF a 169.254.x.x (metadata de nube)', () => {
    expect(isAllowedImageUrl('https://169.254.169.254/latest/meta-data/')).toBe(false);
  });

  it('rechaza subdomain spoofing: evil.com/firebasestorage.googleapis.com', () => {
    expect(isAllowedImageUrl('https://evil.com/firebasestorage.googleapis.com/img.jpg')).toBe(false);
  });

  it('rechaza URL malformada', () => {
    expect(isAllowedImageUrl('not-a-url')).toBe(false);
    expect(isAllowedImageUrl('')).toBe(false);
    expect(isAllowedImageUrl('javascript:alert(1)')).toBe(false);
  });

  it('rechaza protocol ftp://', () => {
    expect(isAllowedImageUrl('ftp://firebasestorage.googleapis.com/file.jpg')).toBe(false);
  });

  it('ALLOWED_IMAGE_DOMAINS contiene los dominios esperados', () => {
    expect(ALLOWED_IMAGE_DOMAINS).toContain('firebasestorage.googleapis.com');
    expect(ALLOWED_IMAGE_DOMAINS).toContain('storage.googleapis.com');
  });
});

describe('safeErrorMessage() — sin filtracion de errores en produccion', () => {
  it('devuelve el mensaje del error en desarrollo', () => {
    const err = new Error('Detalle interno del DB');
    expect(safeErrorMessage(err, 'Error generico', false)).toBe('Detalle interno del DB');
  });

  it('devuelve el fallback en produccion (oculta mensaje real)', () => {
    const err = new Error('Detalle interno del DB');
    expect(safeErrorMessage(err, 'Error interno del servidor', true)).toBe('Error interno del servidor');
  });

  it('usa el fallback por defecto si no se proporciona', () => {
    const err = new Error('algo');
    expect(safeErrorMessage(err, undefined, true)).toBe('Error interno del servidor');
  });

  it('maneja error nulo sin lanzar excepcion', () => {
    expect(() => safeErrorMessage(null, 'Fallback', false)).not.toThrow();
    expect(safeErrorMessage(null, 'Fallback', false)).toBe('Fallback');
  });

  it('maneja error sin message', () => {
    const nonError = { code: 42 };
    expect(safeErrorMessage(nonError, 'Fallback', false)).toBe('Fallback');
  });
});

describe('isValidReplicateToken() — validacion de formato de token', () => {
  const VALID_TOKEN = 'r8_' + 'x'.repeat(30);

  it('acepta un token valido (prefijo r8_ y >= 33 chars)', () => {
    expect(isValidReplicateToken(VALID_TOKEN)).toBe(true);
  });

  it('acepta token con mas de 33 caracteres', () => {
    expect(isValidReplicateToken('r8_' + 'x'.repeat(50))).toBe(true);
  });

  it('rechaza token sin prefijo r8_', () => {
    expect(isValidReplicateToken('sk_' + 'a'.repeat(30))).toBe(false);
  });

  it('rechaza token demasiado corto (menos de 33 chars)', () => {
    expect(isValidReplicateToken('r8_short')).toBe(false);
  });

  it('rechaza token con espacios', () => {
    expect(isValidReplicateToken('r8_abc123def456 ')).toBe(false);
    expect(isValidReplicateToken(' r8_abc123def456')).toBe(false);
  });

  it('rechaza token vacio', () => {
    expect(isValidReplicateToken('')).toBe(false);
  });

  it('rechaza null y undefined', () => {
    expect(isValidReplicateToken(null)).toBe(false);
    expect(isValidReplicateToken(undefined)).toBe(false);
  });

  it('rechaza tipo no-string', () => {
    expect(isValidReplicateToken(12345)).toBe(false);
    expect(isValidReplicateToken({ token: VALID_TOKEN })).toBe(false);
  });
});
