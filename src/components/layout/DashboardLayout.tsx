import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Bell, Coins, Settings, LogOut, CreditCard, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface UsageStats {
  thisMonth: number;
  estimatedCost: number;
}

export function DashboardLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UsageStats>({ thisMonth: 0, estimatedCost: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  // Verificar si el usuario tiene token configurado
  useEffect(() => {
    if (!user) {
      setCheckingToken(false);
      return;
    }
    
    const checkUserToken = async () => {
      try {
        const response = await apiClient.hasToken();
        setHasToken(response.hasToken);
        
        // Si no tiene token, redirigir al onboarding
        if (!response.hasToken && location.pathname !== '/onboarding') {
          navigate('/onboarding', { replace: true });
        }
      } catch {
        // Error verificando token, permitir acceso por ahora
        setHasToken(true);
      } finally {
        setCheckingToken(false);
      }
    };
    
    checkUserToken();
  }, [user, navigate, location.pathname]);

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      try {
        // TODO: Implementar con Firestore o backend API
        // Por ahora, datos de ejemplo
        setStats({ thisMonth: 0, estimatedCost: 0 });
      } catch {
        // Error cargando uso
      }
    };
    
    fetchData();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = () => {
      setShowNotifications(false);
      setShowUserMenu(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getPageTitle = () => {
    const routes: Record<string, string> = {
      '/': 'Remove Background',
      '/generate': 'Generate Images',
      '/compress': 'Compress Images',
      '/folder-watch': 'Auto Monitor',
      '/usage': 'Usage & Billing',
      '/settings': 'Settings'
    };
    return routes[location.pathname] || 'Workspace';
  };

  const getUserInitials = () => {
    if (!user?.email) return 'U';
    return user.email.substring(0, 2).toUpperCase();
  };

  // Mostrar loader mientras se verifica el token
  if (checkingToken) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-600 text-sm">Verificando configuración...</p>
        </div>
      </div>
    );
  }

  // Si no tiene token y no está en onboarding, no renderizar nada (ya se redirigió)
  if (!hasToken && location.pathname !== '/onboarding') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Sidebar />

      {/* Main Content Wrapper */}
      <div className="md:ml-64 flex flex-col min-h-screen transition-all duration-300">
        
        {/* Top Header */}
        <header className="h-14 bg-white/95 border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
          
          {/* Left: Dynamic Title */}
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold text-slate-900">{getPageTitle()}</h1>
          </div>

          {/* Right: Actions & Status */}
          <div className="flex items-center gap-4">
            
            {/* Cost Display - Compacto */}
            <button
              onClick={() => navigate('/usage')}
              className="flex items-center gap-2 text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium"
            >
              <Coins size={16} className="text-amber-500" />
              <span className="hidden sm:inline">{stats.thisMonth} imgs</span>
              <span className="text-slate-400">·</span>
              <span className="text-amber-600">${stats.estimatedCost.toFixed(3)}</span>
            </button>

            {/* Notifications - Simplificado */}
            <div className="relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNotifications(!showNotifications);
                  setShowUserMenu(false);
                }}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors relative"
              >
                <Bell size={18} />
                {stats.thisMonth > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-11 w-72 bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-slate-200/60 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-900 text-sm">Notificaciones</h3>
                  </div>
                  <div className="p-2">
                    {stats.thisMonth > 0 ? (
                      <div className="text-xs text-slate-600 p-3 bg-blue-50/80 rounded-lg">
                        Has procesado {stats.thisMonth} imágenes este mes
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 text-center py-6">
                        No hay notificaciones
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* User Menu - Modernizado */}
            <div className="relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserMenu(!showUserMenu);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-linear-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {getUserInitials()}
                </div>
                <span className="hidden md:inline text-sm font-medium text-slate-700">{user?.email?.split('@')[0]}</span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-11 w-56 bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-slate-200/60 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                    <p className="font-medium text-slate-900 text-sm truncate">{user?.email}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Free Plan</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        navigate('/usage');
                        setShowUserMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50/80 flex items-center gap-3 transition-colors"
                    >
                      <CreditCard size={16} className="text-slate-400" />
                      <span>Usage & Billing</span>
                    </button>
                    <button
                      onClick={() => {
                        navigate('/settings');
                        setShowUserMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50/80 flex items-center gap-3 transition-colors"
                    >
                      <Settings size={16} className="text-slate-400" />
                      <span>Settings</span>
                    </button>
                  </div>
                  <div className="border-t border-slate-100 py-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50/80 flex items-center gap-3 transition-colors"
                    >
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}