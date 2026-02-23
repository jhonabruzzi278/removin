import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';
import { Toast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api';
import { 
  Key, ExternalLink, CheckCircle2, ArrowRight, 
  Loader2, Eye, EyeOff, Sparkles, Shield, Zap
} from 'lucide-react';

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { toasts, dismiss, success, error } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  const validateToken = (t: string): boolean => {
    return /^r8_[A-Za-z0-9_-]{30,}$/.test(t);
  };

  const handleSaveToken = async () => {
    const sanitizedToken = token.trim();
    
    if (!sanitizedToken) {
      error('Ingresa tu API token');
      return;
    }

    if (!validateToken(sanitizedToken)) {
      error('El token debe empezar con "r8_" y tener al menos 33 caracteres');
      return;
    }

    setSaving(true);
    try {
      await apiClient.saveToken(sanitizedToken);
      success('¡Token guardado correctamente!');
      setStep(3);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar';
      error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = () => {
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-16 rounded-full transition-colors ${
                s <= step ? 'bg-blue-600' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Bienvenida */}
        {step === 1 && (
          <Card className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-6">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 mb-3">
              ¡Bienvenido a Removin!
            </h1>
            
            <p className="text-slate-600 mb-8">
              Para usar las funciones de IA necesitas conectar tu cuenta de Replicate. 
              Es gratis y solo toma 2 minutos.
            </p>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-xs text-slate-600">Procesamiento rápido</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-xs text-slate-600">Token seguro</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Key className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-xs text-slate-600">Tu propia cuenta</p>
              </div>
            </div>

            <Button 
              onClick={() => setStep(2)} 
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Comenzar configuración
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Card>
        )}

        {/* Step 2: Configurar Token */}
        {step === 2 && (
          <Card className="p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-xl mb-4">
                <Key className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Configura tu API Token
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Sigue estos pasos para obtener tu token
              </p>
            </div>

            {/* Pasos */}
            <div className="bg-slate-50 rounded-xl p-5 mb-6">
              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    1
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Crea una cuenta en Replicate
                    </p>
                    <p className="text-xs text-slate-500">
                      Es gratis, puedes usar tu cuenta de GitHub
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    2
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Ve a tu perfil → API Tokens
                    </p>
                    <p className="text-xs text-slate-500">
                      Crea un nuevo token o copia el existente
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    3
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Pega el token aquí abajo
                    </p>
                    <p className="text-xs text-slate-500">
                      Empieza con r8_ y tiene ~40 caracteres
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            {/* Botón ir a Replicate */}
            <a
              href="https://replicate.com/account/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors mb-6"
            >
              Abrir Replicate
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Input Token */}
            <div className="space-y-2 mb-6">
              <label className="text-sm font-medium text-slate-700">
                Tu API Token
              </label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder="r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={token}
                  onChange={(e) => setToken(e.target.value.trim())}
                  className="pl-10 pr-10 font-mono h-12"
                  autoComplete="off"
                />
                <Key className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {token && !validateToken(token) && (
                <p className="text-xs text-red-500">
                  El token debe empezar con "r8_" y tener al menos 33 caracteres
                </p>
              )}
              {token && validateToken(token) && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Formato válido
                </p>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Atrás
              </Button>
              <Button
                onClick={handleSaveToken}
                disabled={saving || !validateToken(token)}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Guardar token
              </Button>
            </div>

            {/* Nota de seguridad */}
            <p className="text-xs text-center text-slate-400 mt-4">
              <Shield className="inline w-3 h-3 mr-1" />
              Tu token se guarda encriptado y nunca se comparte
            </p>
          </Card>
        )}

        {/* Step 3: Completado */}
        {step === 3 && (
          <Card className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 mb-3">
              ¡Todo listo!
            </h1>
            
            <p className="text-slate-600 mb-8">
              Tu cuenta está configurada. Ya puedes usar todas las funciones de Removin.
            </p>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8">
              <h3 className="font-medium text-green-900 mb-2">Funciones disponibles:</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>✓ Remover fondos de imágenes</li>
                <li>✓ Generar imágenes con IA</li>
                <li>✓ Monitoreo automático de carpetas</li>
                <li>✓ Comprimir imágenes</li>
              </ul>
            </div>

            <Button 
              onClick={handleFinish} 
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Comenzar a usar Removin
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Card>
        )}

        {/* Toasts */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={() => dismiss(toast.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
