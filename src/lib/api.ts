import { auth } from './firebase';

// En producción, la API está en el mismo dominio (Vercel)
// En desarrollo, usa localhost:3001
const API_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:3001');

// Tipos de respuesta de la API
interface ApiResponse<T = unknown> {
  success?: boolean;
  error?: string;
  data?: T;
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

/**
 * Cliente HTTP para comunicarse con el backend
 */
class ApiClient {
  /**
   * Obtener headers con autenticación
   */
  async getHeaders() {
    if (!auth || !auth.currentUser) {
      throw new Error('No hay sesión activa');
    }
    
    const token = await auth.currentUser.getIdToken();
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Hacer request al backend con retry automático en caso de 429
   */
  async request<T = unknown>(endpoint: string, options: RequestInit = {}, retries = 2): Promise<T> {
    const headers = await this.getHeaders();
    
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers || {})
        }
      });
      
      // Validar que la respuesta tenga contenido
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Respuesta inválida del servidor');
      }
      
      const data = await response.json() as ApiResponse<T> & T;
      
      // Si es error 429 y tenemos retries, esperar y reintentar
      if (response.status === 429 && retries > 0) {
        const retryAfter = (data as { retryAfter?: number }).retryAfter || 15;
        // Rate limit alcanzado, reintentando...
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return this.request<T>(endpoint, options, retries - 1);
      }
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      return data as T;
    } catch (error) {
      // Si es error de red y tenemos retries
      if (retries > 0 && error instanceof TypeError) {
        // Error de red, reintentando...
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.request<T>(endpoint, options, retries - 1);
      }
      throw error;
    }
  }

  // ==========================================
  // Métodos de API
  // ==========================================

  /**
   * Verificar si el usuario tiene token configurado
   */
  async hasToken(): Promise<TokenResponse> {
    return this.request<TokenResponse>('/api/user/token');
  }

  /**
   * Guardar token de Replicate
   */
  async saveToken(token: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/user/token', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  }

  /**
   * Remover fondo de imagen
   */
  async removeBackground(imageUrl: string, modelVersion?: string): Promise<RemoveBackgroundResponse> {
    return this.request<RemoveBackgroundResponse>('/api/remove-bg', {
      method: 'POST',
      body: JSON.stringify({ imageUrl, modelVersion })
    });
  }

  /**
   * Generar imagen con AI
   */
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
        ...options
      })
    });
  }
}

export const apiClient = new ApiClient();
