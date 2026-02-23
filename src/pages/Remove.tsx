import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, UploadCloud, Sparkles, Trash2, Loader2, Download, CheckCircle2, XCircle, Info, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Toast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import type { LocalImage } from '@/types';
import { useImageProcessor } from '@/hooks/useImageProcessor';


interface ProcessedImage extends LocalImage {
  resultUrl?: string;
  error?: string;
}

export default function RemovePage() {
  const [files, setFiles] = useState<ProcessedImage[]>([]);
  const [whiteBackground, setWhiteBackground] = useState(false);
  const { startBatch, isProcessing, progress } = useImageProcessor();
  const { toasts, dismiss, success, error, info } = useToast();

  // Limpieza de URLs de memoria al desmontar componente
  useEffect(() => {
    return () => files.forEach(file => {
      URL.revokeObjectURL(file.preview);
      if (file.resultUrl) URL.revokeObjectURL(file.resultUrl);
    });
  }, [files]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (files.length + acceptedFiles.length > 20) {
      error("⚠️ Solo puedes procesar hasta 20 imágenes por lote");
      return;
    }

    const newFiles: ProcessedImage[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...newFiles]);
    success(`✅ ${acceptedFiles.length} imagen${acceptedFiles.length > 1 ? 'es' : ''} agregada${acceptedFiles.length > 1 ? 's' : ''}`);
  }, [files, success, error]);

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
        if (file.resultUrl) URL.revokeObjectURL(file.resultUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const clearAll = () => {
    files.forEach(file => {
      URL.revokeObjectURL(file.preview);
      if (file.resultUrl) URL.revokeObjectURL(file.resultUrl);
    });
    setFiles([]);
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      if (!whiteBackground) {
        // Descarga directa del PNG transparente
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `removin_${filename}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        return;
      }

      // Aplicar fondo blanco con Canvas
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Error al cargar imagen'));
        img.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('No se pudo obtener contexto 2D del canvas');
      }

      // Pintar fondo blanco
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Pegar imagen transparente encima
      ctx.drawImage(img, 0, 0);

      // Descargar como JPG con fondo blanco
      canvas.toBlob((blob) => {
        if (blob) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `removin_${filename.split('.')[0]}_white.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        }
      }, 'image/jpeg', 0.95);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      error(`❌ Error al descargar: ${errorMsg}`);
    }
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      error('⚠️ Agrega al menos una imagen para procesar');
      return;
    }

    info(`🚀 Procesando ${files.length} imagen${files.length > 1 ? 'es' : ''}...`);

    // Marcar todos como processing
    setFiles(prev => prev.map(f => ({ ...f, status: 'processing' })));
    
    const results = await startBatch(files);
    
    if (results) {
      let successCount = 0;
      let errorCount = 0;

      // Actualizar con resultados
      setFiles(prev => prev.map(file => {
        const resultUrl = results.get(file.id);
        if (!resultUrl) return file;
        
        // Manejar diferentes tipos de errores
        if (resultUrl.startsWith('ERROR')) {
          errorCount++;
          let errorMsg = 'Error al procesar';
          if (resultUrl.includes('TOKEN')) errorMsg = 'Token de API no configurado';
          else if (resultUrl.includes('UPLOAD')) errorMsg = 'Error al subir imagen';
          else if (resultUrl.includes('PROCESSING')) errorMsg = 'Error en procesamiento';
          
          return { ...file, status: 'error', error: errorMsg };
        }
        
        successCount++;
        return { ...file, status: 'success', resultUrl };
      }));

      // Mostrar resultado final
      if (errorCount === 0) {
        success(`✅ ${successCount} imagen${successCount > 1 ? 'es procesadas' : ' procesada'} exitosamente`);
      } else if (successCount === 0) {
        error(`❌ Error al procesar todas las imágenes`);
      } else {
        info(`ℹ️ ${successCount} exitosas, ${errorCount} con errores`);
      }
    } else {
      // Si startBatch retorna null, resetear estados
      setFiles(prev => prev.map(f => ({ ...f, status: 'pending' })));
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxSize: 10 * 1024 * 1024,
  });

  const getStatusBadge = (file: ProcessedImage) => {
    switch (file.status) {
      case 'pending':
        return <span className="bg-slate-900/70 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm font-medium">PENDIENTE</span>;
      case 'processing':
        return <span className="bg-blue-600/90 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm font-medium flex items-center gap-1"><Loader2 size={10} className="animate-spin" />PROCESANDO</span>;
      case 'success':
        return <span className="bg-green-600/90 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm font-medium flex items-center gap-1"><CheckCircle2 size={10} />LISTO</span>;
      case 'error':
        return <span className="bg-red-600/90 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm font-medium flex items-center gap-1"><XCircle size={10} />ERROR</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Remover Fondo</h2>
            <Badge variant="info" className="h-6">lucataco/remove-bg</Badge>
            <Tooltip content="Elimina el fondo de tus imágenes automáticamente usando IA. Sube hasta 20 imágenes a la vez." position="right">
              <button className="text-slate-400 hover:text-slate-600 transition-colors">
                <HelpCircle size={20} />
              </button>
            </Tooltip>
          </div>
          <p className="text-slate-600 text-sm flex items-center gap-2">
            <Info size={14} />
            Elimina fondos de imágenes con IA en segundos
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 cursor-pointer" htmlFor="bg-switch">
              Fondo Blanco
            </label>
            <Tooltip content="Descarga las imágenes con fondo blanco en lugar de transparente (formato JPG)" position="bottom">
              <button className="text-slate-400 hover:text-slate-600 transition-colors">
                <HelpCircle size={16} />
              </button>
            </Tooltip>
            <button
              id="bg-switch"
              role="switch"
              aria-checked={whiteBackground}
              onClick={() => setWhiteBackground(!whiteBackground)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                whiteBackground ? "bg-blue-600" : "bg-slate-300"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  whiteBackground ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
          <div className="text-right">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Lote Actual</span>
            <p className={cn("text-2xl font-mono font-bold", files.length >= 20 ? "text-red-500" : "text-slate-700")}>
              {files.length}<span className="text-slate-300 text-lg">/20</span>
            </p>
          </div>
        </div>
      </div>

      {files.length < 20 && (
        <div 
          {...getRootProps()} 
          className={cn(
            "relative border-2 border-dashed rounded-2xl h-52 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group",
            isDragActive 
              ? "border-blue-500 bg-linear-to-br from-blue-50 to-blue-100/50 scale-[0.98] shadow-lg shadow-blue-200"
              : "border-slate-300 hover:border-blue-400 bg-linear-to-br from-slate-50 to-white hover:shadow-md"
          )}
        >
          <input {...getInputProps()} />
          <div className={cn(
            "p-4 rounded-2xl shadow-lg mb-4 transition-all duration-300",
            isDragActive ? "bg-linear-to-br from-blue-500 to-blue-600 scale-110" : "bg-linear-to-br from-slate-100 to-slate-200 group-hover:scale-105"
          )}>
            <UploadCloud className={cn("w-8 h-8 transition-colors", isDragActive ? "text-white" : "text-slate-600 group-hover:text-blue-600")} />
          </div>
          <p className="text-base font-semibold text-slate-800 mb-1">
            {isDragActive ? "¡Suelta las imágenes aquí!" : "Haz clic o arrastra imágenes"}
          </p>
          <p className="text-xs text-slate-500">Soporta PNG, JPG, WEBP • Máximo 10MB por imagen</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-24">
          {files.map((file) => (
            <div key={file.id} className="group relative bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              
              <button 
                onClick={() => removeFile(file.id)}
                className="absolute top-2 right-2 z-10 bg-white/90 p-1.5 rounded-md text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
              >
                <X size={14} />
              </button>

              <div className="absolute top-2 left-2 z-10">
                {getStatusBadge(file)}
              </div>

              <div className="aspect-square relative">
                <img 
                  src={file.resultUrl || file.preview} 
                  alt="preview" 
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="p-3 bg-slate-50">
                <p className="text-xs truncate font-medium text-slate-700">{file.file.name}</p>
                <p className="text-[10px] text-slate-500">{(file.file.size / 1024).toFixed(0)} KB</p>
                
                {file.resultUrl && (
                  <Button
                    size="sm"
                    onClick={() => downloadImage(file.resultUrl!, file.file.name)}
                    className="w-full mt-2 h-7 text-xs"
                  >
                    <Download size={12} className="mr-1" />
                    Descargar
                  </Button>
                )}
                
                {file.error && (
                  <p className="text-[10px] text-red-600 mt-1">{file.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="fixed bottom-6 left-0 right-0 md:left-64 flex justify-center z-30 px-4">
          <Card className="bg-slate-900 text-white p-2 rounded-full shadow-2xl flex items-center gap-4 pl-6 pr-2 border-slate-800">
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">Total a procesar</span>
              <span className="font-bold text-sm">{files.length} imágenes</span>
            </div>
            
            <div className="h-8 w-px bg-slate-700"></div>

            <button
              onClick={isProcessing ? undefined : clearAll}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={16} />
              Limpiar
            </button>

            <button
              onClick={isProcessing ? undefined : handleProcess}
              disabled={isProcessing}
              className="relative flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-slate-900 hover:bg-slate-100 transition-colors text-sm font-semibold disabled:cursor-not-allowed overflow-hidden"
            >
              {isProcessing && (
                <div 
                  className="absolute inset-0 bg-slate-200 transition-all duration-300" 
                  style={{ width: `${progress}%` }} 
                />
              )}
              <span className="relative flex items-center gap-2">
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Procesando... {Math.round(progress)}%
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Remover Fondos
                  </>
                )}
              </span>
            </button>
          </Card>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => dismiss(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}
