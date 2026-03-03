import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { 
  verifyAuthToken, 
  getUserReplicateToken, 
  saveUserReplicateToken 
} from './lib/firebase-admin.js';
import { isAllowedImageUrl, safeErrorMessage, isValidReplicateToken } from './lib/security.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ============================================
// Security Headers (Helmet)
// ============================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate Limiter para rutas de procesamiento: máximo 5 peticiones por minuto
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { 
    error: 'Demasiadas peticiones. Espera unos segundos.',
    retryAfter: 60 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate Limiter para rutas de autenticación/token: máximo 20 peticiones por minuto
const tokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Demasiadas peticiones al endpoint de token.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS - lista blanca estricta según entorno
const allowedOrigins = IS_PRODUCTION
  ? [process.env.FRONTEND_URL || 'https://removin.vercel.app']
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (ej. Postman en dev) solo en desarrollo
    if (!origin && !IS_PRODUCTION) return callback(null, true);
    if (origin && allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS: origen no permitido'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));

// ============================================
// Middleware: Audit Logging
// ============================================
function auditLog(req, res, next) {
  res.on('finish', () => {
    const uid = req.uid ? req.uid.slice(0, 8) + '…' : 'anon';
    console.info(JSON.stringify({
      event: 'api_request',
      uid,
      method: req.method,
      endpoint: req.path,
      status: res.statusCode,
      ts: new Date().toISOString()
    }));
  });
  next();
}
app.use(auditLog);

// Configuración de modelos de Replicate
const REPLICATE_MODELS = {
  'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003': {
    name: 'cjwbw/rembg',
    inputKey: 'image'
  },
  '95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1': {
    name: 'lucataco/remove-bg',
    inputKey: 'image'
  },
  '4067ee2a58f6c161d434a9c077cfa012820b8e076efa2772aa171e26557da919': {
    name: 'smoretalk/rembg-enhance',
    inputKey: 'image'
  }
};

// ============================================
// Middleware: Autenticación con Firebase
// ============================================
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  
  const { uid, error } = await verifyAuthToken(authHeader);
  
  if (error || !uid) {
    return res.status(401).json({ error: error || 'No autenticado' });
  }
  
  req.uid = uid;
  next();
}

// ============================================
// GET /api/health
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// GET /api/user/token - Verificar si el usuario tiene token
// ============================================
app.get('/api/user/token', tokenLimiter, authenticateUser, async (req, res) => {
  try {
    const { token, error } = await getUserReplicateToken(req.uid);
    if (error) return res.json({ hasToken: false });
    res.json({ hasToken: !!token });
  } catch (err) {
    console.error('Error fetching token:', err);
    res.status(500).json({ error: 'Error al verificar token' });
  }
})

// ============================================
// POST /api/user/token - Guardar token del usuario
// ============================================
app.post('/api/user/token', tokenLimiter, authenticateUser, async (req, res) => {
  try {
    const { token } = req.body;
    
    // Validar formato del token con helper de seguridad
    if (!isValidReplicateToken(token)) {
      return res.status(400).json({ error: 'Token de Replicate inválido. Debe empezar con r8_ y tener al menos 33 caracteres.' });
    }
    
    const { success, error } = await saveUserReplicateToken(req.uid, token);
    
    if (!success) {
      return res.status(500).json({ error: 'Error al guardar token' });
    }
    
    res.json({ success: true, message: 'Token guardado correctamente' });
  } catch (err) {
    console.error('Error en POST /api/user/token:', err);
    res.status(500).json({ error: 'Error al guardar token' });
  }
});

// ============================================
// POST /api/remove-bg - Remover fondo (usa token del usuario)
// ============================================
app.post('/api/remove-bg', apiLimiter, authenticateUser, async (req, res) => {
  try {
    const { imageUrl, modelVersion } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl es requerido' });
    }

    // SSRF protection: solo se permiten URLs de Firebase Storage
    if (!isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'URL de imagen no permitida' });
    }
    
    // Obtener token de Replicate del USUARIO
    const { token: userToken } = await getUserReplicateToken(req.uid);
    
    if (!userToken) {
      return res.status(400).json({ 
        error: 'No tienes un token de Replicate configurado. Ve a Ajustes para agregarlo.',
        code: 'NO_TOKEN'
      });
    }
    
    const version = modelVersion || 'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003';
    const modelConfig = REPLICATE_MODELS[version];
    
    if (!modelConfig) {
      return res.status(400).json({ error: 'Modelo no soportado' });
    }
    
    console.log(`🎨 [${req.uid.slice(0,8)}] Procesando con ${modelConfig.name}`);
    
    const input = {
      [modelConfig.inputKey]: imageUrl,
      ...(modelConfig.extraParams || {})
    };
    
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({ version, input })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Replicate error:', response.status);
      
      if (response.status === 401 || response.status === 403) {
        return res.status(400).json({ 
          error: 'Tu token de Replicate es inválido o expiró. Actualízalo en Ajustes.',
          code: 'INVALID_TOKEN'
        });
      }
      
      return res.status(response.status).json({ error: 'Error al procesar imagen' });
    }
    
    const result = await response.json();
    
    if (!result.output) {
      return res.status(500).json({ error: 'No se generó imagen de salida' });
    }
    
    console.log(`✅ [${req.uid.slice(0,8)}] Imagen procesada`);
    res.json({ success: true, outputUrl: result.output });
    
  } catch (err) {
    console.error('Error en remove-bg:', err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// ============================================
// POST /api/generate-image - Generar imagen (usa token del usuario)
// ============================================
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
      seed
    } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'prompt es requerido' });
    }
    
    if (prompt.length > 1000) {
      return res.status(400).json({ error: 'Prompt demasiado largo (máx 1000 caracteres)' });
    }
    
    // Obtener token de Replicate del USUARIO
    const { token: userToken } = await getUserReplicateToken(req.uid);
    
    if (!userToken) {
      return res.status(400).json({ 
        error: 'No tienes un token de Replicate configurado. Ve a Ajustes para agregarlo.',
        code: 'NO_TOKEN'
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
    
    console.log(`🎨 [${req.uid.slice(0,8)}] Generando ${input.width}x${input.height}`);
    
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        version: '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
        input
      })
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return res.status(400).json({ 
          error: 'Tu token de Replicate es inválido o expiró. Actualízalo en Ajustes.',
          code: 'INVALID_TOKEN'
        });
      }
      return res.status(response.status).json({ error: 'Error al generar imagen' });
    }
    
    const result = await response.json();
    
    if (!result.output || !result.output[0]) {
      return res.status(500).json({ error: 'No se generó imagen de salida' });
    }
    
    console.log(`✅ [${req.uid.slice(0,8)}] Imagen generada`);
    res.json({ success: true, outputUrl: result.output[0] });
    
  } catch (err) {
    console.error('Error en generate-image:', err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// ============================================
// Iniciar servidor (solo en desarrollo local)
// ============================================
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n🚀 API corriendo en http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health\n`);
  });
}

// Export para Vercel Serverless
export default app;
