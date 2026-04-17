import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';

export default function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    setLoadingGoogle(true);
    setAuthError(null);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error iniciando sesion:', error);
      setAuthError(error instanceof Error ? error.message : 'No fue posible iniciar sesion');
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl mb-4">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Removin</h1>
            <p className="text-sm text-slate-500 mt-1">Automatizacion de imagenes con IA</p>
          </div>

          <button
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-colors disabled:opacity-70"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loadingGoogle}
          >
            {loadingGoogle ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 488 512">
                <path
                  fill="currentColor"
                  d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                />
              </svg>
            )}
            {loadingGoogle ? 'Redirigiendo...' : 'Continuar con Google'}
          </button>

          {authError ? (
            <p className="mt-4 text-sm text-red-600 text-center">{authError}</p>
          ) : null}

          <p className="text-xs text-center text-slate-400 mt-6">
            Al continuar, aceptas nuestros terminos y politica de privacidad
          </p>
        </div>
      </div>
    </div>
  );
}
