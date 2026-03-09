import { useState, useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';

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

interface UseDirectoryObserverOptions {
  onInfo: (message: string) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

interface UseDirectoryObserverReturn {
  inputDir: FileSystemDirectoryHandle | null;
  outputDir: FileSystemDirectoryHandle | null;
  isRestoring: boolean;
  selectInputFolder: () => Promise<void>;
  selectOutputFolder: () => Promise<void>;
  startObserver: (
    onFileDetected: (handle: FileSystemFileHandle, name: string) => void,
    onUnknownEvent: () => void
  ) => Promise<{ success: boolean; usingObserver: boolean }>;
  stopObserver: () => void;
  resetObserverTracking: () => void;
  hasObserverAPI: boolean;
}

export function useDirectoryObserver({
  onInfo,
  onError,
  onSuccess,
}: UseDirectoryObserverOptions): UseDirectoryObserverReturn {
  const [inputDir, setInputDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [outputDir, setOutputDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const observerRef = useRef<FileSystemObserver | null>(null);
  // Set interno para deduplicar eventos del observer (previene múltiples detecciones del mismo archivo)
  const observerDetectedFilesRef = useRef<Set<string>>(new Set());

  const hasObserverAPI = 'FileSystemObserver' in self;
  const isSupported = 'showDirectoryPicker' in window;

  // Restaurar carpetas guardadas desde IndexedDB al montar
  useEffect(() => {
    const restoreFolders = async () => {
      try {
        const inputHandle = await get<FileSystemDirectoryHandle>('folderwatch-input');
        const outputHandle = await get<FileSystemDirectoryHandle>('folderwatch-output');
        
        if (inputHandle) {
          const h = inputHandle as FileSystemDirectoryHandleWithPermissions;
          const inputPermission = await h.queryPermission({ mode: 'read' });
          if (inputPermission === 'granted' || inputPermission === 'prompt') {
            if (inputPermission === 'prompt') {
              const granted = await h.requestPermission({ mode: 'read' });
              if (granted === 'granted') {
                setInputDir(inputHandle);
                onInfo('📁 Carpeta de entrada restaurada');
              }
            } else {
              setInputDir(inputHandle);
              onInfo('📁 Carpeta de entrada restaurada');
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
                onInfo('💾 Carpeta de salida restaurada');
              }
            } else {
              setOutputDir(outputHandle);
              onInfo('💾 Carpeta de salida restaurada');
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
  }, [isSupported, onInfo]);

  const selectInputFolder = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      setInputDir(dirHandle);
      await set('folderwatch-input', dirHandle);
      onSuccess(`✅ Carpeta de entrada seleccionada: ${dirHandle.name}`);
    } catch (err) {
      if (err instanceof Error && !err.message.includes('aborted')) {
        onError('❌ Error al seleccionar carpeta de entrada');
      }
    }
  };

  const selectOutputFolder = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setOutputDir(dirHandle);
      await set('folderwatch-output', dirHandle);
      onSuccess(`✅ Carpeta de salida seleccionada: ${dirHandle.name}`);
    } catch (err) {
      if (err instanceof Error && !err.message.includes('aborted')) {
        onError('❌ Error al seleccionar carpeta de salida');
      }
    }
  };

  const startObserver = async (
    onFileDetected: (handle: FileSystemFileHandle, name: string) => void,
    onUnknownEvent: () => void
  ): Promise<{ success: boolean; usingObserver: boolean }> => {
    if (!inputDir) {
      return { success: false, usingObserver: false };
    }

    // Limpiar el set de archivos detectados al iniciar un nuevo observer
    observerDetectedFilesRef.current.clear();

    if (hasObserverAPI && typeof (self as unknown as WindowWithFileSystemObserver).FileSystemObserver !== 'undefined') {
      try {
        const Observer = (self as unknown as WindowWithFileSystemObserver).FileSystemObserver;
        const observer = new Observer(async (records: FileSystemObserverEntry[]) => {
          for (const record of records) {
            if (record.type === 'appeared' || record.type === 'modified') {
              try {
                const handle = record.changedHandle;
                if (handle && handle.kind === 'file') {
                  const file = await (handle as FileSystemFileHandle).getFile();
                  
                  // Solo procesar imágenes y deduplicar eventos múltiples del mismo archivo
                  if (file.type.startsWith('image/') && !observerDetectedFilesRef.current.has(file.name)) {
                    observerDetectedFilesRef.current.add(file.name);
                    onFileDetected(handle as FileSystemFileHandle, file.name);
                  }
                }
              } catch (err) {
                console.error('Error procesando evento del observer:', err);
              }
            } else if (record.type === 'unknown') {
              onUnknownEvent();
            }
          }
        });
        
        await observer.observe(inputDir, { recursive: false });
        observerRef.current = observer;
        return { success: true, usingObserver: true };
      } catch (err) {
        console.error('Error al inicializar FileSystemObserver:', err);
        return { success: true, usingObserver: false };
      }
    }

    return { success: true, usingObserver: false };
  };

  const stopObserver = () => {
    if (observerRef.current) {
      try {
        observerRef.current.disconnect();
        observerRef.current = null;
      } catch (err) {
        console.error('Error al desconectar observer:', err);
      }
    }
    // Limpiar el set de archivos detectados al detener el observer
    observerDetectedFilesRef.current.clear();
  };

  const resetObserverTracking = () => {
    observerDetectedFilesRef.current.clear();
  };

  // Cleanup al desmontar
  useEffect(() => {
    const cleanupObserver = () => {
      if (observerRef.current) {
        try {
          observerRef.current.disconnect();
          observerRef.current = null;
        } catch (err) {
          console.error('Error al desconectar observer en cleanup:', err);
        }
      }
      observerDetectedFilesRef.current.clear();
    };

    return () => {
      cleanupObserver();
    };
  }, []);

  return {
    inputDir,
    outputDir,
    isRestoring,
    selectInputFolder,
    selectOutputFolder,
    startObserver,
    stopObserver,
    resetObserverTracking,
    hasObserverAPI,
  };
}
