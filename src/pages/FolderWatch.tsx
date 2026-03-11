import { useState, useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';
import { Toast } from '@/components/ui/toast';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { useDirectoryObserver } from '@/hooks/useDirectoryObserver';
import { useFolderWatchProcessor } from '@/hooks/useFolderWatchProcessor';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { availableModels, type AIModel } from '@/data/models';
import { FolderWatchHeader } from '@/components/folderwatch/FolderWatchHeader';
import { FolderWatchAlerts } from '@/components/folderwatch/FolderWatchAlerts';
import { FolderSelector } from '@/components/folderwatch/FolderSelector';
import { ModelSelector } from '@/components/folderwatch/ModelSelector';
import { ConfigurationWarning } from '@/components/folderwatch/ConfigurationWarning';
import { FolderWatchControls } from '@/components/folderwatch/FolderWatchControls';
import { FolderWatchStats } from '@/components/folderwatch/FolderWatchStats';
import { AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FolderWatchPage() {
  const { user, hasToken, checkingToken, refreshTokenStatus } = useAuth();
  const { toasts, dismiss, success, error, info } = useToast();
  
  // Custom hooks para separar concerns
  const directoryObserver = useDirectoryObserver({
    onInfo: info,
    onError: error,
    onSuccess: success,
  });
  
  const imageProcessor = useFolderWatchProcessor({
    onSuccess: success,
    onError: error,
    user,
  });

  // Estados
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [stats, setStats] = useState({ total: 0, success: 0, errors: 0 });
  const [trackedCount, setTrackedCount] = useState(0);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [whiteBackground, setWhiteBackground] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [useObserver, setUseObserver] = useState(false);
  const [wasMonitoringBefore, setWasMonitoringBefore] = useState(false);
  const [configRestored, setConfigRestored] = useState(false);
  
  // Refs - declaradas antes del hook de visibilidad para evitar problemas de orden
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const processedNamesRef = useRef<Set<string>>(new Set());
  const snapshotRef = useRef<Set<string>>(new Set());
  const processingQueueRef = useRef<Array<{ file?: File; handle?: FileSystemFileHandle; name: string }>>([]);
  const isProcessingRef = useRef(false);
  const isMonitoringRef = useRef(false);
  const whiteBackgroundRef = useRef(whiteBackground);
  const selectedModelRef = useRef(selectedModel);
  
  // Refs para evitar Stale Closures en los intervalos
  const scanFolderRef = useRef<(() => Promise<void>) | null>(null);
  const processQueueRefFunc = useRef<(() => Promise<void>) | null>(null);
  
  // Hook para mantener el proceso activo cuando la página está minimizada
  // El Worker ejecuta ticks cada 3s incluso en segundo plano
  const pageVisibility = usePageVisibility({
    keepAlive: true,
    tickInterval: 3000,
    onBackgroundTick: () => {
      // Ejecutar scan desde el Web Worker cuando la página está en background
      if (scanFolderRef.current && isMonitoringRef.current) {
        scanFolderRef.current();
      }
    },
    onHidden: () => {
      if (isMonitoringRef.current) {
        info('⚠️ Página minimizada - el Worker mantiene el proceso activo');
      }
    },
    onVisible: () => {
      if (isMonitoringRef.current) {
        info('👁️ Página activa nuevamente');
      }
    },
  });

  const isSupported = 'showDirectoryPicker' in window;
  
  // Destructure para conveniencia
  const { 
    inputDir, 
    outputDir, 
    isRestoring, 
    selectInputFolder, 
    selectOutputFolder,
    startObserver,
    stopObserver,
    resetObserverTracking,
  } = directoryObserver;
  
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

  // Restaurar configuración guardada desde IndexedDB al montar
  useEffect(() => {
    const restoreConfig = async () => {
      try {
        // Restaurar modelo seleccionado
        const savedModelId = await get<string>('folderwatch-model');
        if (savedModelId) {
          const model = bgModels.find(m => m.id === savedModelId);
          if (model) {
            setSelectedModel(model);
          }
        }
        
        // Restaurar configuración de fondo blanco
        const savedWhiteBg = await get<boolean>('folderwatch-whitebg');
        if (savedWhiteBg !== undefined) {
          setWhiteBackground(savedWhiteBg);
        }
        
        // Verificar si estaba monitoreando antes (para mostrar aviso)
        const wasMonitoring = await get<boolean>('folderwatch-was-monitoring');
        if (wasMonitoring) {
          setWasMonitoringBefore(true);
          // Limpiar el flag
          await set('folderwatch-was-monitoring', false);
        }
        
        setConfigRestored(true);
      } catch (err) {
        console.error('Error restaurando configuración:', err);
        setConfigRestored(true);
      }
    };
    
    restoreConfig();
  }, []); // Solo al montar

  // Guardar configuración cuando cambie
  useEffect(() => {
    if (!configRestored) return; // No guardar hasta que se haya restaurado
    
    if (selectedModel) {
      set('folderwatch-model', selectedModel.id).catch(() => {});
    }
  }, [selectedModel, configRestored]);

  useEffect(() => {
    if (!configRestored) return;
    
    set('folderwatch-whitebg', whiteBackground).catch(() => {});
  }, [whiteBackground, configRestored]);

  // Guardar flag de "estaba monitoreando" cuando se inicia monitoreo
  // Esto permite mostrar un aviso al recargar la página
  useEffect(() => {
    if (isMonitoring) {
      set('folderwatch-was-monitoring', true).catch(() => {});
    }
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

  const getTimeSinceLastScan = () => {
    if (!lastScanTime) return '';
    const seconds = Math.floor((Date.now() - lastScanTime.getTime()) / 1000);
    if (seconds < 5) return 'ahora mismo';
    return `hace ${seconds}s`;
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

  const processImage = async (file: File, fileName: string) => {
    const model = selectedModelRef.current?.version;
    const currentWhiteBackground = whiteBackgroundRef.current;
    
    if (!outputDir) {
      error('❌ No hay carpeta de salida configurada');
      return;
    }
    
    const result = await imageProcessor.processImage({
      file,
      fileName,
      outputDir,
      whiteBackground: currentWhiteBackground,
      modelVersion: model,
    });
    
    if (result.success) {
      setStats(prev => ({
        total: prev.total + 1,
        success: prev.success + 1,
        errors: prev.errors
      }));
    } else {
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
        try {
          if (entry.kind === 'file') {
            const file = await entry.getFile();
            if (file.type.startsWith('image/')) {
              snapshot.add(file.name);
            }
          }
        } catch (fileErr) {
          // Error al procesar este archivo específico, continuar con los demás
          console.error('Error al procesar archivo en snapshot:', fileErr);
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
        // Manejo de errores por archivo individual (RF-4: previene que un archivo problemático rompa todo el escaneo)
        try {
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
        } catch (fileErr) {
          // Error al procesar este archivo específico, continuar con los demás
          console.error('Error al procesar archivo en scanFolder:', fileErr);
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

        // RF-2: Delay dinámico basado en el modelo seleccionado
        if (processingQueueRef.current.length > 0 && isMonitoringRef.current) {
          const delay = imageProcessor.getModelDelay(selectedModelRef.current);
          await new Promise(resolve => setTimeout(resolve, delay));
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
    
    // Activar persistencia para mantener el proceso cuando la página está minimizada
    pageVisibility.startProcessing();
    pageVisibility.acquireLock('folderwatch-monitoring');
    
    success('🚀 Monitoreo iniciado');
    
    // RF-2: Crear snapshot de archivos existentes
    const existingCount = await createSnapshot();
    info(`📸 Snapshot creado: ${existingCount} archivos existentes ignorados`);
    
    // RF-1: Intentar usar FileSystemObserver si está disponible
    const observerResult = await startObserver(
      (handle, name) => {
        // Callback cuando se detecta un archivo nuevo (el hook ya deduplicó eventos rápidos del observer)
        // Esta verificación adicional protege contra duplicados de múltiples fuentes (observer + polling)
        if (!processedNamesRef.current.has(name)) {
          processedNamesRef.current.add(name);
          setTrackedCount(processedNamesRef.current.size);
          processingQueueRef.current.push({ handle, name });
          if (processQueueRefFunc.current) {
            processQueueRefFunc.current();
          }
        }
      },
      () => {
        // Callback cuando hay un evento "unknown" (fallback a escaneo manual)
        if (scanFolderRef.current) scanFolderRef.current();
      }
    );
    
    if (!observerResult.success) {
      error('❌ Error al iniciar el monitoreo');
      stopMonitoring();
      return;
    }
    
    if (observerResult.usingObserver) {
      setUseObserver(true);
      info(`⚡ Observer activo + Polling de respaldo cada 10s`);
      
      // Polling de respaldo configurado cada 10s
      intervalRef.current = setInterval(() => {
        if (scanFolderRef.current) scanFolderRef.current();
      }, 10000);
    } else {
      // Fallback con polling optimizado
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
    
    // Desactivar persistencia
    pageVisibility.stopProcessing();
    pageVisibility.releaseLock();
    
    info('⏸️ Monitoreo detenido');
    
    // RF-1: Desconectar FileSystemObserver si está activo (delegado al hook)
    stopObserver();
    
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
    resetObserverTracking(); // Limpiar también el tracking interno del observer
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

  // Cleanup al desmontar: detener monitoreo
  useEffect(() => {
    return () => {
      // Detener monitoreo
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      isMonitoringRef.current = false;
      // Limpiar persistencia
      pageVisibility.stopProcessing();
      pageVisibility.releaseLock();
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

      {/* Header */}
      <FolderWatchHeader
        whiteBackground={whiteBackground}
        onToggleWhiteBackground={() => setWhiteBackground(!whiteBackground)}
      />

      {/* Aviso de monitoreo detenido por recarga */}
      {wasMonitoringBefore && !isMonitoring && inputDir && outputDir && selectedModel && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Monitoreo detenido</p>
              <p className="text-xs text-blue-600 mt-0.5">
                La página fue recargada. Tu configuración se ha restaurado. ¿Deseas reiniciar el monitoreo?
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setWasMonitoringBefore(false);
              startMonitoring();
            }}
            className="shrink-0"
          >
            Reiniciar
          </Button>
        </div>
      )}

      {/* Alerta de página minimizada */}
      {!pageVisibility.isVisible && isMonitoring && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Página en segundo plano</p>
            <p className="text-xs text-amber-600 mt-0.5">
              El proceso continúa ejecutándose. Mantén esta pestaña abierta para el mejor rendimiento.
            </p>
          </div>
        </div>
      )}

      {/* Alertas de estado */}
      <FolderWatchAlerts
        isRestoring={isRestoring}
        isMonitoring={isMonitoring}
        useObserver={useObserver}
        lastScanTime={lastScanTime}
        scanCount={scanCount}
        checkingToken={checkingToken}
        hasToken={hasToken}
        getTimeSinceLastScan={getTimeSinceLastScan}
        onRefreshToken={refreshTokenStatus}
      />

      {/* Carpetas */}
      <div className="grid sm:grid-cols-2 gap-4">
        <FolderSelector
          label="Entrada"
          folder={inputDir}
          isMonitoring={isMonitoring}
          description="Imágenes nuevas aquí serán procesadas automáticamente"
          selectedDescription="Carpeta de origen configurada ✓"
          colorScheme="emerald"
          onSelect={selectInputFolder}
        />
        <FolderSelector
          label="Salida"
          folder={outputDir}
          isMonitoring={isMonitoring}
          description="Las imágenes procesadas se guardarán aquí"
          selectedDescription="Carpeta de destino configurada ✓"
          colorScheme="indigo"
          onSelect={selectOutputFolder}
        />
      </div>

      {/* Selector de Modelo */}
      <ModelSelector
        models={bgModels}
        selectedModel={selectedModel}
        isMonitoring={isMonitoring}
        onSelectModel={setSelectedModel}
        getQualityLevel={getQualityLevel}
        getPricing={getPricing}
      />

      {/* Aviso de configuración pendiente */}
      <ConfigurationWarning
        hasInputDir={!!inputDir}
        hasOutputDir={!!outputDir}
        hasModel={!!selectedModel}
        hasToken={hasToken}
        checkingToken={checkingToken}
        isMonitoring={isMonitoring}
      />

      {/* Controles */}
      <FolderWatchControls
        isMonitoring={isMonitoring}
        canStart={!!inputDir && !!outputDir && !!selectedModel && hasToken && !checkingToken}
        onStart={startMonitoring}
        onStop={stopMonitoring}
        onForceScan={forceScan}
        onReset={resetStats}
      />

      {/* Estadísticas */}
      <FolderWatchStats
        total={stats.total}
        success={stats.success}
        errors={stats.errors}
        tracked={trackedCount}
      />

      {/* Toasts */}
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
