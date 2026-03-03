import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { type User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, isConfigured } from '@/lib/firebase';

// 30 minutos de inactividad → cierre de sesión automático
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
// Aviso 2 minutos antes del cierre
const WARNING_BEFORE_MS = 2 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const;

type AuthContextType = {
  user: User | null;
  loading: boolean;
  sessionWarning: boolean;
  signOut: () => Promise<void>;
  extendSession: () => void;
};

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  sessionWarning: false,
  signOut: async () => {},
  extendSession: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!isConfigured || !auth ? false : true);
  const [sessionWarning, setSessionWarning] = useState(false);

  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const signOut = async () => {
    if (auth) await firebaseSignOut(auth);
  };

  // Extiende la sesión desde el banner de advertencia
  const extendSession = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  return (
    <AuthContext.Provider value={{ user, loading, sessionWarning, signOut, extendSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };