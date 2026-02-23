import admin from 'firebase-admin';

// Inicializar Firebase Admin SDK
let firebaseAdmin = null;

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
  
  return key;
}

function initializeFirebase() {
  if (firebaseAdmin) return firebaseAdmin;
  
  try {
    if (admin.apps.length > 0) {
      firebaseAdmin = admin;
      return firebaseAdmin;
    }

    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    const privateKey = parsePrivateKey(rawKey);
    const projectId = process.env.FIREBASE_PROJECT_ID;
    
    const serviceAccount = {
      projectId: projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey
    };

    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      console.warn('⚠️ Firebase Admin no configurado');
      return null;
    }

    // Inicializar con Realtime Database URL
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId,
      databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`
    });

    firebaseAdmin = admin;
    console.log('✅ Firebase Admin inicializado con projectId:', projectId);
    return firebaseAdmin;
  } catch (error) {
    console.error('❌ Error inicializando Firebase Admin:', error.message);
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
 * Obtener token de Replicate del usuario desde Realtime Database
 */
export async function getUserReplicateToken(uid) {
  const firebase = initializeFirebase();
  
  if (!firebase) {
    return { token: null, error: 'Firebase Admin no configurado' };
  }

  try {
    const db = firebase.database();
    const snapshot = await db.ref(`users/${uid}/replicateToken`).get();
    
    if (!snapshot.exists()) {
      return { token: null, error: null }; // Usuario sin token aún
    }

    return { token: snapshot.val(), error: null };
  } catch (error) {
    console.error('Error obteniendo token de usuario:', error.message);
    return { token: null, error: 'Error al obtener token' };
  }
}

/**
 * Guardar token de Replicate del usuario en Realtime Database
 */
export async function saveUserReplicateToken(uid, token) {
  console.log('📝 saveUserReplicateToken llamado para uid:', uid?.slice(0, 8));
  
  const firebase = initializeFirebase();
  
  if (!firebase) {
    console.error('❌ Firebase Admin no está inicializado');
    return { success: false, error: 'Firebase Admin no configurado' };
  }

  try {
    console.log('📝 Intentando guardar en Realtime Database...');
    const db = firebase.database();
    
    await db.ref(`users/${uid}`).set({
      replicateToken: token,
      updatedAt: Date.now()
    });

    console.log('✅ Token guardado exitosamente');
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error guardando token:', error.message);
    return { success: false, error: `Error al guardar token: ${error.message}` };
  }
}

/**
 * Obtener instancia de Realtime Database para debug
 */
export function getDb() {
  const firebase = initializeFirebase();
  if (!firebase) return null;
  
  try {
    return firebase.database();
  } catch (e) {
    console.error('Error obteniendo database:', e.message);
    return null;
  }
}

export { initializeFirebase };
