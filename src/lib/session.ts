export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

interface AuthenticatedUser extends AppUser {
  getIdToken: () => Promise<string>;
}

interface StorageUploadRecord {
  uploadId: string;
  internalUrl: string;
  expiresAt: string;
}

interface StorageUploadResponse {
  success: boolean;
  uploadId: string;
  path: string;
  internalUrl: string;
  expiresAt: string;
  error?: string;
}

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const uploadPathMap = new Map<string, StorageUploadRecord>();

let tokenProvider: (() => Promise<string | null>) | null = null;

export const auth: { currentUser: AuthenticatedUser | null } = {
  currentUser: null,
};

export const isConfigured =
  !!import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_url_here' &&
  !!import.meta.env.VITE_SUPABASE_ANON_KEY &&
  import.meta.env.VITE_SUPABASE_ANON_KEY !== 'your_supabase_anon_key_here';

function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }
  return '';
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function setTokenProvider(provider: () => Promise<string | null>) {
  tokenProvider = provider;
}

export function setCurrentUser(user: AppUser | null) {
  if (!user) {
    auth.currentUser = null;
    return;
  }

  auth.currentUser = {
    ...user,
    getIdToken: async () => {
      if (!tokenProvider) {
        throw new Error('No hay proveedor de token disponible');
      }
      const token = await tokenProvider();
      if (!token) {
        throw new Error('No hay sesion activa');
      }
      return token;
    },
  };
}

export function clearAuthSession() {
  auth.currentUser = null;
  uploadPathMap.clear();
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!auth.currentUser) {
    throw new Error('No hay sesion activa');
  }

  const token = await auth.currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function uploadFile(path: string, file: File): Promise<{ error: Error | null }> {
  try {
    if (!file.type.startsWith('image/')) {
      return { error: new Error('El archivo no es una imagen valida') };
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return { error: new Error('El archivo excede el maximo de 10MB') };
    }

    const headers = await getAuthHeaders();
    const buffer = await file.arrayBuffer();
    const data = arrayBufferToBase64(buffer);

    const response = await fetch(`${getApiBaseUrl()}/api/storage/upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        path,
        fileName: file.name,
        mimeType: file.type,
        data,
      }),
    });

    const payload = (await response.json()) as StorageUploadResponse;
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'No fue posible subir el archivo temporal');
    }

    uploadPathMap.set(path, {
      uploadId: payload.uploadId,
      internalUrl: payload.internalUrl,
      expiresAt: payload.expiresAt,
    });

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function getPublicUrl(path: string): Promise<string | null> {
  const record = uploadPathMap.get(path);
  return record?.internalUrl || null;
}

export async function deleteFile(path: string): Promise<{ error: Error | null }> {
  const record = uploadPathMap.get(path);
  if (!record) {
    return { error: null };
  }

  try {
    const headers = await getAuthHeaders();
    await fetch(`${getApiBaseUrl()}/api/storage/upload/${encodeURIComponent(record.uploadId)}`, {
      method: 'DELETE',
      headers,
    });
    uploadPathMap.delete(path);
    return { error: null };
  } catch (error) {
    uploadPathMap.delete(path);
    return { error: error as Error };
  }
}
