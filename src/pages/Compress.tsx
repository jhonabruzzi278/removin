import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, UploadCloud, Sparkles, Trash2, Download, CheckCircle2, FileDown, Info, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface CompressedImage {
  id: string;
  file: File;
  preview: string;
  originalSize: number;
  compressedUrl?: string;
  compressedSize?: number;
  quality: number;
}

export default function CompressPage() {
  const [files, setFiles] = useState<CompressedImage[]>([]);
  const [quality, setQuality] = useState(80);
  const [isProcessing, setIsProcessing] = useState(false);
  const { warning } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (files.length + acceptedFiles.length > 20) {
      warning("⚠️ Solo puedes comprimir hasta 20 imágenes por lote");
      return;
    }

    const newFiles: CompressedImage[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
      originalSize: file.size,
      quality
    }));

    setFiles(prev => [...prev, ...newFiles]);
  }, [files, quality, warning]);

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
        if (file.compressedUrl) URL.revokeObjectURL(file.compressedUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const clearAll = () => {
    files.forEach(file => {
      URL.revokeObjectURL(file.preview);
      if (file.compressedUrl) URL.revokeObjectURL(file.compressedUrl);
    });
    setFiles([]);
  };

  const compressImage = async (file: CompressedImage): Promise<CompressedImage> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = file.preview;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              resolve({
                ...file,
                compressedUrl: url,
                compressedSize: blob.size
              });
            } else {
              resolve(file);
            }
          }, 'image/jpeg', quality / 100);
        } else {
          resolve(file);
        }
      };
    });
  };

  const handleCompress = async () => {
    setIsProcessing(true);
    
    const compressed = await Promise.all(files.map(file => compressImage(file)));
    setFiles(compressed);
    
    setIsProcessing(false);
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `compressed_${filename}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = () => {
    files.forEach(file => {
      if (file.compressedUrl && file.compressedSize) {
        setTimeout(() => {
          downloadImage(file.compressedUrl!, file.file.name);
        }, 100 * files.indexOf(file));
      }
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxSize: 10 * 1024 * 1024,
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getSavings = (original: number, compressed?: number) => {
    if (!compressed) return 0;
    return Math.round(((original - compressed) / original) * 100);
  };

  const totalOriginal = files.reduce((sum, f) => sum + f.originalSize, 0);
  const totalCompressed = files.reduce((sum, f) => sum + (f.compressedSize || 0), 0);
  const hasCompressed = files.some(f => f.compressedUrl);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold bg-linear-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Comprimir Imágenes</h2>
            <Badge variant="success" className="h-6">100% Local</Badge>
          </div>
          <p className="text-slate-600 text-sm flex items-center gap-2">
            <Info size={14} />
            Reduce el tamaño sin perder calidad visible
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Lote Actual</span>
          <p className={cn("text-2xl font-mono font-bold", files.length >= 20 ? "text-red-500" : "text-slate-700")}>
            {files.length}<span className="text-slate-300 text-lg">/20</span>
          </p>
        </div>
      </div>

      {/* Control de Calidad */}
      <Card className="p-6 bg-linear-to-br from-white to-slate-50 border-slate-200 shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-blue-600" />
              <label className="text-sm font-semibold text-slate-700">
                Calidad de Compresión
              </label>
            </div>
            <Badge variant="info" className="text-base px-3 py-1">{quality}%</Badge>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="w-full h-3 bg-linear-to-r from-slate-200 to-slate-300 rounded-full appearance-none cursor-pointer accent-blue-600"
            disabled={files.length === 0}
          />
          <div className="flex justify-between text-xs font-medium">
            <span className="text-red-600">Máxima compresión</span>
            <span className="text-green-600">Calidad original</span>
          </div>
        </div>
      </Card>

      {files.length < 20 && (
        <div 
          {...getRootProps()} 
          className={cn(
            "relative border-2 border-dashed rounded-2xl h-52 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group",
            isDragActive 
              ? "border-amber-500 bg-linear-to-br from-amber-50 to-amber-100/50 scale-[0.98] shadow-lg shadow-amber-200"
              : "border-slate-300 hover:border-amber-400 bg-linear-to-br from-slate-50 to-white hover:shadow-md"
          )}
        >
          <input {...getInputProps()} />
          <div className={cn(
            "p-4 rounded-2xl shadow-lg mb-4 transition-all duration-300",
            isDragActive ? "bg-linear-to-br from-amber-500 to-amber-600 scale-110" : "bg-linear-to-br from-slate-100 to-slate-200 group-hover:scale-105"
          )}>
            <UploadCloud className={cn("w-8 h-8 transition-colors", isDragActive ? "text-white" : "text-slate-600 group-hover:text-amber-600")} />
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

              {file.compressedUrl && (
                <div className="absolute top-2 left-2 z-10">
                  <span className="bg-green-600/90 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm font-medium flex items-center gap-1">
                    <CheckCircle2 size={10} />-{getSavings(file.originalSize, file.compressedSize)}%
                  </span>
                </div>
              )}

              <div className="aspect-square relative">
                <img 
                  src={file.compressedUrl || file.preview} 
                  alt="preview" 
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="p-3 bg-slate-50">
                <p className="text-xs truncate font-medium text-slate-700">{file.file.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-slate-500">
                    {formatSize(file.originalSize)}
                  </p>
                  {file.compressedSize && (
                    <>
                      <span className="text-[10px] text-slate-400">→</span>
                      <p className="text-[10px] text-green-600 font-semibold">
                        {formatSize(file.compressedSize)}
                      </p>
                    </>
                  )}
                </div>
                
                {file.compressedUrl && (
                  <Button
                    size="sm"
                    onClick={() => downloadImage(file.compressedUrl!, file.file.name)}
                    className="w-full mt-2 h-7 text-xs"
                  >
                    <Download size={12} className="mr-1" />
                    Descargar
                  </Button>
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
              <span className="text-xs text-slate-400">
                {hasCompressed ? 'Ahorro Total' : 'Total a comprimir'}
              </span>
              <span className="font-bold text-sm">
                {hasCompressed 
                  ? `${formatSize(totalOriginal)} → ${formatSize(totalCompressed)} (-${getSavings(totalOriginal, totalCompressed)}%)`
                  : `${files.length} imágenes (${formatSize(totalOriginal)})`
                }
              </span>
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

            {hasCompressed && (
              <button
                onClick={downloadAll}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-green-300 hover:text-green-200 hover:bg-slate-700 transition-colors text-sm font-medium"
              >
                <FileDown size={16} />
                Descargar Todas
              </button>
            )}

            <button
              onClick={(isProcessing || hasCompressed) ? undefined : handleCompress}
              disabled={isProcessing || hasCompressed}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-slate-900 hover:bg-slate-100 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={16} />
              {isProcessing ? 'Comprimiendo...' : 'Comprimir'}
            </button>
          </Card>
        </div>
      )}
    </div>
  );
}
