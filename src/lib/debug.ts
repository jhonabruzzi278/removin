// Debug utility para verificar configuración
export function debugFirebaseConfig() {
  console.group('🔍 Firebase Configuration Debug');
  console.log('isConfigured:', import.meta.env.VITE_FIREBASE_API_KEY ? 'Yes' : 'No');
  console.log('API Key:', import.meta.env.VITE_FIREBASE_API_KEY ? '✓ Set' : '✗ Missing');
  console.log('Auth Domain:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? '✓ Set' : '✗ Missing');
  console.log('Project ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID ? '✓ Set' : '✗ Missing');
  console.log('Storage Bucket:', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ? '✓ Set' : '✗ Missing');
  console.log('Messaging Sender ID:', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ? '✓ Set' : '✗ Missing');
  console.log('App ID:', import.meta.env.VITE_FIREBASE_APP_ID ? '✓ Set' : '✗ Missing');
  console.groupEnd();
}

export function debugAuthState(user: any, loading: boolean) {
  console.group('👤 Auth State Debug');
  console.log('Loading:', loading);
  console.log('User:', user ? `Authenticated (${user.email})` : 'Not authenticated');
  console.groupEnd();
}
