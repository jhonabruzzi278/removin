import { useState, useEffect, useRef } from 'react';

// Tipos para APIs experimentales del navegador (File System Access + FileSystemObserver)
interface FileSystemObserverEntry {
  type: 'appeared' | 'disappeared' | 'modified' | 'unknown';
  changedHandle: FileSystemHandle;
}
interface FileSystemObserver {
  observe(handle: FileSystemDirectoryHandle, options?: { recursive: boolean }): Promise<void>;
  disconnect(): void;
}
interface FileSystemDirectoryHandleWithPermissions extends FileSystemDirectoryHandle {
  queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}
interface WindowWithFileSystemObserver {
  FileSystemObserver: new (callback: (records: FileSystemObserverEntry[]) => void) => FileSystemObserver;
}
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
  RefreshCw, Star, Clock, Zap
} from 'lucide-react';

export default function FolderWatchPage() {
  const { user, hasToken, checkingToken } = useAuth();
  const { toasts, dismiss, success, error, info } = useToast();
  const [inputDir, setInputDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [outputDir, setOutputDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [stats, setStats] = useState({ total: 0, success: 0, errors: 0 });
  const [trackedCount, setTrackedCount] = useState(0);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [whiteBackground, setWhiteBackground] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [useObserver, setUseObserver] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<FileSystemObserver | null>(null);
  const processedNamesRef = useRef<Set<string>>(new Set());
  const snapshotRef = useRef<Set<string>>(new Set());
  const processingQueueRef = useRef<Array<{ file?: File; handle?: FileSystemFileHandle; name: string }>>([]);
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
  const lastScanTimeMs = lastScanTime?.getTime();
  useEffect(() => {
    if (!isMonitoring || lastScanTimeMs == null) return;
    
    const interval = setInterval(() => {
      // Forzar re-render para actualizar "hace X segundos"
      setLastScanTime(prev => prev ? new Date(prev.getTime()) : null);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isMonitoring, lastScanTimeMs]);

  // RF-3: Restaurar carpetas guardadas desde IndexedDB al montar
  useEffect(() => {
    const restoreFolders = async () => {
      try {
        const inputHandle = await get<FileSystemDirectoryHandle>('folderwatch-input');
        const outputHandle = await get<FileSystemDirectoryHandle>('folderwatch-output');
        
        if (inputHandle) {
          // Verificar y solicitar permisos si es necesario
          const h = inputHandle as FileSystemDirectoryHandleWithPermissions;
          const inputPermission = await h.queryPermission({ mode: 'read' });
          if (inputPermission === 'granted' || inputPermission === 'prompt') {
            if (inputPermission === 'prompt') {
              const granted = await h.requestPermission({ mode: 'read' });
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
          const h = outputHandle as FileSystemDirectoryHandleWithPermissions;
          const outputPermission = await h.queryPermission({ mode: 'readwrite' });
          if (outputPermission === 'granted' || outputPermission === 'prompt') {
            if (outputPermission === 'prompt') {
              const granted = await h.requestPermission({ mode: 'readwrite' });
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
      } catch {
        // No se pudieron restaurar carpetas (no existen o permisos revocados)
      } finally {
        setIsRestoring(false);
      }
    };
    
    if (isSupported) {
      restoreFolders();
    } else {
      setIsRestoring(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- info e isSupported son valores estables que no cambian entre renders
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

  const waitForFileReady = async (handle: FileSystemFileHandle): Promise<File> => {
    let prevFile = await handle.getFile();
    let retries = 0;
    
    // Esperar hasta que el archivo termine de copiarse al disco (máximo 10 segundos)
    while (retries < 20) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const currFile = await handle.getFile();
      
      // Si el tamaño es mayor a 0, y no ha mutado desde la última comprobación, está listo.
      if (currFile.size > 0 && 
          currFile.size === prevFile.size && 
          currFile.lastModified === prevFile.lastModified) {
        return currFile; 
      }
      
      prevFile = currFile;
      retries++;
    }
    return prevFile;
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
      
      for await (const entry of inputDir.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          if (file.type.startsWith('image/')) {
            snapshot.add(file.name);
          }
        }
      }
      
      snapshotRef.current = snapshot;
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
      return;
    }
    
    if (!isMonitoringRef.current) {
      return;
    }
    
    const scanTime = new Date();
    const scanNumber = scanCount + 1;
    setScanCount(scanNumber);
    setLastScanTime(scanTime);

    try {
      let newFilesFound = 0;
      
      for await (const entry of inputDir.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          
          if (file.type.startsWith('image/')) {
            const inSnapshot = snapshotRef.current.has(file.name);
            const inProcessed = processedNamesRef.current.has(file.name);
            
            // RF-2: Solo procesar si NO está en el snapshot inicial
            if (!inSnapshot && !inProcessed) {
              newFilesFound++;
              processedNamesRef.current.add(file.name);
              setTrackedCount(processedNamesRef.current.size);
              processingQueueRef.current.push({ handle: entry, name: file.name });
            }
          }
        }
      }
      
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
      if (!isMonitoringRef.current) {
        processingQueueRef.current = []; // Limpiar cola si se detuvo
        break;
      }

      const item = processingQueueRef.current.shift();
      if (item) {
        try {
          // Obtener el archivo fresco y estable (espera a que OS termine de copiarlo)
          let fileToProcess = item.file;
          if (item.handle) {
            fileToProcess = await waitForFileReady(item.handle);
          }
          
          if (fileToProcess) {
            await processImage(fileToProcess, item.name);
          }
        } catch (err) {
          console.error("Error al estabilizar archivo:", err);
        }

        // Delay de seguridad entre imágenes para no saturar Replicate
        if (processingQueueRef.current.length > 0 && isMonitoringRef.current) {
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
    }
    
    isProcessingRef.current = false;
  };

  const startMonitoring = async () => {
    if (!inputDir || !outputDir) {
      error('❌ Selecciona las carpetas primero');
      return;
    }

    if (inputDir.name === outputDir.name) {
      error('❌ Las carpetas de entrada y salida deben ser diferentes');
      return;
    }

    if (!hasToken) {
      error('❌ Debes configurar tu token de Replicate en Ajustes primero');
      return;
    }

    if (!selectedModel) {
      error('❌ Selecciona un modelo de IA primero');
      return;
    }
    
    setIsMonitoring(true);
    isMonitoringRef.current = true;
    setScanCount(0);
    success('🚀 Monitoreo iniciado');
    
    // RF-2: Crear snapshot de archivos existentes
    const existingCount = await createSnapshot();
    info(`📸 Snapshot creado: ${existingCount} archivos existentes ignorados`);
    
    // RF-1: Intentar usar FileSystemObserver si está disponible
    if (hasObserverAPI && typeof (self as unknown as WindowWithFileSystemObserver).FileSystemObserver !== 'undefined') {
      try {
        const Observer = (self as unknown as WindowWithFileSystemObserver).FileSystemObserver;
        const observer = new Observer(async (records: FileSystemObserverEntry[]) => {
          let hasNewFiles = false;

          for (const record of records) {
            
            // RF-1: Solo reaccionar a archivos nuevos (appeared)
            if (record.type === 'appeared' || record.type === 'modified') {
              try {
                // CORRECCIÓN: Usar changedHandle, no root
                const handle = record.changedHandle;
                if (handle && handle.kind === 'file') {
                  const file = await (handle as FileSystemFileHandle).getFile();
                  
                  if (file.type.startsWith('image/') && !processedNamesRef.current.has(file.name)) {
                    processedNamesRef.current.add(file.name);
                    setTrackedCount(processedNamesRef.current.size);
                    processingQueueRef.current.push({ handle: handle as FileSystemFileHandle, name: file.name });
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
          if (scanFolderRef.current) scanFolderRef.current();
        }, 10000);
        
      } catch (err) {
        console.error('Error al inicializar FileSystemObserver:', err);
        // Caer al fallback
        setUseObserver(false);
        info(`🚀 Monitoreo activo con ${selectedModel.name} - Escaneando cada 3 segundos`);
        
        if (scanFolderRef.current) scanFolderRef.current();
        
        intervalRef.current = setInterval(() => {
          if (scanFolderRef.current) scanFolderRef.current();
        }, 3000);
      }
    } else {
      // RF-2: Fallback con polling optimizado
      setUseObserver(false);
      info(`🚀 Monitoreo activo con ${selectedModel.name} - Escaneando cada 3 segundos`);
      
      if (scanFolderRef.current) scanFolderRef.current();
      
      intervalRef.current = setInterval(() => {
        if (scanFolderRef.current) scanFolderRef.current();
      }, 3000);
    }
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    isMonitoringRef.current = false;
    info('⏸️ Monitoreo detenido');
    
    // RF-1: Desconectar FileSystemObserver si está activo
    if (observerRef.current) {
      try {
        observerRef.current.disconnect();
        observerRef.current = null;
      } catch (err) {
        console.error('Error al desconectar observer:', err);
      }
    }
    
    // Limpiar intervalo si existe
    if (intervalRef.current) {
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
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-rose-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Navegador no compatible</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Esta función requiere Chrome, Edge o Brave versión 86 o superior con soporte para la API del sistema de archivos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 pb-10">

      {/* ── Header ── */}
      <div className="pt-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Título */}
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-indigo-200">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">Auto Monitor</h1>
                <Tooltip content="Monitorea una carpeta y procesa automáticamente las imágenes nuevas que detecte" position="right">
                  <button className="text-slate-400 hover:text-slate-600 transition-colors">
                    <HelpCircle size={16} />
                  </button>
                </Tooltip>
              </div>
              <p className="text-sm font-medium text-slate-500 mt-0.5">
                Detección automática · Procesamiento en cola · Sin intervención manual
              </p>
            </div>
          </div>

          {/* Toggle Fondo Blanco */}
          <div className="flex items-center gap-2.5 bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 self-start shadow-sm">
            <div className="w-4 h-4 rounded-full border-2 border-slate-500 bg-white flex-shrink-0" />
            <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">Fondo Blanco</span>
            <Tooltip content="Guarda las imágenes con fondo blanco (JPG) en lugar de transparente (PNG)" position="left">
              <button className="text-slate-400 hover:text-slate-600 transition-colors">
                <HelpCircle size={14} />
              </button>
            </Tooltip>
            <button
              role="switch"
              aria-checked={whiteBackground}
              onClick={() => setWhiteBackground(!whiteBackground)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                whiteBackground ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  whiteBackground ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── Alertas de estado ── */}
      <div className="space-y-3">
        {/* Restaurando */}
        {isRestoring && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-100 border-2 border-indigo-300">
            <Loader2 className="h-4 w-4 text-indigo-700 animate-spin flex-shrink-0" />
            <p className="text-sm font-medium text-indigo-900">
              <span className="font-bold">Restaurando carpetas</span> guardadas anteriormente…
            </p>
          </div>
        )}

        {/* Monitoreo activo */}
        {isMonitoring && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl bg-emerald-100 border-2 border-emerald-400">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="relative flex h-3 w-3 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-emerald-900">Monitoreo activo</span>
                  {useObserver ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                      <Zap size={10} />Observer + Respaldo 10s
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                      <Clock size={10} />Escaneo cada 3s
                    </span>
                  )}
                </div>
                {!useObserver && lastScanTime && (
                  <p className="text-xs font-medium text-emerald-800 mt-0.5">
                    Último escaneo: {getTimeSinceLastScan()} · #{scanCount}
                  </p>
                )}
                {useObserver && (
                  <p className="text-xs font-medium text-emerald-800 mt-0.5">
                    Detección instantánea con escaneo de respaldo cada 10 segundos
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Token no configurado */}
        {!checkingToken && !hasToken && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl bg-amber-100 border-2 border-amber-400">
            <AlertCircle className="h-4 w-4 text-amber-700 flex-shrink-0" />
            <p className="text-sm font-medium text-amber-900 flex-1">
              <span className="font-bold">Token requerido:</span> Configura tu token de Replicate para usar esta función.
            </p>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <button
                onClick={() => window.location.href = '/settings'}
                className="text-xs font-bold text-amber-900 underline underline-offset-2 hover:text-amber-700 whitespace-nowrap"
              >
                Ir a Ajustes →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Carpetas ── */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Entrada */}
        <div className={cn(
          "group rounded-2xl border-2 transition-all duration-200 overflow-hidden",
          inputDir
            ? "border-emerald-500 bg-emerald-100"
            : "border-dashed border-slate-300 bg-white hover:border-indigo-500 hover:bg-indigo-50",
          isMonitoring && "pointer-events-none grayscale"
        )}>
          <button
            onClick={selectInputFolder}
            disabled={isMonitoring}
            className="w-full p-5 text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                inputDir ? "bg-emerald-500" : "bg-slate-100 group-hover:bg-indigo-200"
              )}>
                {inputDir
                  ? <CheckCircle2 className="w-5 h-5 text-white" />
                  : <Folder className="w-5 h-5 text-slate-600 group-hover:text-indigo-700" />
                }
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">Entrada</p>
                <p className={cn(
                  "text-sm font-bold truncate",
                  inputDir ? "text-emerald-900" : "text-slate-700"
                )}>
                  {inputDir ? inputDir.name : "Seleccionar carpeta"}
                </p>
              </div>
            </div>
            <p className={cn("text-xs font-medium", inputDir ? "text-emerald-700" : "text-slate-500")}>
              {inputDir ? "Carpeta de origen configurada ✓" : "Imágenes nuevas aquí serán procesadas automáticamente"}
            </p>
          </button>
        </div>

        {/* Salida */}
        <div className={cn(
          "group rounded-2xl border-2 transition-all duration-200 overflow-hidden",
          outputDir
            ? "border-indigo-500 bg-indigo-100"
            : "border-dashed border-slate-300 bg-white hover:border-indigo-500 hover:bg-indigo-50",
          isMonitoring && "pointer-events-none grayscale"
        )}>
          <button
            onClick={selectOutputFolder}
            disabled={isMonitoring}
            className="w-full p-5 text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                outputDir ? "bg-indigo-600" : "bg-slate-100 group-hover:bg-indigo-200"
              )}>
                {outputDir
                  ? <CheckCircle2 className="w-5 h-5 text-white" />
                  : <Folder className="w-5 h-5 text-slate-600 group-hover:text-indigo-700" />
                }
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">Salida</p>
                <p className={cn(
                  "text-sm font-bold truncate",
                  outputDir ? "text-indigo-900" : "text-slate-700"
                )}>
                  {outputDir ? outputDir.name : "Seleccionar carpeta"}
                </p>
              </div>
            </div>
            <p className={cn("text-xs font-medium", outputDir ? "text-indigo-700" : "text-slate-500")}>
              {outputDir ? "Carpeta de destino configurada ✓" : "Las imágenes procesadas se guardarán aquí"}
            </p>
          </button>
        </div>
      </div>

      {/* ── Selector de Modelo ── */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b-2 border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Modelo de IA</h2>
            <Tooltip content="Selecciona el modelo que se usará para eliminar el fondo de todas las imágenes" position="right">
              <button className="text-slate-400 hover:text-slate-600 transition-colors">
                <HelpCircle size={14} />
              </button>
            </Tooltip>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-0.5">Elige el equilibrio entre velocidad, calidad y costo</p>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {bgModels.map((model) => {
            const quality = getQualityLevel(model.quality);
            const tier = quality >= 4 ? "Premium" : quality >= 3 ? "Estándar" : "Económico";
            const tierColor = quality >= 4
              ? "bg-violet-600 text-white"
              : quality >= 3
              ? "bg-blue-600 text-white"
              : "bg-slate-600 text-white";
            const isSelected = selectedModel?.id === model.id;

            return (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model)}
                disabled={isMonitoring}
                className={cn(
                  "relative p-4 rounded-xl border-2 text-left transition-all duration-150 disabled:grayscale disabled:cursor-not-allowed",
                  isSelected
                    ? "border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100"
                    : "border-slate-200 bg-white hover:border-indigo-400 hover:shadow-sm"
                )}
              >
                {isSelected && (
                  <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shadow">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </span>
                )}

                <div className="flex items-center gap-0.5 mb-2.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      className={i < quality ? "fill-amber-400 text-amber-400" : "text-slate-300 fill-slate-200"}
                    />
                  ))}
                </div>

                <p className="text-sm font-bold text-slate-900 leading-snug mb-2 pr-5">
                  {model.name}
                </p>

                <div className="flex items-center justify-between">
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", tierColor)}>
                    {tier}
                  </span>
                  <span className="text-xs font-bold font-mono text-slate-700">{getPricing(model.costPerRun)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Aviso de configuración pendiente ── */}
      {(!inputDir || !outputDir || !selectedModel || (!checkingToken && !hasToken)) && !isMonitoring && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-100 border-2 border-slate-300">
          <Info className="h-4 w-4 text-slate-600 flex-shrink-0" />
          <p className="text-sm font-medium text-slate-700">
            {!inputDir || !outputDir
              ? "Selecciona la carpeta de entrada y salida para continuar"
              : !selectedModel
              ? "Selecciona un modelo de IA para continuar"
              : "Configura tu token de Replicate en Ajustes para continuar"}
          </p>
        </div>
      )}

      {/* ── Controles ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!isMonitoring ? (
          <button
            onClick={startMonitoring}
            disabled={!inputDir || !outputDir || !selectedModel || !hasToken || checkingToken}
            className="flex-1 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-bold tracking-wide transition-all duration-150 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Play className="w-4 h-4" />
            Iniciar Monitoreo
          </button>
        ) : (
          <>
            <button
              onClick={stopMonitoring}
              className="flex-1 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-sm font-bold tracking-wide transition-all duration-150 shadow-md shadow-rose-200 hover:shadow-lg hover:shadow-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
            >
              <Pause className="w-4 h-4" />
              Detener Monitoreo
            </button>
            <Tooltip content="Forzar escaneo inmediato de la carpeta" position="top">
              <button
                onClick={forceScan}
                className="inline-flex items-center justify-center h-12 w-12 rounded-xl border-2 border-slate-300 bg-white hover:border-indigo-600 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </Tooltip>
          </>
        )}
        <Tooltip content="Reiniciar estadísticas y lista de archivos procesados" position="top">
          <button
            onClick={resetStats}
            className="inline-flex items-center justify-center h-12 w-12 rounded-xl border-2 border-slate-300 bg-white hover:border-rose-500 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* ── Estadísticas ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-slate-950", bg: "bg-slate-100", border: "border-slate-400", icon: <Activity className="w-4 h-4 text-slate-600" /> },
          { label: "Exitosas", value: stats.success, color: "text-emerald-900", bg: "bg-emerald-100", border: "border-emerald-500", icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" /> },
          { label: "Errores", value: stats.errors, color: "text-rose-900", bg: "bg-rose-100", border: "border-rose-500", icon: <AlertCircle className="w-4 h-4 text-rose-600" /> },
          { label: "Rastreados", value: trackedCount, color: "text-indigo-900", bg: "bg-indigo-100", border: "border-indigo-500", icon: <Folder className="w-4 h-4 text-indigo-600" /> },
        ].map(({ label, value, color, bg, border, icon }) => (
          <div key={label} className={cn("rounded-2xl border-2 p-4 flex flex-col gap-2", bg, border)}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{label}</span>
              {icon}
            </div>
            <span className={cn("text-4xl font-black tracking-tight", color)}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── Toasts ── */}
      <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => dismiss(toast.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
