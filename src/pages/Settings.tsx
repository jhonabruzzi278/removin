import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Toast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';
import { 
  Key, Save, Check, Loader2, ExternalLink, 
  CheckCircle2, AlertCircle, HelpCircle, Eye, EyeOff
} from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const { toasts, dismiss, success, error, warning } = useToast();
  const [replicateKey, setReplicateKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [isValidKey, setIsValidKey] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      const data = await apiClient.hasToken();
      if (data.hasToken) {
        setReplicateKey('••••••••••••••••');
        setIsValidKey(true);
      }
    } catch {
      // Error al cargar
    }
  };

  const validateReplicateToken = (token: string): boolean => {
    return /^r8_[A-Za-z0-9_-]{30,}$/.test(token);
  };

  const handleSave = async () => {
    if (!user) {
      error('❌ Debes iniciar sesión');
      return;
    }

    const sanitizedToken = replicateKey.trim();
    
    if (!sanitizedToken) {
      warning('⚠️ Ingresa tu API token');
      return;
    }

    if (!validateReplicateToken(sanitizedToken)) {
      error('❌ El token debe empezar con "r8_" y tener al menos 30 caracteres');
      return;
    }

    setSaving(true);
    setSuccessMsg('');

    try {
      await apiClient.saveToken(sanitizedToken);
      setIsValidKey(true);
      setSuccessMsg('¡Guardado! Ya puedes usar todas las funciones.');
      success('✅ Token guardado correctamente');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar';
      error(`❌ ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-slate-900">Ajustes</h1>
        {isValidKey && (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Conectado
          </Badge>
        )}
      </div>

      {/* Status Alert */}
      {!isValidKey && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 ml-2">
            Necesitas configurar tu API token de Replicate para usar las funciones de IA.
          </AlertDescription>
        </Alert>
      )}

      {/* API Token Card */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-900">API Token de Replicate</h2>
            <Tooltip content="Este token conecta Removin con Replicate para procesar imágenes con IA. Es gratuito crear una cuenta." position="right">
              <button className="text-slate-400 hover:text-slate-600">
                <HelpCircle size={16} />
              </button>
            </Tooltip>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <Label htmlFor="replicate" className="text-sm text-slate-600">
              Tu token (empieza con r8_)
            </Label>
            <div className="relative">
              <Input 
                id="replicate" 
                type={showToken ? "text" : "password"}
                placeholder="r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
                value={replicateKey}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  if (/^[a-zA-Z0-9_-]*$/.test(value) || value === '') {
                    setReplicateKey(value);
                  }
                }}
                className="pl-10 pr-10 font-mono h-11"
                autoComplete="off"
                maxLength={100}
              />
              <Key className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Cómo obtenerlo */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">¿Cómo obtener el token?</span>
              <Tooltip content="El proceso toma menos de 2 minutos" position="right">
                <HelpCircle size={14} className="text-slate-400" />
              </Tooltip>
            </div>
            <ol className="text-sm text-slate-600 space-y-1 ml-4 list-decimal">
              <li>Crea cuenta gratis en replicate.com</li>
              <li>Ve a tu perfil → API tokens</li>
              <li>Copia tu token y pégalo aquí</li>
            </ol>
            <a 
              href="https://replicate.com/account/api-tokens" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
            >
              Ir a Replicate
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Seguridad */}
          <div className="flex items-start gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            <span>
              Tu token se guarda encriptado y solo se usa para conectar con Replicate. 
              Nunca lo compartimos.
            </span>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-green-600 font-medium">
              {successMsg && (
                <span className="flex items-center gap-2">
                  <Check size={16} /> {successMsg}
                </span>
              )}
            </div>
            <Button 
              onClick={handleSave} 
              disabled={saving || !replicateKey.trim()} 
              className="bg-slate-900 hover:bg-slate-800"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Guardar
            </Button>
          </div>
        </div>
      </Card>

      {/* Funciones desbloqueadas */}
      {isValidKey && (
        <Card className="p-6 border-green-200 bg-green-50">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-green-900">Funciones activas</h3>
          </div>
          <ul className="text-sm text-green-700 space-y-1 ml-7">
            <li>• Remover fondos de imágenes</li>
            <li>• Generar imágenes con IA</li>
            <li>• Monitoreo automático de carpetas</li>
          </ul>
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
  );
}
