import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import {
  verifyAuthToken,
  getUserReplicateToken,
  saveUserReplicateToken,
  createTemporaryUpload,
  deleteTemporaryUpload,
  resolveTemporaryUploadFromInternalUrl,
  parseInternalTempUrl,
  cleanupExpiredData,
} from './lib/auth-admin.js';
import { isAllowedImageUrl, safeErrorMessage, isValidReplicateToken } from './lib/security.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_BASE64_BODY_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

app.set('trust proxy', 1);

const SENTRY_DSN = process.env.SENTRY_DSN;

if (IS_PRODUCTION && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    ignoreErrors: ['ECONNRESET', 'ETIMEDOUT'],
  });
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    error: 'Demasiadas peticiones. Espera unos segundos.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const tokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Demasiadas peticiones al endpoint de token.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Demasiadas cargas de archivos. Intenta nuevamente en breve.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const productionOrigins = [
  'https://removin.vercel.app',
  process.env.FRONTEND_URL,
  process.env.APP_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null,
].filter(Boolean);

const developmentOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  process.env.FRONTEND_URL,
  process.env.APP_URL,
].filter(Boolean);

const allowedOrigins = Array.from(new Set(IS_PRODUCTION ? productionOrigins : developmentOrigins));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: false,
  })
);

app.use(express.json({ limit: `${Math.ceil(MAX_BASE64_BODY_BYTES / (1024 * 1024))}mb` }));

function auditLog(req, res, next) {
  res.on('finish', () => {
    const uid = req.uid ? `${req.uid.slice(0, 8)}...` : 'anon';
    console.info(
      JSON.stringify({
        event: 'api_request',
        uid,
        method: req.method,
        endpoint: req.path,
        status: res.statusCode,
        ts: new Date().toISOString(),
      })
    );
  });
  next();
}
app.use(auditLog);

const REPLICATE_MODELS = {
  fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003: {
    name: 'cjwbw/rembg',
    inputKey: 'image',
  },
  '95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1': {
    name: 'lucataco/remove-bg',
    inputKey: 'image',
  },
  '4067ee2a58f6c161d434a9c077cfa012820b8e076efa2772aa171e26557da919': {
    name: 'smoretalk/rembg-enhance',
    inputKey: 'image',
  },
};

async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  const { uid, user, error } = await verifyAuthToken(authHeader);

  if (error || !uid) {
    return res.status(401).json({ error: error || 'No autenticado' });
  }

  req.uid = uid;
  req.authUser = user;
  next();
}

let lastCleanupMs = 0;
function maybeCleanupExpiredData() {
  const now = Date.now();
  if (now - lastCleanupMs < 10 * 60 * 1000) return;
  lastCleanupMs = now;
  cleanupExpiredData().catch((error) => {
    console.warn('cleanupExpiredData error:', error.message);
  });
}
app.use((req, res, next) => {
  maybeCleanupExpiredData();
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/auth/me', authenticateUser, async (req, res) => {
  return res.json({ success: true, user: req.authUser });
});

app.get('/api/user/token', tokenLimiter, authenticateUser, async (req, res) => {
  try {
    const { token, error } = await getUserReplicateToken(req.uid);
    if (error) return res.json({ hasToken: false, isCustom: true });
    return res.json({ hasToken: !!token, isCustom: true });
  } catch (error) {
    console.error('Error fetching token:', error);
    return res.status(500).json({ error: 'Error al verificar token' });
  }
});

app.post('/api/user/token', tokenLimiter, authenticateUser, async (req, res) => {
  try {
    const { token } = req.body || {};

    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }

    if (!isValidReplicateToken(token)) {
      return res.status(400).json({
        error: 'Token de Replicate invalido. Debe empezar con r8_ y tener al menos 33 caracteres.',
      });
    }

    const { success, error } = await saveUserReplicateToken(req.uid, token);

    if (!success) {
      return res.status(500).json({ error: error || 'Error al guardar token' });
    }

    return res.json({ success: true, message: 'Token guardado correctamente' });
  } catch (error) {
    console.error('Error en POST /api/user/token:', error);
    return res.status(500).json({ error: safeErrorMessage(error) });
  }
});

app.post('/api/storage/upload', uploadLimiter, authenticateUser, async (req, res) => {
  try {
    const { path, fileName, mimeType, data } = req.body || {};

    if (!path || typeof path !== 'string' || path.length > 320) {
      return res.status(400).json({ error: 'path invalido' });
    }

    if (!path.startsWith(`${req.uid}/`)) {
      return res.status(403).json({ error: 'Ruta no autorizada para este usuario' });
    }

    if (!fileName || typeof fileName !== 'string' || fileName.length > 150) {
      return res.status(400).json({ error: 'fileName invalido' });
    }

    if (!mimeType || !ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ error: 'Tipo de archivo no permitido' });
    }

    if (!data || typeof data !== 'string' || data.length > MAX_BASE64_BODY_BYTES * 2) {
      return res.status(400).json({ error: 'Payload invalido' });
    }

    const payload = Buffer.from(data, 'base64');
    if (!payload.length || payload.length > MAX_IMAGE_SIZE_BYTES) {
      return res
        .status(400)
        .json({ error: `Archivo invalido o excede ${Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024))}MB` });
    }

    const upload = await createTemporaryUpload({
      uid: req.uid,
      logicalPath: path,
      fileName,
      mimeType,
      payload,
    });

    return res.json({
      success: true,
      uploadId: upload.uploadId,
      path: upload.logicalPath,
      internalUrl: upload.internalUrl,
      expiresAt: upload.expiresAt,
    });
  } catch (error) {
    console.error('Error en POST /api/storage/upload:', error);
    return res.status(500).json({ error: safeErrorMessage(error) });
  }
});

app.delete('/api/storage/upload/:uploadId', uploadLimiter, authenticateUser, async (req, res) => {
  try {
    const { uploadId } = req.params;
    if (!uploadId) {
      return res.status(400).json({ error: 'uploadId requerido' });
    }

    const result = await deleteTemporaryUpload({
      uploadId,
      uid: req.uid,
    });

    if (!result.success) {
      return res.status(404).json({ error: result.error || 'Archivo temporal no encontrado' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error en DELETE /api/storage/upload/:uploadId:', error);
    return res.status(500).json({ error: safeErrorMessage(error) });
  }
});

app.post('/api/remove-bg', apiLimiter, authenticateUser, async (req, res) => {
  const { imageUrl, modelVersion } = req.body || {};
  const parsedInternal = typeof imageUrl === 'string' ? parseInternalTempUrl(imageUrl) : null;

  try {
    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl es requerido' });
    }

    if (!isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'URL de imagen no permitida' });
    }

    const { token: userToken } = await getUserReplicateToken(req.uid);

    if (!userToken) {
      return res.status(400).json({
        error: 'No tienes un token de Replicate configurado. Ve a Ajustes para agregarlo.',
        code: 'NO_TOKEN',
      });
    }

    const version =
      modelVersion || 'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003';
    const modelConfig = REPLICATE_MODELS[version];

    if (!modelConfig) {
      return res.status(400).json({ error: 'Modelo no soportado' });
    }

    let inputImage = imageUrl;
    if (parsedInternal) {
      const { upload, error } = await resolveTemporaryUploadFromInternalUrl(imageUrl, req.uid);
      if (error || !upload) {
        return res.status(400).json({ error: error || 'No se pudo resolver la imagen temporal' });
      }
      inputImage = `data:${upload.mimeType};base64,${Buffer.from(upload.payload).toString('base64')}`;
    }

    const input = {
      [modelConfig.inputKey]: inputImage,
      ...(modelConfig.extraParams || {}),
    };

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({ version, input }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return res.status(400).json({
          error: 'Tu token de Replicate invalido o expiro. Actualizalo en Ajustes.',
          code: 'INVALID_TOKEN',
        });
      }

      return res.status(response.status).json({ error: 'Error al procesar imagen' });
    }

    const result = await response.json();

    if (!result.output) {
      return res.status(500).json({ error: 'No se genero imagen de salida' });
    }

    return res.json({ success: true, outputUrl: result.output });
  } catch (error) {
    console.error('Error en remove-bg:', error);
    return res.status(500).json({ error: safeErrorMessage(error) });
  } finally {
    if (parsedInternal) {
      await deleteTemporaryUpload({ uploadId: parsedInternal.uploadId, uid: req.uid }).catch(() => {});
    }
  }
});

app.post('/api/generate-image', apiLimiter, authenticateUser, async (req, res) => {
  try {
    const {
      prompt,
      negative_prompt,
      width,
      height,
      num_inference_steps,
      guidance_scale,
      scheduler,
      seed,
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt es requerido' });
    }

    if (prompt.length > 1000) {
      return res.status(400).json({ error: 'Prompt demasiado largo (max 1000 caracteres)' });
    }

    const { token: userToken } = await getUserReplicateToken(req.uid);

    if (!userToken) {
      return res.status(400).json({
        error: 'No tienes un token de Replicate configurado. Ve a Ajustes para agregarlo.',
        code: 'NO_TOKEN',
      });
    }

    const ALLOWED_DIMENSIONS = [512, 768, 1024];
    const safeWidth = ALLOWED_DIMENSIONS.includes(width) ? width : 1024;
    const safeHeight = ALLOWED_DIMENSIONS.includes(height) ? height : 1024;

    const input = {
      prompt,
      negative_prompt: negative_prompt || 'ugly, blurry, poor quality',
      num_inference_steps: Math.min(Math.max(num_inference_steps || 30, 10), 50),
      guidance_scale: Math.min(Math.max(guidance_scale || 7.5, 1), 20),
      width: safeWidth,
      height: safeHeight,
    };

    if (scheduler) input.scheduler = scheduler;
    if (seed !== undefined && seed !== null) input.seed = seed;

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        version: '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
        input,
      }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return res.status(400).json({
          error: 'Tu token de Replicate invalido o expiro. Actualizalo en Ajustes.',
          code: 'INVALID_TOKEN',
        });
      }
      return res.status(response.status).json({ error: 'Error al generar imagen' });
    }

    const result = await response.json();

    if (!result.output || !result.output[0]) {
      return res.status(500).json({ error: 'No se genero imagen de salida' });
    }

    return res.json({ success: true, outputUrl: result.output[0] });
  } catch (error) {
    console.error('Error en generate-image:', error);
    return res.status(500).json({ error: safeErrorMessage(error) });
  }
});

app.use((err, req, res, next) => {
  void next;
  if (IS_PRODUCTION && SENTRY_DSN) {
    Sentry.captureException(err, {
      extra: {
        path: req.path,
        method: req.method,
        uid: req.uid?.slice(0, 8),
      },
    });
  }

  res.setHeader('Content-Type', 'application/json');

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  res.status(statusCode).json({
    error: IS_PRODUCTION ? 'Error interno del servidor' : message,
    ...(IS_PRODUCTION ? {} : { stack: err.stack }),
  });
});

app.use((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\nAPI corriendo en http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health\n`);
  });
}

export default app;

