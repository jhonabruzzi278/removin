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
import { get, set } from 'idb-keyval';
import {
  Folder, Play, Pause, Trash2, CheckCircle2,
  AlertCircle, Loader2, Info, Activity, HelpCircle, 
  RefreshCw, Star, Clock, DollarSign, Zap
} from 'lucide-react';

export default function FolderWatchPage() {
  const { user } = useAuth();
  const { toasts, dismiss, success, error, info } = useToast();
  const [inputDir, setInputDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [outputDir, setOutputDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [stats, setStats] = useState({ total: 0, success: 0, errors: 0 });
  const [trackedCount, setTrackedCount] = useState(0);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [whiteBackground, setWhiteBackground] = useState(false);
  const [hasReplicateToken, setHasReplicateToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [useObserver, setUseObserver] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<any>(null);
  const processedNamesRef = useRef<Set<string>>(new Set());
  const snapshotRef = useRef<Set<string>>(new Set());
  const processingQueueRef = useRef<Array<{ file: File; name: string }>>([]);
  const isProcessingRef = useRef(false);
  const isMonitoringRef = useRef(false);
  const whiteBackgroundRef = useRef(whiteBackground);
  const selectedModelRef = useRef(selectedModel);
  
  // Nuevos Refs para evitar Stale Closures en los intervalos
  const scanFolderRef = useRef<(() => Promise<void>) | null>(null);
  const processQueueRefFunc = useRef<(() => Promise<void>) | null>(null);

  const isSupported = 'showDirectoryPicker' in window;
  const hasObserverAPI = 'FileSystemObserver' in self;
  
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

  // Mantener las referencias siempre apuntando a la versión más reciente
  useEffect(() => {
    scanFolderRef.current = scanFolder;
    processQueueRefFunc.current = processQueue;
  });

  // Actualizar UI cada segundo para mostrar tiempo desde último escaneo
  useEffect(() => {
    if (!isMonitoring || !lastScanTime) return;
    
    const interval = setInterval(() => {
      // Forzar re-render para actualizar "hace X segundos"
      setLastScanTime(prev => prev ? new Date(prev.getTime()) : null);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isMonitoring, lastScanTime?.getTime()]);

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

  // RF-3: Restaurar carpetas guardadas desde IndexedDB al montar
  useEffect(() => {
    const restoreFolders = async () => {
      try {
        const inputHandle = await get<FileSystemDirectoryHandle>('folderwatch-input');
        const outputHandle = await get<FileSystemDirectoryHandle>('folderwatch-output');
        
        if (inputHandle) {
          // Verificar y solicitar permisos si es necesario
          const inputPermission = await (inputHandle as any).queryPermission({ mode: 'read' });
          if (inputPermission === 'granted' || inputPermission === 'prompt') {
            if (inputPermission === 'prompt') {
              const granted = await (inputHandle as any).requestPermission({ mode: 'read' });
              if (granted === 'granted') {
                setInputDir(inputHandle);
                info('📁 Carpeta de entrada restaurada');
              }
            } else {
              setInputDir(inputHandle);
              info('📁 Carpeta de entrada restaurada');
            }
          }
        }
        
        if (outputHandle) {
          const outputPermission = await (outputHandle as any).queryPermission({ mode: 'readwrite' });
          if (outputPermission === 'granted' || outputPermission === 'prompt') {
            if (outputPermission === 'prompt') {
              const granted = await (outputHandle as any).requestPermission({ mode: 'readwrite' });
              if (granted === 'granted') {
                setOutputDir(outputHandle);
                info('💾 Carpeta de salida restaurada');
              }
            } else {
              setOutputDir(outputHandle);
              info('💾 Carpeta de salida restaurada');
            }
          }
        }
      } catch (err) {
        // Error al restaurar carpetas (puede ser que no existan o permisos revocados)
        console.log('No se pudieron restaurar carpetas guardadas');
      } finally {
        setIsRestoring(false);
      }
    };
    
    if (isSupported) {
      restoreFolders();
    } else {
      setIsRestoring(false);
    }
  }, []);

  const selectInputFolder = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      setInputDir(dirHandle);
      // RF-3: Guardar en IndexedDB para persistencia
      await set('folderwatch-input', dirHandle);
      success(`✅ Carpeta de entrada seleccionada: ${dirHandle.name}`);
    } catch (err) {
      if (err instanceof Error && !err.message.includes('aborted')) {
        error('❌ Error al seleccionar carpeta de entrada');
      }
    }
  };

  const getTimeSinceLastScan = () => {
    if (!lastScanTime) return '';
    const seconds = Math.floor((Date.now() - lastScanTime.getTime()) / 1000);
    if (seconds < 5) return 'ahora mismo';
    return `hace ${seconds}s`;
  };

  const selectOutputFolder = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setOutputDir(dirHandle);
      // RF-3: Guardar en IndexedDB para persistencia
      await set('folderwatch-output', dirHandle);
      success(`✅ Carpeta de salida seleccionada: ${dirHandle.name}`);
    } catch (err) {
      if (err instanceof Error && !err.message.includes('aborted')) {
        error('❌ Error al seleccionar carpeta de salida');
      }
    }
  };

  const processImage = async (file: File, fileName: string, modelVersion?: string) => {
    const startTime = Date.now();
    // Usar refs para obtener valores actuales (evitar stale closures)
    const model = modelVersion || selectedModelRef.current?.version;
    const currentWhiteBackground = whiteBackgroundRef.current;
    
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

      const processingTime = Math.round((Date.now() - startTime) / 1000);
      success(`✅ ${fileName} procesada (${processingTime}s)`);
      
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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      
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

      error(`❌ ${fileName}: ${userFriendlyError}`);
      
      setStats(prev => ({
        total: prev.total + 1,
        success: prev.success,
        errors: prev.errors + 1
      }));
    }
  };

  // RF-2: Crear snapshot inicial de archivos existentes (para ignorarlos)
  const createSnapshot = async () => {
    if (!inputDir) return;
    
    try {
      const snapshot = new Set<string>();
      console.log('[Snapshot] Creando snapshot de archivos existentes...');
      
      for await (const entry of inputDir.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          if (file.type.startsWith('image/')) {
            snapshot.add(file.name);
            console.log(`[Snapshot] Agregado a ignorar: ${file.name}`);
          }
        }
      }
      
      snapshotRef.current = snapshot;
      console.log(`[Snapshot] Snapshot completado: ${snapshot.size} archivos serán ignorados`);
      info(`📸 Snapshot creado: ${snapshot.size} archivos existentes serán ignorados`);
      return snapshot.size;
    } catch (err) {
      console.error('Error al crear snapshot:', err);
      return 0;
    }
  };

  // RF-2: Escaneo optimizado que compara contra snapshot (solo para fallback)
  const scanFolder = async () => {
    if (!inputDir || !outputDir) {
      console.log('[Escaneo] Cancelado: falta inputDir o outputDir');
      return;
    }
    
    if (!isMonitoringRef.current) {
      console.log('[Escaneo] Cancelado: monitoreo no activo');
      return;
    }
    
    const scanTime = new Date();
    const scanNumber = scanCount + 1;
    setScanCount(scanNumber);
    setLastScanTime(scanTime);

    try {
      let filesFound = 0;
      let newFilesFound = 0;
      
      console.log(`[Escaneo #${scanNumber}] Iniciando escaneo...`);
      
      for await (const entry of inputDir.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          
          if (file.type.startsWith('image/')) {
            filesFound++;
            
            const inSnapshot = snapshotRef.current.has(file.name);
            const inProcessed = processedNamesRef.current.has(file.name);
            
            console.log(`[Escaneo] Archivo: ${file.name} - inSnapshot: ${inSnapshot}, inProcessed: ${inProcessed}`);
            
            // RF-2: Solo procesar si NO está en el snapshot inicial
            if (!inSnapshot && !inProcessed) {
              newFilesFound++;
              processedNamesRef.current.add(file.name);
              setTrackedCount(processedNamesRef.current.size);
              processingQueueRef.current.push({ file, name: file.name });
              console.log(`[Escaneo] ✅ Archivo NUEVO detectado: ${file.name}`);
            }
          }
        }
      }
      
      console.log(`[Escaneo #${scanNumber}] Completado - Total imágenes: ${filesFound}, Nuevas: ${newFilesFound}`);
      
      if (newFilesFound > 0) {
        info(`🔍 Detectados ${newFilesFound} archivo(s) nuevo(s)`);
        processQueue();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      
      if (errorMsg.includes('permission') || errorMsg.includes('denied')) {
        error('⚠️ Error: Sin permisos para acceder a la carpeta');
        stopMonitoring();
      } else {
        error(`⚠️ Error al escanear carpeta: ${errorMsg}`);
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

  const startMonitoring = async () => {
    console.log('[Start] Iniciando monitoreo...');
    
    if (!inputDir || !outputDir) {
      error('❌ Selecciona las carpetas primero');
      return;
    }

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
    
    console.log('[Start] Configurando estados...');
    setIsMonitoring(true);
    isMonitoringRef.current = true;
    setScanCount(0);
    success('🚀 Monitoreo iniciado');
    
    // RF-2: Crear snapshot de archivos existentes
    console.log('[Start] Creando snapshot...');
    const existingCount = await createSnapshot();
    info(`📸 Snapshot creado: ${existingCount} archivos existentes ignorados`);
    
    // RF-1: Intentar usar FileSystemObserver si está disponible
    console.log('[Start] Verificando FileSystemObserver API...');
    console.log('[Start] hasObserverAPI:', hasObserverAPI);
    
    if (hasObserverAPI && typeof (self as any).FileSystemObserver !== 'undefined') {
      console.log('[Start] FileSystemObserver disponible, intentando usar...');
      try {
        const Observer = (self as any).FileSystemObserver;
        const observer = new Observer(async (records: any[]) => {
          console.log(`[Observer] Callback ejecutado con ${records.length} registro(s)`);
          
          let hasNewFiles = false;

          for (const record of records) {
            console.log(`[Observer] Evento tipo: ${record.type}`);
            
            // RF-1: Solo reaccionar a archivos nuevos (appeared)
            if (record.type === 'appeared' || record.type === 'modified') {
              try {
                // CORRECCIÓN: Usar changedHandle, no root
                const handle = record.changedHandle;
                if (handle && handle.kind === 'file') {
                  const file = await handle.getFile();
                  console.log(`[Observer] Archivo detectado: ${file.name}`);
                  
                  if (file.type.startsWith('image/') && !processedNamesRef.current.has(file.name)) {
                    console.log(`[Observer] ✅ Archivo NUEVO vía Observer: ${file.name}`);
                    processedNamesRef.current.add(file.name);
                    setTrackedCount(processedNamesRef.current.size);
                    processingQueueRef.current.push({ file, name: file.name });
                    hasNewFiles = true;
                  }
                }
              } catch (err) {
                console.error('Error procesando evento del observer:', err);
              }
            }
            // Si el sistema pierde eventos, el SO arroja "unknown" y debemos hacer escaneo manual
            else if (record.type === 'unknown') {
              if (scanFolderRef.current) scanFolderRef.current();
            }
          }

          if (hasNewFiles && processQueueRefFunc.current) {
            processQueueRefFunc.current();
          }
        });
        
        await observer.observe(inputDir, { recursive: false });
        observerRef.current = observer;
        setUseObserver(true);
        info(`⚡ Observer activo + Polling de respaldo cada 10s`);
        
        // Polling de respaldo configurado cada 10s usando la referencia actualizada
        intervalRef.current = setInterval(() => {
          console.log('[Observer+Polling] Escaneo de respaldo automático');
          if (scanFolderRef.current) scanFolderRef.current();
        }, 10000);
        
      } catch (err) {
        console.error('Error al inicializar FileSystemObserver:', err);
        // Caer al fallback
        setUseObserver(false);
        info(`🚀 Monitoreo activo con ${selectedModel.name} - Escaneando cada 3 segundos`);
        
        if (scanFolderRef.current) scanFolderRef.current();
        
        intervalRef.current = setInterval(() => {
          console.log('[Polling] Ejecutando escaneo automático desde setInterval');
          if (scanFolderRef.current) scanFolderRef.current();
        }, 3000);
      }
    } else {
      // RF-2: Fallback con polling optimizado
      console.log('[Start] FileSystemObserver NO disponible, usando polling');
      setUseObserver(false);
      info(`🚀 Monitoreo activo con ${selectedModel.name} - Escaneando cada 3 segundos`);
      
      if (scanFolderRef.current) scanFolderRef.current();
      
      intervalRef.current = setInterval(() => {
        console.log('[Polling] Ejecutando escaneo automático desde setInterval');
        if (scanFolderRef.current) scanFolderRef.current();
      }, 3000);
    }
  };

  const stopMonitoring = () => {
    console.log('[Stop] Deteniendo monitoreo...');
    setIsMonitoring(false);
    isMonitoringRef.current = false;
    info('⏸️ Monitoreo detenido');
    
    // RF-1: Desconectar FileSystemObserver si está activo
    if (observerRef.current) {
      try {
        console.log('[Stop] Desconectando Observer');
        observerRef.current.disconnect();
        observerRef.current = null;
      } catch (err) {
        console.error('Error al desconectar observer:', err);
      }
    }
    
    // Limpiar intervalo si existe
    if (intervalRef.current) {
      console.log('[Stop] Limpiando intervalo:', intervalRef.current);
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setUseObserver(false);
  };

  const resetStats = () => {
    setStats({ total: 0, success: 0, errors: 0 });
    processedNamesRef.current.clear();
    snapshotRef.current.clear();
    processingQueueRef.current = [];
    setTrackedCount(0);
    success('✅ Estadísticas reiniciadas');
  };

  const forceScan = () => {
    if (!isMonitoring) {
      error('❌ Debes iniciar el monitoreo primero');
      return;
    }
    console.log('[ForceScan] Escaneo manual forzado por usuario');
    info('🔄 Escaneando carpeta...');
    scanFolder();
  };

  // Cleanup al desmontar: detener monitoreo y desconectar observer
  useEffect(() => {
    return () => {
      // RF-1: Desconectar FileSystemObserver
      if (observerRef.current) {
        try {
          observerRef.current.disconnect();
        } catch (err) {
          console.error('Error al desconectar observer en cleanup:', err);
        }
      }
      
      // Detener monitoreo
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      isMonitoringRef.current = false;
    };
  }, []);

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

        {/* Alerta de restauración de carpetas */}
        {isRestoring && (
          <Alert className="bg-blue-50 border-blue-300">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            <AlertDescription className="ml-2 text-blue-800">
              <strong>Restaurando carpetas...</strong> Verificando carpetas guardadas previamente.
            </AlertDescription>
          </Alert>
        )}

        {/* Alerta de monitoreo activo */}
        {isMonitoring && (
          <Alert className="bg-green-50 border-green-300">
            <Activity className="h-5 w-5 text-green-600 animate-pulse" />
            <AlertDescription className="ml-2 text-green-800 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <strong>Monitoreo en curso</strong>
                  {useObserver ? (
                    <Badge className="bg-emerald-500 text-white text-xs flex items-center gap-1">
                      <Zap size={10} />
                      Observer + Respaldo 10s
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-500 text-white text-xs flex items-center gap-1">
                      <Clock size={10} />
                      Escaneo 3s
                    </Badge>
                  )}
                </div>
                {useObserver ? (
                  <p className="text-xs">
                    Usando FileSystemObserver con polling de respaldo cada 10 segundos para máxima confiabilidad.
                  </p>
                ) : (
                  <>
                    <p className="text-xs">Escaneando carpeta cada 3 segundos. Las nuevas imágenes se procesarán automáticamente.</p>
                    {lastScanTime && (
                      <div className="text-xs text-green-700 mt-1 flex items-center gap-2">
                        <Clock size={12} />
                        <span>Último escaneo: {getTimeSinceLastScan()} (Escaneo #{scanCount})</span>
                      </div>
                    )}
                  </>
                )}
              </div>
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
          onClick={resetStats}
          variant="outline"
          className="h-12 px-4"
          title="Reiniciar estadísticas y archivos procesados"
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
