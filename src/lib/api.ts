import { auth, type AppUser } from './session';

/**
 * Resolve API base URL depending on runtime host.
 */
function getApiUrl(): string {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }
  return '';
}

const API_URL = getApiUrl();

interface ApiResponse<T = unknown> {
  success?: boolean;
  error?: string;
  data?: T;
  retryAfter?: number;
}

export interface TokenResponse {
  hasToken: boolean;
  isCustom: boolean;
}

export interface RemoveBackgroundResponse {
  success: boolean;
  outputUrl: string;
  error?: string;
}

export interface GenerateImageResponse {
  success: boolean;
  outputUrl: string;
  error?: string;
}

export interface CurrentUserResponse {
  success: boolean;
  user: AppUser;
}

class ApiClient {
  async getHeaders() {
    if (!auth || !auth.currentUser) {
      throw new Error('No hay sesion activa');
    }

    const token = await auth.currentUser.getIdToken();

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    retries = 2,
    requiresAuth = true
  ): Promise<T> {
    const headers = requiresAuth
      ? await this.getHeaders()
      : {
          'Content-Type': 'application/json',
        };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers || {}),
        },
      });

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Respuesta invalida del servidor');
      }

      const data = (await response.json()) as ApiResponse<T> & T;

      if (response.status === 429 && retries > 0) {
        const retryAfter = data.retryAfter || 15;
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return this.request<T>(endpoint, options, retries - 1, requiresAuth);
      }

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data as T;
    } catch (error) {
      if (retries > 0 && error instanceof TypeError) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return this.request<T>(endpoint, options, retries - 1, requiresAuth);
      }
      throw error;
    }
  }

  async hasToken(): Promise<TokenResponse> {
    return this.request<TokenResponse>('/api/user/token');
  }

  async saveToken(token: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/user/token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async removeBackground(imageUrl: string, modelVersion?: string): Promise<RemoveBackgroundResponse> {
    return this.request<RemoveBackgroundResponse>('/api/remove-bg', {
      method: 'POST',
      body: JSON.stringify({ imageUrl, modelVersion }),
    });
  }

  async generateImage(
    prompt: string,
    negativePrompt?: string,
    options?: {
      width?: number;
      height?: number;
      num_inference_steps?: number;
      guidance_scale?: number;
      scheduler?: string;
      seed?: number;
    }
  ): Promise<GenerateImageResponse> {
    return this.request<GenerateImageResponse>('/api/generate-image', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt,
        ...options,
      }),
    });
  }
}

export const apiClient = new ApiClient();

