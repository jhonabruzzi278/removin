import admin from 'firebase-admin';

// Inicializar Firebase Admin SDK
// En producción, usa las variables de entorno de Vercel
let firebaseAdmin;

function initializeFirebase() {
  if (firebaseAdmin) return firebaseAdmin;
  
  try {
    // Si ya está inicializado, retornarlo
    if (admin.apps.length > 0) {
      firebaseAdmin = admin;
      return firebaseAdmin;
    }

    // Configuración desde variables de entorno
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // La private key viene con \n escapados, hay que convertirlos
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    };

    // Verificar que tenemos las credenciales
    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      console.warn('⚠️ Firebase Admin no configurado. Algunas funciones no estarán disponibles.');
      return null;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    firebaseAdmin = admin;
    console.log('✅ Firebase Admin inicializado');
    return firebaseAdmin;
  } catch (error) {
    console.error('Error inicializando Firebase Admin:', error.message);
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
  const firebase = initializeFirebase();
  
  if (!firebase) {
    return { success: false, error: 'Firebase Admin no configurado' };
  }

  try {
    const db = firebase.firestore();
    await db.collection('users').doc(uid).set({
      replicateToken: token,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, error: null };
  } catch (error) {
    console.error('Error guardando token:', error.message);
    return { success: false, error: 'Error al guardar token' };
  }
}

export { initializeFirebase };
