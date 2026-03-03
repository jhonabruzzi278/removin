import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toast } from '@/components/ui/toast';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';
import {
  Key, Save, Check, Loader2, RefreshCw,
  CheckCircle2, Eye, EyeOff, ShieldCheck
} from 'lucide-react';

const MASKED_VALUE = 'u{2022}u{2022}u{2022}u{2022}u{2022}u{2022}u{2022}u{2022}u{2022}u{2022}u{2022}u{2022}u{2022}u{2022}u{2022}u{2022}';
const validateToken = (token: string): boolean => /^r8_\S{10,}$/.test(token);

export default function SettingsPage() {
  const { user } = useAuth();
  const { toasts, dismiss, success, error } = useToast();

  const [hasToken, setHasToken] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const data = await apiClient.hasToken();
        setHasToken(data.hasToken);
      } catch {
        // sin bloquear
      } finally {
        setLoadingStatus(false);
      }
    };
    load();
  }, [user]);

  const handleRotate = async () => {
    const sanitized = newToken.trim();
    if (!sanitized) { error('Ingresa el nuevo token'); return; }
    if (!validateToken(sanitized)) { error('El token debe empezar con r8_'); return; }

    setSaving(true);
    setSuccessMsg('');
    try {
      await apiClient.saveToken(sanitized);
      setHasToken(true);
      setNewToken('');
      setRotating(false);
      setSuccessMsg('Token actualizado correctamente');
      success('Token reemplazado');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Ajustes</h1>
        <p className="text-sm text-slate-500 mt-1">Gestiona la configuracion de tu cuenta</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Token de Replicate</h2>
            <p className="text-xs text-slate-500">Reemplaza tu token cuando lo necesites</p>
          </div>
        </div>

        {loadingStatus ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Verificando estado...
          </div>
        ) : (
          <div className="flex items-center justify-between mb-5 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              {hasToken ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-slate-700">Token configurado</span>
                  <span className="font-mono text-sm text-slate-400">{MASKED_VALUE}</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-slate-700">Sin token configurado</span>
                </>
              )}
            </div>
            {!rotating && (
              <button
                onClick={() => setRotating(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <RefreshCw size={13} />
                {hasToken ? 'Cambiar token' : 'Agregar token'}
              </button>
            )}
          </div>
        )}

        {rotating && (
          <div className="space-y-4 border-t pt-5">
            <p className="text-sm text-slate-600">
              Pega tu nuevo token de Replicate. Reemplazara el actual de inmediato.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="new-token" className="text-sm text-slate-600">
                Nuevo token
              </Label>
              <div className="relative">
                <Input
                  id="new-token"
                  type={showToken ? 'text' : 'password'}
                  placeholder="r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
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
              {newToken && !validateToken(newToken) && (
                <p className="text-xs text-red-500">El token debe empezar con r8_</p>
              )}
              {newToken && validateToken(newToken) && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Formato valido
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Button
                onClick={handleRotate}
                disabled={saving || !validateToken(newToken.trim())}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Guardar nuevo token
              </Button>
              <button
                onClick={() => { setRotating(false); setNewToken(''); }}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {successMsg && !rotating && (
          <div className="flex items-center gap-2 text-sm text-green-600 font-medium mt-2">
            <Check size={15} /> {successMsg}
          </div>
        )}
      </Card>

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
