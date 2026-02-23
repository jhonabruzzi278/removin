import admin from 'firebase-admin';

// Inicializar Firebase Admin SDK
// En producción, usa las variables de entorno de Vercel
let firebaseAdmin;

/**
 * Procesar la clave privada para manejar diferentes formatos
 */
function parsePrivateKey(key) {
  if (!key) return null;
  
  // Si ya tiene saltos de línea reales, retornar tal cual
  if (key.includes('-----BEGIN PRIVATE KEY-----\n')) {
    return key;
  }
  
  // Si tiene \n literales (como texto), reemplazarlos
  if (key.includes('\\n')) {
    return key.replace(/\\n/g, '\n');
  }
  
  // Si no tiene ninguno de los dos, intentar agregar saltos de línea
  return key;
}

function initializeFirebase() {
  if (firebaseAdmin) return firebaseAdmin;
  
  try {
    // Si ya está inicializado, retornarlo
    if (admin.apps.length > 0) {
      firebaseAdmin = admin;
      return firebaseAdmin;
    }

    // Intentar cargar desde JSON completo primero (más robusto)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        firebaseAdmin = admin;
        console.log('✅ Firebase Admin inicializado desde JSON completo');
        return firebaseAdmin;
      } catch (jsonError) {
        console.error('Error parseando FIREBASE_SERVICE_ACCOUNT_JSON:', jsonError.message);
      }
    }

    // Configuración desde variables de entorno individuales
    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    const privateKey = parsePrivateKey(rawKey);
    
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey
    };

    // Log para debugging
    console.log('🔧 Firebase Config Check:', {
      hasProjectId: !!serviceAccount.projectId,
      hasClientEmail: !!serviceAccount.clientEmail,
      hasPrivateKey: !!privateKey,
      privateKeyLength: privateKey?.length || 0,
      privateKeyStart: privateKey?.substring(0, 50),
      rawKeyHasBackslashN: rawKey?.includes('\\n'),
      rawKeyHasRealNewline: rawKey?.includes('\n')
    });

    // Verificar que tenemos las credenciales
    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      console.warn('⚠️ Firebase Admin no configurado. Faltan credenciales:', {
        projectId: !!serviceAccount.projectId,
        clientEmail: !!serviceAccount.clientEmail,
        privateKey: !!serviceAccount.privateKey
      });
      return null;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    firebaseAdmin = admin;
    console.log('✅ Firebase Admin inicializado correctamente');
    return firebaseAdmin;
  } catch (error) {
    console.error('❌ Error inicializando Firebase Admin:', error.message);
    console.error('❌ Stack:', error.stack);
    return null;
  }
}

/**
 * Verificar token de Firebase Auth y obtener UID del usuario
 */
export async function verifyAuthToken(authHeader) {
  const firebase = initializeFirebase();
  
  if (!firebase) {
    return { uid: null, error: 'Firebase Admin no configurado' };
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { uid: null, error: 'Token de autenticación requerido' };
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await firebase.auth().verifyIdToken(idToken);
    return { uid: decodedToken.uid, error: null };
  } catch (error) {
    console.error('Error verificando token:', error.message);
    return { uid: null, error: 'Token inválido o expirado' };
  }
}

/**
 * Obtener token de Replicate del usuario desde Firestore
 */
export async function getUserReplicateToken(uid) {
  const firebase = initializeFirebase();
  
  if (!firebase) {
    return { token: null, error: 'Firebase Admin no configurado' };
  }

  try {
    const db = firebase.firestore();
    const doc = await db.collection('users').doc(uid).get();
    
    if (!doc.exists) {
      return { token: null, error: 'Usuario no encontrado' };
    }

    const data = doc.data();
    return { token: data?.replicateToken || null, error: null };
  } catch (error) {
    console.error('Error obteniendo token de usuario:', error.message);
    return { token: null, error: 'Error al obtener token' };
  }
}

/**
 * Guardar token de Replicate del usuario en Firestore
 */
export async function saveUserReplicateToken(uid, token) {
  console.log('📝 saveUserReplicateToken llamado para uid:', uid?.slice(0, 8));
  
  const firebase = initializeFirebase();
  
  if (!firebase) {
    console.error('❌ Firebase Admin no está inicializado');
    return { success: false, error: 'Firebase Admin no configurado' };
  }

  try {
    console.log('📝 Intentando guardar en Firestore...');
    const db = firebase.firestore();
    await db.collection('users').doc(uid).set({
      replicateToken: token,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('✅ Token guardado exitosamente');
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error guardando token:', error.message);
    console.error('❌ Error completo:', error);
    return { success: false, error: `Error al guardar token: ${error.message}` };
  }
}

export { initializeFirebase };
