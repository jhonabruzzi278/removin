import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { type User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, isConfigured } from '@/lib/firebase';
import { apiClient } from '@/lib/api';

// 30 minutos de inactividad → cierre de sesión automático
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
// Aviso 2 minutos antes del cierre
const WARNING_BEFORE_MS = 2 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const;

// Clave para persistir estado del token en localStorage
const TOKEN_CACHE_KEY = 'removin_token_status';
const TOKEN_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutos de cache

interface TokenCache {
  hasToken: boolean;
  uid: string;
  timestamp: number;
}

/**
 * Obtener estado del token desde cache local
 */
function getCachedTokenStatus(uid: string): boolean | null {
  try {
    const cached = localStorage.getItem(TOKEN_CACHE_KEY);
    if (!cached) return null;
    
    const data: TokenCache = JSON.parse(cached);
    
    // Verificar que el cache es para este usuario y no ha expirado
    if (data.uid !== uid) return null;
    if (Date.now() - data.timestamp > TOKEN_CACHE_EXPIRY) return null;
    
    return data.hasToken;
  } catch {
    return null;
  }
}

/**
 * Guardar estado del token en cache local
 */
function setCachedTokenStatus(uid: string, hasToken: boolean): void {
  try {
    const data: TokenCache = {
      hasToken,
      uid,
      timestamp: Date.now()
    };
    localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignorar errores de localStorage
  }
}

/**
 * Limpiar cache del token
 */
function clearTokenCache(): void {
  try {
    localStorage.removeItem(TOKEN_CACHE_KEY);
  } catch {
    // Ignorar
  }
}

type AuthContextType = {
  user: User | null;
  loading: boolean;
  sessionWarning: boolean;
  hasToken: boolean;
  checkingToken: boolean;
  refreshTokenStatus: (forceRefresh?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  extendSession: () => void;
};

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  sessionWarning: false,
  hasToken: false,
  checkingToken: true,
  refreshTokenStatus: async () => {},
  signOut: async () => {},
  extendSession: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!isConfigured || !auth ? false : true);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verificar si el usuario tiene token de Replicate configurado
  // Usa cache local para respuesta inmediata, luego verifica con el servidor
  const refreshTokenStatus = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setHasToken(false);
      setCheckingToken(false);
      clearTokenCache();
      return;
    }

    // Primero, intentar usar cache para respuesta inmediata
    if (!forceRefresh) {
      const cachedStatus = getCachedTokenStatus(user.uid);
      if (cachedStatus !== null) {
        setHasToken(cachedStatus);
        setCheckingToken(false);
        
        // Verificar en segundo plano (sin bloquear UI)
        apiClient.hasToken().then(response => {
          setHasToken(response.hasToken);
          setCachedTokenStatus(user.uid, response.hasToken);
        }).catch(() => {
          // Mantener valor del cache si hay error de red
        });
        return;
      }
    }

    setCheckingToken(true);
    try {
      const response = await apiClient.hasToken();
      setHasToken(response.hasToken);
      setCachedTokenStatus(user.uid, response.hasToken);
    } catch (error) {
      console.error('Error verificando token:', error);
      // En caso de error, verificar cache como fallback
      const cachedStatus = getCachedTokenStatus(user.uid);
      if (cachedStatus !== null) {
        setHasToken(cachedStatus);
      } else {
        setHasToken(false);
      }
    } finally {
      setCheckingToken(false);
    }
  }, [user]);

  const clearTimers = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setSessionWarning(false);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers(); // clearTimers ya llama setSessionWarning(false)

    warningTimerRef.current = setTimeout(() => {
      setSessionWarning(true);
    }, INACTIVITY_LIMIT_MS - WARNING_BEFORE_MS);

    logoutTimerRef.current = setTimeout(async () => {
      if (auth) await firebaseSignOut(auth);
    }, INACTIVITY_LIMIT_MS);
  }, [clearTimers]);

  // Iniciar/detener listeners de actividad según si hay usuario logueado
  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      clearTimers(); // clearTimers resetea sessionWarning internamente
      return;
    }

    resetTimers();

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, resetTimers, { passive: true }));

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetTimers));
      clearTimers();
    };
  }, [user, resetTimers, clearTimers]);

  useEffect(() => {
    if (!isConfigured || !auth) return; // loading ya inicializa en false cuando !isConfigured

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    }, (error) => {
      console.error('Error de autenticación:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Verificar token cuando el usuario cambia (login/logout)
  useEffect(() => {
    refreshTokenStatus();
  }, [refreshTokenStatus]);

  // Re-verificar token cuando la ventana recupera el foco (usuario volvió de Settings)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        refreshTokenStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, refreshTokenStatus]);

  const signOut = async () => {
    clearTokenCache(); // Limpiar cache del token al cerrar sesión
    if (auth) await firebaseSignOut(auth);
  };

  // Extiende la sesión desde el banner de advertencia
  const extendSession = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      sessionWarning, 
      hasToken, 
      checkingToken,
      refreshTokenStatus,
      signOut, 
      extendSession 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };