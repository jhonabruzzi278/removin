import { useState } from 'react';
import { uploadFile, getPublicUrl, deleteFile } from '@/lib/firebase';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import type { LocalImage } from '@/types';

export function useImageProcessor() {
  const { user } = useAuth();
  const { error: showError } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const startBatch = async (files: LocalImage[]): Promise<Map<string, string> | null> => {
    if (!user) {
      showError('⚠️ Debes iniciar sesion para procesar imagenes');
      return null;
    }

    if (files.length === 0) {
      showError('⚠️ No hay imagenes para procesar');
      return null;
    }

    setIsProcessing(true);
    setProgress(0);

    const batchId = crypto.randomUUID();
    const total = files.length;
    const results = new Map<string, string>();

    try {
      const batchSize = 3;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (localImg) => {
            let uploadedPath: string | null = null;
            try {
              if (!localImg.file.type.startsWith('image/')) {
                throw new Error('El archivo no es una imagen valida');
              }

              if (localImg.file.size > 10 * 1024 * 1024) {
                throw new Error('El archivo excede el tamano maximo de 10MB');
              }

              const fileExt = localImg.file.name.split('.').pop()?.toLowerCase();
              if (!fileExt || !['jpg', 'jpeg', 'png', 'webp'].includes(fileExt)) {
                throw new Error('Formato de imagen no soportado');
              }

              const fileName = `${localImg.id}.${fileExt}`;
              const filePath = `${user.uid}/${batchId}/${fileName}`;

              const { error: uploadError } = await uploadFile(filePath, localImg.file);

              if (uploadError) throw uploadError;
              uploadedPath = filePath;

              const publicUrl = await getPublicUrl(filePath);

              if (!publicUrl) {
                throw new Error('Error al obtener la URL de la imagen');
              }

              const data = await apiClient.removeBackground(publicUrl);

              if (!data.success || data.error) throw new Error(data.error || 'Error desconocido');
              results.set(localImg.id, data.outputUrl);
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Error desconocido';

              if (errorMsg.includes('REPLICATE_API_TOKEN')) {
                results.set(localImg.id, 'ERROR:TOKEN');
              } else if (errorMsg.includes('storage')) {
                results.set(localImg.id, 'ERROR:UPLOAD');
              } else if (errorMsg.includes('failed') || errorMsg.includes('Timeout')) {
                results.set(localImg.id, 'ERROR:PROCESSING');
              } else {
                results.set(localImg.id, 'ERROR');
              }
            } finally {
              if (uploadedPath) {
                await deleteFile(uploadedPath).catch(() => {});
              }
            }
          })
        );

        const completed = Math.min(i + batchSize, total);
        setProgress((completed / total) * 100);
      }

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      if (errorMessage.includes('REPLICATE_API_TOKEN')) {
        showError('🔑 Error: Token de Replicate no configurado. Ve a Settings para configurarlo.');
      } else if (errorMessage.includes('storage')) {
        showError('📁 Error al subir imagenes. Verifica tu conexion.');
      } else if (errorMessage.includes('network')) {
        showError('🌐 Error de conexion. Verifica tu internet.');
      } else {
        showError(`❌ Error: ${errorMessage}`);
      }

      return null;
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  return { startBatch, isProcessing, progress };
}
