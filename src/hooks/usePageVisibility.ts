import { useState, useEffect, useCallback, useRef } from 'react';

interface UsePageVisibilityOptions {
  onHidden?: () => void;
  onVisible?: () => void;
  /** Si es true, intentará mantener el proceso activo cuando la página esté oculta */
  keepAlive?: boolean;
  /** Callback ejecutado en cada tick del timer de background (cada 3s por defecto) */
  onBackgroundTick?: () => void;
  /** Intervalo del tick en ms (default: 3000) */
  tickInterval?: number;
}

interface UsePageVisibilityReturn {
  isVisible: boolean;
  isProcessingActive: boolean;
  /** Marcar que hay un proceso activo que no debe interrumpirse */
  startProcessing: () => void;
  /** Marcar que el proceso terminó */
  stopProcessing: () => void;
  /** Adquirir un Web Lock para prevenir suspensión del navegador */
  acquireLock: (name: string) => Promise<void>;
  /** Liberar el Web Lock */
  releaseLock: () => void;
}

/**
 * Hook para manejar la visibilidad de la página y mantener procesos activos
 * cuando el usuario minimiza la ventana o cambia de pestaña.
 * 
 * Utiliza múltiples técnicas para evitar la suspensión del navegador:
 * 1. Web Worker - Los workers no se suspenden en segundo plano
 * 2. Screen Wake Lock API - Previene que la pantalla se apague
 * 3. Web Locks API - Previene cierre de pestaña
 * 4. Audio Context silencioso - Mantiene el proceso de audio activo
 */
export function usePageVisibility(options: UsePageVisibilityOptions = {}): UsePageVisibilityReturn {
  const { 
    onHidden, 
    onVisible, 
    keepAlive = false,
    onBackgroundTick,
    tickInterval = 3000
  } = options;
  
  const [isVisible, setIsVisible] = useState(!document.hidden);
  const [isProcessingActive, setIsProcessingActive] = useState(false);
  const lockRef = useRef<{ release: () => void } | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const onBackgroundTickRef = useRef(onBackgroundTick);

  // Mantener referencia actualizada del callback
  useEffect(() => {
    onBackgroundTickRef.current = onBackgroundTick;
  }, [onBackgroundTick]);

  // Inicializar Web Worker para timers en background
  const initWorker = useCallback(() => {
    if (workerRef.current) return;
    
    try {
      // Crear worker inline usando Blob
      const workerCode = `
        let intervalId = null;
        let tickCount = 0;
        
        self.onmessage = (event) => {
          const { type, interval } = event.data;
          
          switch (type) {
            case 'start':
              if (intervalId) clearInterval(intervalId);
              tickCount = 0;
              intervalId = setInterval(() => {
                tickCount++;
                self.postMessage({ type: 'tick', count: tickCount });
              }, interval || 3000);
              self.postMessage({ type: 'started' });
              break;
              
            case 'stop':
              if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
              }
              self.postMessage({ type: 'stopped' });
              tickCount = 0;
              break;
          }
        };
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      workerRef.current = new Worker(workerUrl);
      
      workerRef.current.onmessage = (event) => {
        if (event.data.type === 'tick' && onBackgroundTickRef.current) {
          onBackgroundTickRef.current();
        }
      };
      
      // Limpiar URL del blob después de crear el worker
      URL.revokeObjectURL(workerUrl);
    } catch (err) {
      console.warn('No se pudo crear Web Worker:', err);
    }
  }, []);

  const startWorker = useCallback(() => {
    initWorker();
    workerRef.current?.postMessage({ type: 'start', interval: tickInterval });
  }, [initWorker, tickInterval]);

  const stopWorker = useCallback(() => {
    workerRef.current?.postMessage({ type: 'stop' });
  }, []);

  // Audio Context silencioso - técnica para evitar suspensión del navegador
  // El navegador mantiene activo JavaScript mientras hay audio procesándose
  const startSilentAudio = useCallback(() => {
    if (audioContextRef.current) return;
    
    try {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Crear un oscilador inaudible (frecuencia muy baja, volumen 0)
      oscillatorRef.current = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      
      // Volumen prácticamente 0 (inaudible pero activo)
      gainNode.gain.value = 0.001;
      
      oscillatorRef.current.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      // Frecuencia muy baja (subsónica, inaudible)
      oscillatorRef.current.frequency.value = 1;
      oscillatorRef.current.start();
    } catch (err) {
      console.warn('No se pudo iniciar AudioContext:', err);
    }
  }, []);

  const stopSilentAudio = useCallback(() => {
    try {
      oscillatorRef.current?.stop();
      oscillatorRef.current?.disconnect();
      audioContextRef.current?.close();
    } catch {
      // Ignorar errores al cerrar
    }
    oscillatorRef.current = null;
    audioContextRef.current = null;
  }, []);

  // Screen Wake Lock API - previene que la pantalla se apague
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && !wakeLockRef.current) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      } catch (err) {
        console.warn('Wake Lock no disponible:', err);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  // Web Locks API - previene suspensión de JavaScript
  const releaseLock = useCallback(() => {
    if (lockRef.current) {
      lockRef.current.release();
      lockRef.current = null;
    }
  }, []);

  const acquireLock = useCallback(async (name: string) => {
    if ('locks' in navigator && !lockRef.current) {
      try {
        // Fire-and-forget: no esperamos la promesa
        navigator.locks.request(name, { mode: 'exclusive' }, () => {
          return new Promise<void>((resolve) => {
            lockRef.current = { release: resolve };
          });
        });
      } catch (err) {
        console.warn('Web Locks no disponible:', err);
      }
    }
  }, []);

  const startProcessing = useCallback(() => {
    setIsProcessingActive(true);
    if (keepAlive) {
      requestWakeLock();
      startWorker();
      startSilentAudio();
    }
  }, [keepAlive, requestWakeLock, startWorker, startSilentAudio]);

  const stopProcessing = useCallback(() => {
    setIsProcessingActive(false);
    releaseWakeLock();
    releaseLock();
    stopWorker();
    stopSilentAudio();
  }, [releaseWakeLock, releaseLock, stopWorker, stopSilentAudio]);

  // Manejar cambios de visibilidad
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);
      
      if (visible) {
        onVisible?.();
        // Re-adquirir Screen Wake Lock si estaba procesando
        if (isProcessingActive && keepAlive) {
          requestWakeLock();
        }
      } else {
        onHidden?.();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [onHidden, onVisible, isProcessingActive, keepAlive, requestWakeLock]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      releaseWakeLock();
      releaseLock();
      stopWorker();
      stopSilentAudio();
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [releaseWakeLock, releaseLock, stopWorker, stopSilentAudio]);

  // Advertencia antes de cerrar/recargar si hay proceso activo
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isProcessingActive) {
        e.preventDefault();
        e.returnValue = 'Hay un proceso de imágenes en curso. ¿Seguro que quieres salir?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isProcessingActive]);

  return {
    isVisible,
    isProcessingActive,
    startProcessing,
    stopProcessing,
    acquireLock,
    releaseLock,
  };
}
