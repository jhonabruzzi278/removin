import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject,
  type FirebaseStorage
} from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Verificar si la configuración está presente
const isConfigured = Object.values(firebaseConfig).every(value => 
  value && value !== 'your_firebase_value_here' && value !== undefined
);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;
let googleProvider: GoogleAuthProvider | undefined;

if (isConfigured) {
  try {
    // Inicializar Firebase
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    storage = getStorage(app);
    googleProvider = new GoogleAuthProvider();
  } catch (error) {
    console.error('Error al inicializar Firebase:', error);
  }
} else {
  console.warn('Firebase no está configurado. Verifica las variables de entorno.');
}

// Helper functions for storage operations
export async function uploadFile(path: string, file: File): Promise<{ error: Error | null }> {
  if (!isConfigured || !storage) {
    return { error: new Error('Firebase no está configurado') };
  }
  
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function getPublicUrl(path: string): Promise<string | null> {
  if (!isConfigured || !storage) {
    return null;
  }
  
  try {
    const storageRef = ref(storage, path);
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    console.error('Error getting public URL:', error);
    return null;
  }
}

export async function deleteFile(path: string): Promise<{ error: Error | null }> {
  if (!isConfigured || !storage) {
    return { error: new Error('Firebase no está configurado') };
  }
  
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export { auth, storage, googleProvider, isConfigured };
