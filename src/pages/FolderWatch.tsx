import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Toast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { uploadFile, getPublicUrl, deleteFile } from '@/lib/firebase';
import { apiClient } from '@/lib/api';
import { availableModels, type AIModel } from '@/data/models';
import { cn } from '@/lib/utils';
import {
  Folder, Play, Pause, Trash2, CheckCircle2,
  AlertCircle, Loader2, Info, Activity, HelpCircle, 
  RefreshCw, X, Star, Clock, DollarSign
} from 'lucide-react';

interface ProcessedFile {
  name: string;
  status: 'processing' | 'completed' | 'error';
  time?: number;
  error?: string;
  originalPreview?: string;
  processedPreview?: string;
  modelUsed?: string;
  modelName?: string;
}

export default function FolderWatchPage() {
  const { user } = useAuth();
  const { toasts, dismiss, success, error, info } = useToast();
  const [inputDir, setInputDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [outputDir, setOutputDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [stats, setStats] = useState({ total: 0, success: 0, errors: 0 });
  const [trackedCount, setTrackedCount] = useState(0);
  const [whiteBackground, setWhiteBackground] = useState(false);
  const [hasReplicateToken, setHasReplicateToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [reprocessingFile, setReprocessingFile] = useState<ProcessedFile | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const processedNamesRef = useRef<Set<string>>(new Set());
  const processingQueueRef = useRef<Array<{ file: File; name: string }>>([]);
  const isProcessingRef = useRef(false);
  const isMonitoringRef = useRef(false);
  const whiteBackgroundRef = useRef(whiteBackground);
  const selectedModelRef = useRef(selectedModel);

  const isSupported = 'showDirectoryPicker' in window;
  
  // Filtrar a 3 modelos principales: económico, estándar y premium
  const bgModels = availableModels.filter(m => 
    m.category === 'background-removal' && 
    ['cjwbw-rembg', 'lucataco-remove-bg', 'smoretalk-rembg-enhance'].includes(m.id)
  );

  const getQualityLevel = (quality: string): number => {
    switch(quality) {
      case 'ultra': return 5;
      case 'high': return 3;
      case 'standard': return 2;
      default: return 2;
    }
  };

  const getPricing = (costPerRun: number): string => {
    return `$${costPerRun.toFixed(4)}/img`;
  };

  // Sincronizar refs con estados (prevenir stale closures)
  useEffect(() => {
    whiteBackgroundRef.current = whiteBackground;
  }, [whiteBackground]);

  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  useEffect(() => {
    isMonitoringRef.current = isMonitoring;
  }, [isMonitoring]);

  // Verificar si el usuario tiene configurado el token de Replicate
  useEffect(() => {
    const checkToken = async () => {
      if (!user) {
        setCheckingToken(false);
        return;
      }
      
      try {
        const data = await apiClient.hasToken();
        setHasReplicateToken(data.hasToken);
      } catch {
        // Error verificando token
        setHasReplicateToken(false);
      } finally {
        setCheckingToken(false);
      }
    };
    
    checkToken();
  }, [user]);

  const selectInputFolder = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      setInputDir(dirHandle);
      // No limpiar processedNamesRef cuando se cambia de carpeta
      // para permitir iniciar monitoreo sin procesar archivos viejos
      addLog({ name: `📁 Carpeta de entrada: ${dirHandle.name}`, status: 'completed' });
      success(`✅ Carpeta de entrada seleccionada: ${dirHandle.name}`);
      console.log(`[FolderWatch] Carpeta seleccionada: ${dirHandle.name}`);
    } catch (err) {
      if (err instanceof Error && !err.message.includes('aborted')) {
        error('❌ Error al seleccionar carpeta de entrada');
      }
    }
  };

  const selectOutputFolder = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setOutputDir(dirHandle);
      addLog({ name: `💾 Carpeta de salida: ${dirHandle.name}`, status: 'completed' });
      success(`✅ Carpeta de salida seleccionada: ${dirHandle.name}`);
    } catch (err) {
      if (err instanceof Error && !err.message.includes('aborted')) {
        error('❌ Error al seleccionar carpeta de salida');
      }
    }
  };

  const addLog = (entry: Partial<ProcessedFile> & { name: string }) => {
    setProcessedFiles(prev => {
      const existing = prev.find(f => f.name === entry.name);
      if (existing) {
        return prev.map(f => f.name === entry.name 
          ? { ...f, ...entry } 
          : f
        );
      }
      return [{ status: 'processing', ...entry } as ProcessedFile, ...prev].slice(0, 100);
    });
  };

  const processImage = async (file: File, fileName: string, modelVersion?: string) => {
    const startTime = Date.now();
    // Usar refs para obtener valores actuales (evitar stale closures)
    const model = modelVersion || selectedModelRef.current?.version;
    const modelInfo = bgModels.find(m => m.version === model);
    const currentWhiteBackground = whiteBackgroundRef.current;
    
    try {
      // Validación de archivo
      if (!file.type.startsWith('image/')) {
        throw new Error('El archivo no es una imagen válida');
      }
      
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('El archivo excede el tamaño máximo de 10MB');
      }

      // Crear preview de la imagen original
      const originalPreview = URL.createObjectURL(file);

      addLog({ name: `📤 ${fileName}`, status: 'processing', originalPreview });

      // Sanitizar nombre de archivo para evitar path traversal
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${user?.uid}/auto/${Date.now()}_${sanitizedFileName}`;
      
      const { error: uploadError } = await uploadFile(filePath, file);

      if (uploadError) throw uploadError;

      const publicUrl = await getPublicUrl(filePath);
      
      if (!publicUrl) {
        throw new Error('Error al obtener la URL de la imagen');
      }

      const data = await apiClient.removeBackground(publicUrl, model);

      if (!data.success || data.error) {
        throw new Error(data.error || 'Error en el procesamiento de la imagen');
      }

      // La imagen procesada ahora está en Firebase Storage, descarga directa
      
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

      if (!outputDir) throw new Error('No output directory');

      // Aplicar fondo blanco si está activado (usar ref para valor actual)
      if (currentWhiteBackground) {
        const tempUrl = URL.createObjectURL(resultBlob);
        
        try {
          resultBlob = await new Promise<Blob>((resolve, reject) => {
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
                  (blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Error al crear blob'));
                  },
                  'image/jpeg',
                  0.95
                );
              } catch (err) {
                reject(err);
              }
            };
            
            img.onerror = () => reject(new Error('Error al cargar imagen'));
            img.src = tempUrl;
          });
        } finally {
          // Cleanup: liberar URL temporal
          URL.revokeObjectURL(tempUrl);
        }
      }

      // Mantener el mismo nombre, solo cambiar extensión según formato de salida
      const outputName = fileName.replace(
        /\.(jpg|jpeg|png|webp)$/i,
        currentWhiteBackground ? '.jpg' : '.png'
      );
      const outputFile = await outputDir.getFileHandle(outputName, { create: true });
      const writable = await outputFile.createWritable();
      await writable.write(resultBlob);
      await writable.close();

      // Crear preview del resultado
      const processedPreview = data.outputUrl;

      const processingTime = Math.round((Date.now() - startTime) / 1000);
      addLog({
        name: `✅ ${fileName}`,
        status: 'completed',
        time: processingTime,
        originalPreview,
        processedPreview,
        modelUsed: model,
        modelName: modelInfo?.name
      });
      
      setStats(prev => ({
        total: prev.total + 1,
        success: prev.success + 1,
        errors: prev.errors
      }));

      // Limpiar archivo temporal de Firebase Storage (solo el input que subimos)
      try {
        await deleteFile(filePath);
      } catch {
        // Error no crítico al limpiar archivo temporal
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      
      // Mensaje de error amigable según el tipo
      let userFriendlyError = errorMsg;
      if (errorMsg.includes('REPLICATE_API_TOKEN')) {
        userFriendlyError = 'Token de Replicate no configurado';
      } else if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
        userFriendlyError = 'Límite de peticiones alcanzado. Esperando 5 segundos...';
        // Esperar 5 segundos antes de continuar
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else if (errorMsg.includes('storage') || errorMsg.includes('upload')) {
        userFriendlyError = 'Error al subir imagen';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('HTTP')) {
        userFriendlyError = `Error de conexión: ${errorMsg}`;
      } else if (errorMsg.includes('output directory')) {
        userFriendlyError = 'Error al guardar archivo';
      } else if (errorMsg.includes('ERR_HTTP2') || errorMsg.includes('Failed to fetch')) {
        userFriendlyError = 'Error de red al descargar imagen. Verifica tu conexión y las URLs de Firebase.';
      }

      // Preservar preview original para poder reprocesar
      const existingFile = processedFiles.find(f => f.name === fileName);
      const originalPreview = existingFile?.originalPreview;
      
      addLog({ 
        name: `❌ ${fileName}`, 
        status: 'error', 
        error: userFriendlyError, 
        originalPreview 
      });
      setStats(prev => ({
        total: prev.total + 1,
        success: prev.success,
        errors: prev.errors + 1
      }));
    }
  };

  const scanFolder = async () => {
    if (!inputDir || !outputDir) return;

    try {
      let filesFound = 0;
      let newFilesFound = 0;
      
      for await (const entry of inputDir.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          
          if (file.type.startsWith('image/')) {
            filesFound++;
            if (!processedNamesRef.current.has(file.name)) {
              newFilesFound++;
              processedNamesRef.current.add(file.name);
              setTrackedCount(processedNamesRef.current.size);
              // Agregar a la cola en lugar de procesar inmediatamente
              processingQueueRef.current.push({ file, name: file.name });
              console.log(`[FolderWatch] Nueva imagen detectada: ${file.name} (${Math.round(file.size / 1024)}KB)`);
            }
          }
        }
      }
      
      console.log(`[FolderWatch] Escaneo completado: ${filesFound} imágenes totales, ${newFilesFound} nuevas detectadas`);
      
      // Procesar la cola con delay
      if (newFilesFound > 0) {
        processQueue();
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      
      if (errorMsg.includes('permission') || errorMsg.includes('denied')) {
        addLog({ name: '⚠️ Error: Sin permisos para acceder a la carpeta', status: 'error' });
        stopMonitoring();
      } else {
        addLog({ name: `⚠️ Error al escanear carpeta: ${errorMsg}`, status: 'error' });
      }
    }
  };

  const processQueue = async () => {
    if (isProcessingRef.current || processingQueueRef.current.length === 0) return;
    
    isProcessingRef.current = true;
    
    while (processingQueueRef.current.length > 0) {
      // Verificar si el monitoreo sigue activo (permite detener la cola)
      if (!isMonitoringRef.current) {
        // Monitoreo detenido, cancelando cola de procesamiento
        processingQueueRef.current = []; // Limpiar cola
        break;
      }

      const item = processingQueueRef.current.shift();
      if (item) {
        await processImage(item.file, item.name);
        // Delay de 10 segundos entre imágenes (Replicate permite 6 req/min = 1 cada 10s)
        if (processingQueueRef.current.length > 0 && isMonitoringRef.current) {
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
    }
    
    isProcessingRef.current = false;
  };

  const startMonitoring = () => {
    if (!inputDir || !outputDir) {
      error('❌ Selecciona las carpetas primero');
      return;
    }

    // Validar que las carpetas no sean la misma
    if (inputDir.name === outputDir.name) {
      error('❌ Las carpetas de entrada y salida deben ser diferentes');
      return;
    }

    if (!hasReplicateToken) {
      error('❌ Debes configurar tu token de Replicate en Ajustes primero');
      return;
    }

    if (!selectedModel) {
      error('❌ Selecciona un modelo de IA primero');
      return;
    }

    console.log('[FolderWatch] Iniciando monitoreo...');
    console.log(`[FolderWatch] Carpeta monitoreada: ${inputDir.name}`);
    console.log(`[FolderWatch] Archivos ya procesados: ${processedNamesRef.current.size}`);
    
    setIsMonitoring(true);
    isMonitoringRef.current = true;
    addLog({ name: '🚀 Monitoreo iniciado', status: 'completed' });
    info(`🚀 Monitoreo activo con ${selectedModel.name} - Escaneando cada 5 segundos`);
    
    scanFolder();
    
    intervalRef.current = setInterval(() => {
      scanFolder();
    }, 5000);
  };

  const stopMonitoring = () => {
    console.log('[FolderWatch] Deteniendo monitoreo...');
    console.log(`[FolderWatch] Total archivos procesados: ${processedNamesRef.current.size}`);
    
    setIsMonitoring(false);
    isMonitoringRef.current = false;
    addLog({ name: '⏸️ Monitoreo detenido', status: 'completed' });
    info('⏸️ Monitoreo detenido - Cancelando procesamiento pendiente');
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const clearLogs = () => {
    // Liberar Object URLs para prevenir memory leaks
    processedFiles.forEach(file => {
      if (file.originalPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(file.originalPreview);
      }
      if (file.processedPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(file.processedPreview);
      }
    });

    setProcessedFiles([]);
    setStats({ total: 0, success: 0, errors: 0 });
    processedNamesRef.current.clear();
    setTrackedCount(0);
    console.log('[FolderWatch] Registro limpiado - registro de archivos procesados reseteado');
    success('✅ Registro limpiado');
  };

  const forceScan = () => {
    if (!isMonitoring) {
      error('❌ Debes iniciar el monitoreo primero');
      return;
    }
    console.log('[FolderWatch] Escaneo manual forzado...');
    info('🔄 Escaneando carpeta...');
    scanFolder();
  };

  // Cleanup al desmontar: liberar Object URLs y detener monitoreo
  useEffect(() => {
    return () => {
      // Detener monitoreo
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      isMonitoringRef.current = false;

      // Liberar Object URLs para prevenir memory leaks
      processedFiles.forEach(file => {
        if (file.originalPreview?.startsWith('blob:')) {
          URL.revokeObjectURL(file.originalPreview);
        }
        if (file.processedPreview?.startsWith('blob:')) {
          URL.revokeObjectURL(file.processedPreview);
        }
      });
    };
  }, [processedFiles]);

  if (!isSupported) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto mt-8">
        <AlertCircle className="h-5 w-5" />
        <AlertDescription className="ml-2">
          Tu navegador no soporta esta funcionalidad. Usa Chrome, Edge o Brave versión 86 o superior.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header simplificado y moderno */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">
                Auto Monitor
              </h1>
              <p className="text-slate-600">
                Procesa imágenes automáticamente en tiempo real
              </p>
            </div>
            <Tooltip content="Monitorea una carpeta local y procesa automáticamente nuevas imágenes cada 5 segundos" position="right">
              <button className="text-slate-400 hover:text-slate-600 transition-colors">
                <HelpCircle size={20} />
              </button>
            </Tooltip>
          </div>

          <div className="flex items-center gap-4">
            {/* Toggle Fondo Blanco */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700">Fondo Blanco</span>
              <Tooltip content="Guarda las imágenes con fondo blanco en lugar de transparente (JPG)" position="left">
                <button className="text-slate-400 hover:text-slate-600 transition-colors">
                  <HelpCircle size={16} />
                </button>
              </Tooltip>
              <button
                role="switch"
                aria-checked={whiteBackground}
                onClick={() => setWhiteBackground(!whiteBackground)}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                  whiteBackground ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    whiteBackground ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

          </div>
        </div>

        {/* Alerta de monitoreo activo */}
        {isMonitoring && (
          <Alert className="bg-green-50 border-green-300">
            <Activity className="h-5 w-5 text-green-600 animate-pulse" />
            <AlertDescription className="ml-2 text-green-800">
              <strong>Monitoreo en curso</strong> - Escaneando carpeta cada 5 segundos. Las nuevas imágenes se procesarán automáticamente.
            </AlertDescription>
          </Alert>
        )}

        {/* Alerta de configuración de token */}
        {!checkingToken && !hasReplicateToken && (
          <Alert className="bg-amber-50 border-amber-300">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <AlertDescription className="ml-2 flex items-center justify-between">
              <span className="text-amber-800">
                <strong>Configuración requerida:</strong> Necesitas configurar tu token de Replicate en Ajustes para usar esta función.
              </span>
              <Button 
                onClick={() => window.location.href = '/settings'} 
                variant="outline" 
                size="sm"
                className="ml-4 border-amber-400 text-amber-700 hover:bg-amber-100"
              >
                Ir a Ajustes
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Selección de carpetas y modelo */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Input Folder */}
        <Card className="p-6 hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-900 mb-1">Carpeta de Entrada</h3>
            <p className="text-sm text-slate-500">Carpeta donde se encuentran las imágenes</p>
          </div>
          
          <Button
            onClick={selectInputFolder}
            variant="outline"
            className="w-full h-12 justify-start"
            disabled={isMonitoring}
          >
            {inputDir ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                <span className="truncate">{inputDir.name}</span>
              </>
            ) : (
              <>
                <Folder className="w-4 h-4 mr-2" />
                Seleccionar carpeta
              </>
            )}
          </Button>
        </Card>

        {/* Output Folder */}
        <Card className="p-6 hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-900 mb-1">Carpeta de Salida</h3>
            <p className="text-sm text-slate-500">Donde se guardarán las imágenes procesadas</p>
          </div>
          
          <Button
            onClick={selectOutputFolder}
            variant="outline"
            className="w-full h-12 justify-start"
            disabled={isMonitoring}
          >
            {outputDir ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                <span className="truncate">{outputDir.name}</span>
              </>
            ) : (
              <>
                <Folder className="w-4 h-4 mr-2" />
                Seleccionar carpeta
              </>
            )}
          </Button>
        </Card>
      </div>

      {/* Selector de Modelo AI */}
      <Card className="p-6 hover:shadow-md transition-shadow">
        <div className="mb-4">
          <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
            Modelo de IA
            <Tooltip content="Selecciona el modelo que se usará para procesar todas las imágenes" position="right">
              <button className="text-slate-400 hover:text-slate-600 transition-colors">
                <HelpCircle size={16} />
              </button>
            </Tooltip>
          </h3>
          <p className="text-sm text-slate-500">Elige el balance entre costo y calidad</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {bgModels.map((model) => (
            <button
              key={model.id}
              onClick={() => setSelectedModel(model)}
              disabled={isMonitoring}
              className={cn(
                "p-4 rounded-xl border-2 transition-all text-left group hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed",
                selectedModel?.id === model.id
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-slate-200 bg-white hover:shadow-md"
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      className={i < getQualityLevel(model.quality) ? "fill-amber-400 text-amber-400" : "text-slate-300"}
                    />
                  ))}
                </div>
                {selectedModel?.id === model.id && (
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                )}
              </div>
              
              <h4 className="font-medium text-sm text-slate-900 mb-1 truncate">
                {model.name}
              </h4>
              
              <div className="flex items-center gap-1.5 mb-2">
                <DollarSign size={12} className="text-slate-500" />
                <span className="text-xs text-slate-600">{getPricing(model.costPerRun)}</span>
              </div>

              <Badge 
                variant={getQualityLevel(model.quality) >= 4 ? "default" : getQualityLevel(model.quality) >= 3 ? "secondary" : "outline"}
                className="text-xs"
              >
                {getQualityLevel(model.quality) >= 4 ? "Premium" : getQualityLevel(model.quality) >= 3 ? "Estándar" : "Económico"}
              </Badge>
            </button>
          ))}
        </div>
      </Card>

      {/* Controles */}
      <div className="flex gap-3">
        {!isMonitoring ? (
          <Button
            onClick={startMonitoring}
            disabled={!inputDir || !outputDir || !selectedModel}
            className="flex-1 h-12 font-medium"
          >
            <Play className="w-4 h-4 mr-2" />
            Iniciar Monitoreo
          </Button>
        ) : (
          <>
            <Button
              onClick={stopMonitoring}
              variant="destructive"
              className="flex-1 h-12 font-medium"
            >
              <Pause className="w-4 h-4 mr-2" />
              Detener
            </Button>
            <Button
              onClick={forceScan}
              variant="outline"
              className="h-12 px-4"
              title="Forzar escaneo inmediato"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </>
        )}
        <Button
          onClick={clearLogs}
          variant="outline"
          className="h-12 px-4"
          title="Limpiar registro y resetear archivos procesados"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {(!inputDir || !outputDir || !selectedModel) && !isMonitoring ? (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900 text-sm ml-2">
            {!inputDir || !outputDir 
              ? "Selecciona ambas carpetas para continuar" 
              : "Selecciona un modelo de IA para continuar"}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Estadísticas */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-sm text-slate-600">Total</p>
        </Card>

        <Card className="p-4">
          <p className="text-2xl font-bold text-green-600">{stats.success}</p>
          <p className="text-sm text-slate-600">Exitosas</p>
        </Card>

        <Card className="p-4">
          <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
          <p className="text-sm text-slate-600">Errores</p>
        </Card>

        <Card className="p-4">
          <p className="text-2xl font-bold text-blue-600">{trackedCount}</p>
          <p className="text-sm text-slate-600">Rastreados</p>
        </Card>
      </div>

      {/* Grid de Previsualización */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-slate-900">Imágenes Procesadas</h3>
          <span className="text-sm text-slate-500">{processedFiles.length} archivos</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-150 overflow-y-auto pr-2">
          {processedFiles.length === 0 ? (
            <div className="col-span-full text-center py-16 text-slate-400">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Sin imágenes procesadas</p>
              <p className="text-xs text-slate-400 mt-1">Las imágenes aparecerán aquí al ser detectadas</p>
            </div>
          ) : (
            processedFiles.map((file, index) => (
              <div 
                key={index}
                className={cn(
                  "relative group rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg",
                  file.status === 'error' && "border-red-300 bg-red-50",
                  file.status === 'completed' && "border-green-200 bg-white hover:border-green-300",
                  file.status === 'processing' && "border-blue-200 bg-blue-50 animate-pulse"
                )}
              >
                {/* Preview de Imágenes */}
                <div className="aspect-4/3 bg-slate-100 relative overflow-hidden">
                  {file.originalPreview && file.status !== 'processing' ? (
                    <div className="grid grid-cols-2 h-full">
                      {/* Original */}
                      <div className="relative border-r border-slate-200 bg-slate-50 flex items-center justify-center">
                        <img 
                          src={file.originalPreview} 
                          alt="Original" 
                          className="max-w-full max-h-full object-contain"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent py-1 px-2">
                          <span className="text-[10px] text-white font-medium">Original</span>
                        </div>
                      </div>
                      
                      {/* Procesada */}
                      <div className="relative flex items-center justify-center" style={{ 
                        background: whiteBackground 
                          ? '#ffffff' 
                          : 'repeating-conic-gradient(#f1f5f9 0% 25%, #e2e8f0 0% 50%) 50% / 16px 16px'
                      }}>
                        {file.processedPreview && file.status === 'completed' ? (
                          <>
                            <img 
                              src={file.processedPreview} 
                              alt="Procesada" 
                              className="max-w-full max-h-full object-contain"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent py-1 px-2">
                              <span className="text-[10px] text-white font-medium">Sin Fondo</span>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-200">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {file.status === 'processing' ? (
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                      ) : file.originalPreview ? (
                        <img 
                          src={file.originalPreview} 
                          alt="Original" 
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <Activity className="w-10 h-10 text-slate-400" />
                      )}
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-2 left-2 z-10">
                    {file.status === 'processing' && (
                      <Badge className="bg-blue-500 text-white shadow-md">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Procesando
                      </Badge>
                    )}
                    {file.status === 'completed' && (
                      <Badge className="bg-green-500 text-white shadow-md">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Listo
                      </Badge>
                    )}
                    {file.status === 'error' && (
                      <Badge className="bg-red-500 text-white shadow-md">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Error
                      </Badge>
                    )}
                  </div>

                  {/* Botón de reprocesar en hover (solo para errores) */}
                  {file.status === 'error' && file.originalPreview && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        size="sm"
                        className="bg-white text-slate-900 hover:bg-slate-100 shadow-lg"
                        onClick={() => setReprocessingFile(file)}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reprocesar
                      </Button>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-xs font-medium text-slate-900 truncate mb-1" title={file.name}>
                    {file.name.replace(/^(📤|✅|❌)\s*/, '')}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      {file.time && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {file.time}s
                        </span>
                      )}
                      {file.modelName && (
                        <Tooltip content={file.modelName} position="top">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {file.modelName.split(' ')[0]}
                          </Badge>
                        </Tooltip>
                      )}
                    </div>
                  </div>

                  {file.error && (
                    <p className="text-xs text-red-600 mt-2 line-clamp-2" title={file.error}>
                      {file.error}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Modal de Reprocesamiento */}
      {reprocessingFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Reprocesar Imagen</h3>
                  <p className="text-sm text-slate-500 mt-1">{reprocessingFile.name.replace(/^(📤|✅|❌)\s*/, '')}</p>
                </div>
                <button
                  onClick={() => setReprocessingFile(null)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Preview de la imagen con error */}
              {reprocessingFile.originalPreview && (
                <div className="mb-6 rounded-lg overflow-hidden border-2 border-slate-200">
                  <img 
                    src={reprocessingFile.originalPreview} 
                    alt="Vista previa" 
                    className="w-full h-64 object-contain bg-slate-100"
                  />
                </div>
              )}

              <div className="mb-6">
                <p className="text-sm font-medium text-slate-700 mb-3">
                  Selecciona un modelo diferente para reprocesar:
                </p>
                <div className="grid md:grid-cols-2 gap-3">
                  {bgModels
                    .filter(m => m.version !== reprocessingFile.modelUsed)
                    .map((model) => (
                      <button
                        key={model.id}
                        onClick={async () => {
                          const fileName = reprocessingFile.name.replace(/^(📤|✅|❌)\s*/, '');
                          
                          // Recrear el File desde el preview
                          if (reprocessingFile.originalPreview) {
                            try {
                              const response = await fetch(reprocessingFile.originalPreview);
                              const blob = await response.blob();
                              const file = new File([blob], fileName, { type: blob.type });
                              
                              setReprocessingFile(null);
                              await processImage(file, fileName, model.version);
                            } catch {
                              error('❌ Error al reprocesar imagen');
                            }
                          }
                        }}
                        className="p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                size={12}
                                className={i < getQualityLevel(model.quality) ? "fill-amber-400 text-amber-400" : "text-slate-300"}
                              />
                            ))}
                          </div>
                          <Badge 
                            variant={getQualityLevel(model.quality) >= 4 ? "default" : getQualityLevel(model.quality) >= 3 ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {getQualityLevel(model.quality) >= 4 ? "Premium" : getQualityLevel(model.quality) >= 3 ? "Estándar" : "Económico"}
                          </Badge>
                        </div>
                        
                        <h4 className="font-medium text-sm text-slate-900 mb-2">
                          {model.name}
                        </h4>
                        
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <DollarSign size={12} />
                          <span>{getPricing(model.costPerRun)}</span>
                        </div>
                      </button>
                    ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setReprocessingFile(null)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
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
