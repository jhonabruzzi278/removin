import { uploadFile, getPublicUrl, deleteFile } from '@/lib/firebase';
import { apiClient } from '@/lib/api';
import type { AIModel } from '@/data/models';

interface UseFolderWatchProcessorOptions {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  user: { uid: string } | null;
}

interface ProcessImageOptions {
  file: File;
  fileName: string;
  outputDir: FileSystemDirectoryHandle;
  whiteBackground: boolean;
  modelVersion?: string;
}

interface ProcessImageResult {
  success: boolean;
  processingTime: number;
  error?: string;
}

// Mapear quality string a nivel numérico (compartido)
const getQualityLevel = (quality: string): number => {
  switch(quality) {
    case 'ultra': return 5;
    case 'high': return 3;
    case 'standard': return 2;
    default: return 2;
  }
};

export function useFolderWatchProcessor({ onSuccess, onError, user }: UseFolderWatchProcessorOptions) {
  
  // Aplicar fondo blanco a una imagen con transparencia
  const applyWhiteBackground = async (blob: Blob): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
      const tempUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('No se pudo obtener contexto 2D'));
            return;
          }
          
          // Pintar fondo blanco
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          // Dibujar imagen con transparencia encima
          ctx.drawImage(img, 0, 0);
          
          // Convertir a JPG con fondo blanco
          canvas.toBlob(
            (resultBlob) => {
              // Limpieza de memoria explícita
              img.onload = null;
              img.onerror = null;
              img.src = '';
              URL.revokeObjectURL(tempUrl);
              
              if (resultBlob) {
                resolve(resultBlob);
              } else {
                reject(new Error('Error al crear blob'));
              }
            },
            'image/jpeg',
            0.95
          );
        } catch (err) {
          // Limpieza en caso de error
          img.onload = null;
          img.onerror = null;
          img.src = '';
          URL.revokeObjectURL(tempUrl);
          reject(err);
        }
      };
      
      img.onerror = () => {
        // Limpieza en caso de error
        img.onload = null;
        img.onerror = null;
        img.src = '';
        URL.revokeObjectURL(tempUrl);
        reject(new Error('Error al cargar imagen'));
      };
      
      img.src = tempUrl;
    });
  };

  // Procesar una imagen con retry exponencial para errores 429
  const processImage = async (options: ProcessImageOptions): Promise<ProcessImageResult> => {
    const { file, fileName, outputDir, whiteBackground, modelVersion } = options;
    const startTime = Date.now();
    let retries = 0;
    const maxRetries = 3;
    
    while (retries <= maxRetries) {
      try {
        // Validación de archivo
        if (!file.type.startsWith('image/')) {
          throw new Error('El archivo no es una imagen válida');
        }
        
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('El archivo excede el tamaño máximo de 10MB');
        }

        // Sanitizar nombre de archivo para evitar path traversal
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${user?.uid}/auto/${Date.now()}_${sanitizedFileName}`;
        
        const { error: uploadError } = await uploadFile(filePath, file);

        if (uploadError) throw uploadError;

        const publicUrl = await getPublicUrl(filePath);
        
        if (!publicUrl) {
          throw new Error('Error al obtener la URL de la imagen');
        }

        const data = await apiClient.removeBackground(publicUrl, modelVersion);

        if (!data.success || data.error) {
          throw new Error(data.error || 'Error en el procesamiento de la imagen');
        }

        // Descargar imagen procesada
        const response = await fetch(data.outputUrl, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache'
        });
        
        if (!response.ok) {
          throw new Error(`Error al descargar imagen: ${response.status} ${response.statusText}`);
        }
        
        let resultBlob = await response.blob();
        
        if (!resultBlob || resultBlob.size === 0) {
          throw new Error('Imagen vacía recibida');
        }

        // Aplicar fondo blanco si está activado
        if (whiteBackground) {
          resultBlob = await applyWhiteBackground(resultBlob);
        }

        // Guardar en carpeta de salida
        const outputName = fileName.replace(
          /\.(jpg|jpeg|png|webp)$/i,
          whiteBackground ? '.jpg' : '.png'
        );
        const outputFile = await outputDir.getFileHandle(outputName, { create: true });
        const writable = await outputFile.createWritable();
        await writable.write(resultBlob);
        await writable.close();

        const processingTime = Math.round((Date.now() - startTime) / 1000);
        onSuccess(`✅ ${fileName} procesada (${processingTime}s)`);

        // Limpiar archivo temporal de Firebase Storage
        try {
          await deleteFile(filePath);
        } catch {
          // Error no crítico al limpiar archivo temporal
        }

        return {
          success: true,
          processingTime,
        };

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
        
        // Manejo especial de error 429 con exponential backoff
        if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
          if (retries < maxRetries) {
            const backoffTime = Math.pow(2, retries) * 2000; // 2s, 4s, 8s
            onError(`⏳ ${fileName}: Límite alcanzado. Reintentando en ${backoffTime/1000}s... (${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            retries++;
            continue; // Reintentar
          }
        }

        // Mapear errores a mensajes amigables
        let userFriendlyError = errorMsg;
        if (errorMsg.includes('REPLICATE_API_TOKEN')) {
          userFriendlyError = 'Token de Replicate no configurado';
        } else if (errorMsg.includes('storage') || errorMsg.includes('upload')) {
          userFriendlyError = 'Error al subir imagen';
        } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('HTTP')) {
          userFriendlyError = `Error de conexión: ${errorMsg}`;
        } else if (errorMsg.includes('output directory')) {
          userFriendlyError = 'Error al guardar archivo';
        } else if (errorMsg.includes('ERR_HTTP2') || errorMsg.includes('Failed to fetch')) {
          userFriendlyError = 'Error de red al descargar imagen. Verifica tu conexión y las URLs de Firebase.';
        }

        onError(`❌ ${fileName}: ${userFriendlyError}`);
        
        return {
          success: false,
          processingTime: Math.round((Date.now() - startTime) / 1000),
          error: userFriendlyError,
        };
      }
    }

    // Si llegamos aquí, se agotaron los reintentos
    onError(`❌ ${fileName}: Se agotaron los reintentos`);
    return {
      success: false,
      processingTime: Math.round((Date.now() - startTime) / 1000),
      error: 'Se agotaron los reintentos',
    };
  };

  // Obtener delay dinámico basado en el modelo seleccionado
  const getModelDelay = (model: AIModel | null): number => {
    if (!model) return 10000; // Default 10s
    
    // Modelos más rápidos/económicos pueden tener delays menores
    const qualityLevel = getQualityLevel(model.quality);
    
    if (qualityLevel >= 4) {
      // Premium: permite más throughput
      return 5000; // 5s
    } else if (qualityLevel >= 3) {
      // Estándar
      return 7000; // 7s
    } else {
      // Económico: más conservador
      return 10000; // 10s
    }
  };

  return {
    processImage,
    getModelDelay,
  };
}
