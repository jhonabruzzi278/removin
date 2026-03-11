import { useState, useEffect, useCallback, useRef } from 'react';

interface UsePageVisibilityOptions {
  onHidden?: () => void;
  onVisible?: () => void;
  /** Si es true, intentará mantener el proceso activo cuando la página esté oculta */
  keepAlive?: boolean;
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
 */
export function usePageVisibility(options: UsePageVisibilityOptions = {}): UsePageVisibilityReturn {
  const { onHidden, onVisible, keepAlive = false } = options;
  
  const [isVisible, setIsVisible] = useState(!document.hidden);
  const [isProcessingActive, setIsProcessingActive] = useState(false);
  const lockRef = useRef<{ release: () => void } | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Screen Wake Lock API - previene que la pantalla se apague
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && !wakeLockRef.current) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      } catch (err) {
        // Wake Lock no disponible o rechazado
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
        await navigator.locks.request(name, { mode: 'exclusive' }, async (lock) => {
          if (lock) {
            // Mantener el lock indefinidamente hasta que se llame releaseLock
            return new Promise<void>((resolve) => {
              lockRef.current = { release: resolve };
            });
          }
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
    }
  }, [keepAlive, requestWakeLock]);

  const stopProcessing = useCallback(() => {
    setIsProcessingActive(false);
    releaseWakeLock();
    releaseLock();
  }, [releaseWakeLock, releaseLock]);

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
    };
  }, [releaseWakeLock, releaseLock]);

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
