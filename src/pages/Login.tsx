import { useEffect } from 'react';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export default function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

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

          <Show when="signed-out">
            <SignInButton>
              <button
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-colors"
                type="button"
              >
                <svg className="w-5 h-5" viewBox="0 0 488 512">
                  <path
                    fill="currentColor"
                    d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                  />
                </svg>
                Continuar con Google
              </button>
            </SignInButton>

            <div className="mt-4 text-center text-sm text-slate-500">
              ¿No tienes cuenta?{' '}
              <SignUpButton>
                <button className="text-blue-600 hover:text-blue-700 font-medium" type="button">
                  Crear cuenta
                </button>
              </SignUpButton>
            </div>
          </Show>

          <Show when="signed-in">
            <div className="flex flex-col items-center gap-4">
              <UserButton />
              <button
                className="w-full px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-colors"
                onClick={() => navigate('/')}
                type="button"
              >
                Ir al panel
              </button>
            </div>
          </Show>

          <p className="text-xs text-center text-slate-400 mt-6">
            Al continuar, aceptas nuestros terminos y politica de privacidad
          </p>
        </div>
      </div>
    </div>
  );
}
