import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { 
  verifyAuthToken, 
  getUserReplicateToken, 
  saveUserReplicateToken 
} from './lib/firebase-admin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Rate Limiter: máximo 5 peticiones por minuto
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

// CORS
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL || 'https://removin.vercel.app']
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

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
  console.log('🔐 authenticateUser - header presente:', !!authHeader);
  
  const { uid, error } = await verifyAuthToken(authHeader);
  console.log('🔐 Resultado auth:', { uid: uid?.slice(0, 8), error });
  
  if (error || !uid) {
    console.log('❌ Auth failed:', error);
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
// GET /api/debug - Debug de configuración (TEMPORAL)
// ============================================
app.get('/api/debug', async (req, res) => {
  // Intentar inicializar Firebase para ver si hay errores
  let firebaseStatus = 'not initialized';
  let firestoreStatus = 'not tested';
  let writeTestStatus = 'not tested';
  let initError = null;
  
  try {
    const { initializeFirebase } = await import('./lib/firebase-admin.js');
    const firebase = initializeFirebase();
    
    if (firebase) {
      firebaseStatus = 'initialized';
      
      // Intentar acceder a Firestore
      try {
        const db = firebase.firestore();
        firestoreStatus = 'accessible';
        
        // Intentar escribir un documento de prueba
        try {
          const testRef = db.collection('_test').doc('debug');
          await testRef.set({
            test: true,
            timestamp: new Date().toISOString()
          });
          await testRef.delete(); // Limpiar después
          writeTestStatus = 'success';
        } catch (writeError) {
          writeTestStatus = `error: ${writeError.message}`;
        }
      } catch (fsError) {
        firestoreStatus = `error: ${fsError.message}`;
      }
    } else {
      firebaseStatus = 'failed - returned null';
    }
  } catch (err) {
    initError = err.message;
    firebaseStatus = 'init error';
  }
  
  res.json({
    env: {
      hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
      hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      privateKeyLength: process.env.FIREBASE_PRIVATE_KEY?.length || 0,
      privateKeyStart: process.env.FIREBASE_PRIVATE_KEY?.substring(0, 50),
      hasServiceAccountJson: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    },
    firebase: {
      status: firebaseStatus,
      firestoreStatus,
      writeTestStatus,
      initError
    },
    timestamp: new Date().toISOString()
  });
});

// ============================================
// GET /api/user/token - Verificar si el usuario tiene token
// ============================================
app.get('/api/user/token', authenticateUser, async (req, res) => {
  try {
    const { token, error } = await getUserReplicateToken(req.uid);
    
    if (error) {
      return res.json({ hasToken: false });
    }
    
    res.json({ hasToken: !!token });
  } catch (error) {
    console.error('Error fetching token:', error);
    res.status(500).json({ error: 'Error al verificar token' });
  }
});

// ============================================
// POST /api/user/token - Guardar token del usuario
// ============================================
app.post('/api/user/token', authenticateUser, async (req, res) => {
  try {
    console.log('📝 POST /api/user/token - uid:', req.uid?.slice(0, 8));
    
    const { token } = req.body;
    console.log('📝 Token recibido:', token ? `${token.slice(0, 10)}...` : 'null');
    
    // Validar formato del token
    if (!token || !token.startsWith('r8_') || token.length < 33) {
      console.log('❌ Token inválido');
      return res.status(400).json({ error: 'Token de Replicate inválido. Debe empezar con r8_ y tener al menos 33 caracteres.' });
    }
    
    console.log('📝 Llamando a saveUserReplicateToken...');
    const { success, error } = await saveUserReplicateToken(req.uid, token);
    console.log('📝 Resultado:', { success, error });
    
    if (!success) {
      console.log('❌ Error guardando token:', error);
      return res.status(500).json({ error: error || 'Error al guardar token', details: error });
    }
    
    console.log('✅ Token guardado exitosamente');
    res.json({ success: true, message: 'Token guardado correctamente' });
  } catch (error) {
    console.error('❌ Error en POST /api/user/token:', error);
    res.status(500).json({ error: 'Error al guardar token', details: error.message });
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
    
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'URL de imagen inválida' });
    }
    
    // Obtener token de Replicate del USUARIO
    const { token: userToken, error: tokenError } = await getUserReplicateToken(req.uid);
    
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
    
  } catch (error) {
    console.error('Error en remove-bg:', error);
    res.status(500).json({ error: error.message });
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
    
    const input = {
      prompt,
      negative_prompt: negative_prompt || 'ugly, blurry, poor quality',
      num_inference_steps: Math.min(Math.max(num_inference_steps || 30, 10), 50),
      guidance_scale: Math.min(Math.max(guidance_scale || 7.5, 1), 20),
      width: width || 1024,
      height: height || 1024,
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
    
  } catch (error) {
    console.error('Error en generate-image:', error);
    res.status(500).json({ error: error.message });
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
