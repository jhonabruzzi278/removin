import { useAuth as useClerkAuth, useUser } from '@clerk/react';
import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { auth, setCurrentUser, setTokenProvider, clearAuthSession } from '@/lib/firebase';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const;

const TOKEN_CACHE_KEY = 'removin_token_status';
const TOKEN_CACHE_EXPIRY = 5 * 60 * 1000;

interface TokenCache {
  hasToken: boolean;
  uid: string;
  timestamp: number;
}

function getCachedTokenStatus(uid: string): boolean | null {
  try {
    const cached = localStorage.getItem(TOKEN_CACHE_KEY);
    if (!cached) return null;

    const data: TokenCache = JSON.parse(cached);
    if (data.uid !== uid) return null;
    if (Date.now() - data.timestamp > TOKEN_CACHE_EXPIRY) return null;

    return data.hasToken;
  } catch {
    return null;
  }
}

function setCachedTokenStatus(uid: string, hasToken: boolean): void {
  try {
    const data: TokenCache = {
      hasToken,
      uid,
      timestamp: Date.now(),
    };
    localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function clearTokenCache(): void {
  try {
    localStorage.removeItem(TOKEN_CACHE_KEY);
  } catch {
    // ignore
  }
}

type AuthContextType = {
  user: { uid: string; email: string; displayName: string; photoURL: string | null } | null;
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
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut: clerkSignOut, getToken } = useClerkAuth();

  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [loading, setLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTokenProvider(async () => {
      const token = await getToken({ template: undefined });
      return token || null;
    });
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) {
      setLoading(true);
      return;
    }

    if (!clerkUser) {
      setUser(null);
      setLoading(false);
      setCurrentUser(null);
      clearAuthSession();
      return;
    }

    const mapped = {
      uid: clerkUser.id,
      email:
        clerkUser.primaryEmailAddress?.emailAddress ||
        clerkUser.emailAddresses[0]?.emailAddress ||
        'user@removin.app',
      displayName: clerkUser.fullName || clerkUser.firstName || 'Usuario',
      photoURL: clerkUser.imageUrl || null,
    };

    setUser(mapped);
    setCurrentUser(mapped);
    setLoading(false);
  }, [clerkUser, isLoaded]);

  const refreshTokenStatus = useCallback(
    async (forceRefresh = false) => {
      if (!user) {
        setHasToken(false);
        setCheckingToken(false);
        clearTokenCache();
        return;
      }

      if (!forceRefresh) {
        const cachedStatus = getCachedTokenStatus(user.uid);
        if (cachedStatus !== null) {
          setHasToken(cachedStatus);
          setCheckingToken(false);

          apiClient
            .hasToken()
            .then((response) => {
              setHasToken(response.hasToken);
              setCachedTokenStatus(user.uid, response.hasToken);
            })
            .catch(() => {
              // keep cache value
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
        const cachedStatus = getCachedTokenStatus(user.uid);
        if (cachedStatus !== null) {
          setHasToken(cachedStatus);
        } else {
          setHasToken(false);
        }
      } finally {
        setCheckingToken(false);
      }
    },
    [user]
  );

  const clearTimers = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setSessionWarning(false);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();

    warningTimerRef.current = setTimeout(() => {
      setSessionWarning(true);
    }, INACTIVITY_LIMIT_MS - WARNING_BEFORE_MS);

    logoutTimerRef.current = setTimeout(async () => {
      if (auth.currentUser) {
        await clerkSignOut();
      }
    }, INACTIVITY_LIMIT_MS);
  }, [clearTimers, clerkSignOut]);

  useEffect(() => {
    if (!user) {
      clearTimers();
      return;
    }

    resetTimers();

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimers, { passive: true }));

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimers));
      clearTimers();
    };
  }, [user, resetTimers, clearTimers]);

  useEffect(() => {
    refreshTokenStatus();
  }, [refreshTokenStatus]);

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
    clearTokenCache();
    await clerkSignOut();
  };

  const extendSession = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionWarning,
        hasToken,
        checkingToken,
        refreshTokenStatus,
        signOut,
        extendSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
