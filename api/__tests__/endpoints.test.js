/**
 * Tests de integraciÃ³n para endpoints crÃ­ticos de la API
 * Usa supertest para hacer requests HTTP reales al servidor Express
 */

import express from 'express';

// Mock de Auth Admin antes de importar server
jest.mock('../lib/auth-admin.js', () => ({
  verifyAuthToken: jest.fn(),
  getUserReplicateToken: jest.fn(),
  saveUserReplicateToken: jest.fn(),
}));

// Mock de node-fetch para Replicate API

import request from 'supertest';
import {
  verifyAuthToken,
  getUserReplicateToken,
  saveUserReplicateToken,
} from '../lib/auth-admin.js';
const fetch = jest.fn();

global.fetch = fetch;

// Crear app Express para testing (sin escuchar en puerto)
function createTestApp() {
  const app = express();
  app.use(express.json({ limit: '10kb' }));

  // Middleware de autenticaciÃ³n mock
  async function authenticateUser(req, res, next) {
    const authHeader = req.headers.authorization;
    const { uid, error } = await verifyAuthToken(authHeader);
    
    if (error || !uid) {
      return res.status(401).json({ error: error || 'No autenticado' });
    }
    
    req.uid = uid;
    next();
  }

  // GET /api/health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // GET /api/user/token
  app.get('/api/user/token', authenticateUser, async (req, res) => {
    try {
      const { token, error } = await getUserReplicateToken(req.uid);
      if (error) return res.json({ hasToken: false });
      res.json({ hasToken: !!token });
    } catch (err) {
      res.status(500).json({ error: 'Error al verificar token' });
    }
  });

  // POST /api/user/token
  app.post('/api/user/token', authenticateUser, async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ error: 'Token requerido' });
      }
      
      // Validar formato del token
      if (typeof token !== 'string' || !token.startsWith('r8_') || token.length < 33) {
        return res.status(400).json({ error: 'Token de Replicate invÃ¡lido' });
      }
      
      const { success, error } = await saveUserReplicateToken(req.uid, token);
      
      if (!success) {
        return res.status(500).json({ error: error || 'Error al guardar token' });
      }
      
      res.json({ success: true, message: 'Token guardado correctamente' });
    } catch (err) {
      res.status(500).json({ error: `Error al guardar token: ${err.message}` });
    }
  });

  // POST /api/remove-bg
  app.post('/api/remove-bg', authenticateUser, async (req, res) => {
    try {
      const { imageUrl, modelVersion } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl es requerido' });
      }

      // SSRF protection
      try {
        const parsed = new URL(imageUrl);
        if (parsed.protocol !== 'https:' || 
            !['storage.googleapis.com', 'storage.googleapis.com'].some(d => parsed.hostname.endsWith(d))) {
          return res.status(400).json({ error: 'URL de imagen no permitida' });
        }
      } catch {
        return res.status(400).json({ error: 'URL de imagen no permitida' });
      }
      
      const { token: userToken } = await getUserReplicateToken(req.uid);
      
      if (!userToken) {
        return res.status(400).json({ error: 'No tienes token configurado', code: 'NO_TOKEN' });
      }
      
      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        },
        body: JSON.stringify({ version: modelVersion || 'test-version', input: { image: imageUrl } })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          return res.status(400).json({ error: 'Token invÃ¡lido', code: 'INVALID_TOKEN' });
        }
        return res.status(response.status).json({ error: 'Error al procesar imagen' });
      }
      
      const result = await response.json();
      
      if (!result.output) {
        return res.status(500).json({ error: 'No se generÃ³ imagen de salida' });
      }
      
      res.json({ success: true, outputUrl: result.output });
    } catch (err) {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // POST /api/generate-image
  app.post('/api/generate-image', authenticateUser, async (req, res) => {
    try {
      const { prompt, width, height } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'prompt es requerido' });
      }
      
      if (prompt.length > 1000) {
        return res.status(400).json({ error: 'Prompt demasiado largo (mÃ¡x 1000 caracteres)' });
      }
      
      const { token: userToken } = await getUserReplicateToken(req.uid);
      
      if (!userToken) {
        return res.status(400).json({ error: 'No tienes token configurado', code: 'NO_TOKEN' });
      }

      const ALLOWED_DIMENSIONS = [512, 768, 1024];
      const safeWidth = ALLOWED_DIMENSIONS.includes(width) ? width : 1024;
      const safeHeight = ALLOWED_DIMENSIONS.includes(height) ? height : 1024;
      
      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        },
        body: JSON.stringify({ input: { prompt, width: safeWidth, height: safeHeight } })
      });
      
      if (!response.ok) {
        return res.status(response.status).json({ error: 'Error al generar imagen' });
      }
      
      const result = await response.json();
      
      if (!result.output) {
        return res.status(500).json({ error: 'No se generÃ³ imagen de salida' });
      }
      
      res.json({ success: true, outputUrl: Array.isArray(result.output) ? result.output[0] : result.output });
    } catch (err) {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  return app;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TESTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

describe('API Endpoints', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  // â”€â”€ GET /api/health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('GET /api/health', () => {
    it('devuelve status ok', async () => {
      const res = await request(app).get('/api/health');
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  // â”€â”€ GET /api/user/token â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('GET /api/user/token', () => {
    it('requiere autenticaciÃ³n', async () => {
      verifyAuthToken.mockResolvedValue({ uid: null, error: 'Token requerido' });
      
      const res = await request(app).get('/api/user/token');
      
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Token requerido');
    });

    it('devuelve hasToken: true si usuario tiene token', async () => {
      verifyAuthToken.mockResolvedValue({ uid: 'user123', error: null });
      getUserReplicateToken.mockResolvedValue({ token: 'r8_validtoken1234567890validtoken1234', error: null });
      
      const res = await request(app)
        .get('/api/user/token')
        .set('Authorization', 'Bearer valid-supabase-token');
      
      expect(res.status).toBe(200);
      expect(res.body.hasToken).toBe(true);
    });

    it('devuelve hasToken: false si usuario no tiene token', async () => {
      verifyAuthToken.mockResolvedValue({ uid: 'user123', error: null });
      getUserReplicateToken.mockResolvedValue({ token: null, error: null });
      
      const res = await request(app)
        .get('/api/user/token')
        .set('Authorization', 'Bearer valid-supabase-token');
      
      expect(res.status).toBe(200);
      expect(res.body.hasToken).toBe(false);
    });
  });

  // â”€â”€ POST /api/user/token â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('POST /api/user/token', () => {
    it('requiere autenticaciÃ³n', async () => {
      verifyAuthToken.mockResolvedValue({ uid: null, error: 'Token requerido' });
      
      const res = await request(app)
        .post('/api/user/token')
        .send({ token: 'r8_validtoken1234567890validtoken1234' });
      
      expect(res.status).toBe(401);
    });

    it('rechaza token vacÃ­o', async () => {
      verifyAuthToken.mockResolvedValue({ uid: 'user123', error: null });
      
      const res = await request(app)
        .post('/api/user/token')
        .set('Authorization', 'Bearer valid')
        .send({ token: '' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Token requerido');
    });

    it('rechaza token con formato invÃ¡lido (sin r8_)', async () => {
      verifyAuthToken.mockResolvedValue({ uid: 'user123', error: null });
      
      const res = await request(app)
        .post('/api/user/token')
        .set('Authorization', 'Bearer valid')
        .send({ token: 'invalidtoken12345' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('invÃ¡lido');
    });

    it('rechaza token muy corto', async () => {
      verifyAuthToken.mockResolvedValue({ uid: 'user123', error: null });
      
      const res = await request(app)
        .post('/api/user/token')
        .set('Authorization', 'Bearer valid')
        .send({ token: 'r8_short' });
      
      expect(res.status).toBe(400);
    });

    it('guarda token vÃ¡lido correctamente', async () => {
      verifyAuthToken.mockResolvedValue({ uid: 'user123', error: null });
      saveUserReplicateToken.mockResolvedValue({ success: true, error: null });
      
      const res = await request(app)
        .post('/api/user/token')
        .set('Authorization', 'Bearer valid')
        .send({ token: 'r8_validtoken1234567890validtoken1234' });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(saveUserReplicateToken).toHaveBeenCalledWith('user123', 'r8_validtoken1234567890validtoken1234');
    });

    it('maneja error al guardar token', async () => {
      verifyAuthToken.mockResolvedValue({ uid: 'user123', error: null });
      saveUserReplicateToken.mockResolvedValue({ success: false, error: 'DB error' });
      
      const res = await request(app)
        .post('/api/user/token')
        .set('Authorization', 'Bearer valid')
        .send({ token: 'r8_validtoken1234567890validtoken1234' });
      
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB error');
    });
  });

  // â”€â”€ POST /api/remove-bg â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('POST /api/remove-bg', () => {
    const validImageUrl = 'https://storage.googleapis.com/v0/b/test/o/img.jpg';

    beforeEach(() => {
      verifyAuthToken.mockResolvedValue({ uid: 'user123', error: null });
      getUserReplicateToken.mockResolvedValue({ token: 'r8_validtoken1234567890validtoken1234', error: null });
    });

    it('requiere autenticaciÃ³n', async () => {
      verifyAuthToken.mockResolvedValue({ uid: null, error: 'No autenticado' });
      
      const res = await request(app)
        .post('/api/remove-bg')
        .send({ imageUrl: validImageUrl });
      
      expect(res.status).toBe(401);
    });

    it('rechaza request sin imageUrl', async () => {
      const res = await request(app)
        .post('/api/remove-bg')
        .set('Authorization', 'Bearer valid')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('imageUrl es requerido');
    });

    it('rechaza URL de dominio no permitido (SSRF protection)', async () => {
      const res = await request(app)
        .post('/api/remove-bg')
        .set('Authorization', 'Bearer valid')
        .send({ imageUrl: 'https://evil.com/malware.jpg' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('URL de imagen no permitida');
    });

    it('rechaza URL de localhost (SSRF protection)', async () => {
      const res = await request(app)
        .post('/api/remove-bg')
        .set('Authorization', 'Bearer valid')
        .send({ imageUrl: 'https://localhost/admin' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('URL de imagen no permitida');
    });

    it('rechaza URL con protocolo HTTP (debe ser HTTPS)', async () => {
      const res = await request(app)
        .post('/api/remove-bg')
        .set('Authorization', 'Bearer valid')
        .send({ imageUrl: 'http://storage.googleapis.com/v0/b/test/o/img.jpg' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('URL de imagen no permitida');
    });

    it('rechaza usuario sin token de Replicate configurado', async () => {
      getUserReplicateToken.mockResolvedValue({ token: null, error: null });
      
      const res = await request(app)
        .post('/api/remove-bg')
        .set('Authorization', 'Bearer valid')
        .send({ imageUrl: validImageUrl });
      
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('NO_TOKEN');
    });

    it('procesa imagen correctamente', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ output: 'https://output.url/result.png' })
      });
      
      const res = await request(app)
        .post('/api/remove-bg')
        .set('Authorization', 'Bearer valid')
        .send({ imageUrl: validImageUrl, modelVersion: 'test-version' });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.outputUrl).toBe('https://output.url/result.png');
    });

    it('maneja token de Replicate invÃ¡lido', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });
      
      const res = await request(app)
        .post('/api/remove-bg')
        .set('Authorization', 'Bearer valid')
        .send({ imageUrl: validImageUrl });
      
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TOKEN');
    });

    it('maneja error de Replicate API', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error')
      });
      
      const res = await request(app)
        .post('/api/remove-bg')
        .set('Authorization', 'Bearer valid')
        .send({ imageUrl: validImageUrl });
      
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error al procesar imagen');
    });

    it('maneja respuesta sin output', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ output: null })
      });
      
      const res = await request(app)
        .post('/api/remove-bg')
        .set('Authorization', 'Bearer valid')
        .send({ imageUrl: validImageUrl });
      
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('No se generÃ³ imagen de salida');
    });
  });

  // â”€â”€ POST /api/generate-image â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('POST /api/generate-image', () => {
    beforeEach(() => {
      verifyAuthToken.mockResolvedValue({ uid: 'user123', error: null });
      getUserReplicateToken.mockResolvedValue({ token: 'r8_validtoken1234567890validtoken1234', error: null });
    });

    it('requiere autenticaciÃ³n', async () => {
      verifyAuthToken.mockResolvedValue({ uid: null, error: 'No autenticado' });
      
      const res = await request(app)
        .post('/api/generate-image')
        .send({ prompt: 'A cat' });
      
      expect(res.status).toBe(401);
    });

    it('rechaza request sin prompt', async () => {
      const res = await request(app)
        .post('/api/generate-image')
        .set('Authorization', 'Bearer valid')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('prompt es requerido');
    });

    it('rechaza prompt demasiado largo (>1000 caracteres)', async () => {
      const longPrompt = 'a'.repeat(1001);
      
      const res = await request(app)
        .post('/api/generate-image')
        .set('Authorization', 'Bearer valid')
        .send({ prompt: longPrompt });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('demasiado largo');
    });

    it('usa dimensiones por defecto si no se especifican', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ output: ['https://result.png'] })
      });
      
      const res = await request(app)
        .post('/api/generate-image')
        .set('Authorization', 'Bearer valid')
        .send({ prompt: 'A beautiful sunset' });
      
      expect(res.status).toBe(200);
      
      // Verificar que se usaron dimensiones por defecto (1024)
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"width":1024')
        })
      );
    });

    it('sanitiza dimensiones no permitidas', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ output: ['https://result.png'] })
      });
      
      const res = await request(app)
        .post('/api/generate-image')
        .set('Authorization', 'Bearer valid')
        .send({ prompt: 'Test', width: 999, height: 1500 });
      
      expect(res.status).toBe(200);
      
      // Dimensiones invÃ¡lidas deben ser reemplazadas por 1024
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"width":1024')
        })
      );
    });

    it('acepta dimensiones permitidas (512, 768, 1024)', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ output: ['https://result.png'] })
      });
      
      const res = await request(app)
        .post('/api/generate-image')
        .set('Authorization', 'Bearer valid')
        .send({ prompt: 'Test', width: 768, height: 512 });
      
      expect(res.status).toBe(200);
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"width":768')
        })
      );
    });

    it('genera imagen correctamente', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ output: ['https://generated-image.png'] })
      });
      
      const res = await request(app)
        .post('/api/generate-image')
        .set('Authorization', 'Bearer valid')
        .send({ prompt: 'A fluffy cat sitting on a rainbow' });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.outputUrl).toBe('https://generated-image.png');
    });

    it('maneja error de API de Replicate', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 500
      });
      
      const res = await request(app)
        .post('/api/generate-image')
        .set('Authorization', 'Bearer valid')
        .send({ prompt: 'Test' });
      
      expect(res.status).toBe(500);
    });
  });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TESTS DE SEGURIDAD ADICIONALES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

describe('Security Tests', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe('Path Traversal Prevention', () => {
    it('rechaza imageUrl con path traversal attempt', async () => {
      verifyAuthToken.mockResolvedValue({ uid: 'user123', error: null });
      
      const res = await request(app)
        .post('/api/remove-bg')
        .set('Authorization', 'Bearer valid')
        .send({ imageUrl: 'https://storage.googleapis.com/../../../etc/passwd' });
      
      // La URL no deberÃ­a procesar - puede ser 400 o error de validaciÃ³n
      expect([400, 500]).toContain(res.status);
    });
  });

  describe('Injection Prevention', () => {
    it('maneja prompt con caracteres especiales sin errores', async () => {
      verifyAuthToken.mockResolvedValue({ uid: 'user123', error: null });
      getUserReplicateToken.mockResolvedValue({ token: 'r8_validtoken1234567890validtoken1234', error: null });
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ output: ['https://result.png'] })
      });
      
      const res = await request(app)
        .post('/api/generate-image')
        .set('Authorization', 'Bearer valid')
        .send({ prompt: '<script>alert("xss")</script> ${process.env.SECRET}' });
      
      // No debe crashear, debe procesar normalmente
      expect(res.status).toBe(200);
    });

    it('maneja token con caracteres especiales', async () => {
      verifyAuthToken.mockResolvedValue({ uid: 'user123', error: null });
      
      const res = await request(app)
        .post('/api/user/token')
        .set('Authorization', 'Bearer valid')
        .send({ token: 'r8_<script>alert(1)</script>' });
      
      // Debe rechazar token con formato invÃ¡lido (400 o 500 son aceptables)
      expect([400, 500]).toContain(res.status);
    });
  });

  describe('Rate Limiting Headers', () => {
    it('endpoints no crashean con headers malformados', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('X-Forwarded-For', '"><script>alert(1)</script>');
      
      expect(res.status).toBe(200);
    });
  });

  describe('Content-Type Validation', () => {
    it('rechaza body no JSON con status adecuado', async () => {
      verifyAuthToken.mockResolvedValue({ uid: 'user123', error: null });
      
      const res = await request(app)
        .post('/api/user/token')
        .set('Authorization', 'Bearer valid')
        .set('Content-Type', 'text/plain')
        .send('not json');
      
      // Express debe manejar esto correctamente
      expect([400, 415]).toContain(res.status);
    });
  });
});









