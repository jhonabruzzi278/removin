import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip } from '@/components/ui/tooltip';
import { 
  DollarSign, ExternalLink, AlertCircle, 
  HelpCircle, Package, Zap
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';

export default function UsagePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    checkApiKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const checkApiKey = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const data = await apiClient.hasToken();
      setHasApiKey(data.hasToken);
    } catch {
      setHasApiKey(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-slate-900">Uso y Facturación</h1>
        <Tooltip content="Removin usa Replicate para procesar imágenes. Pagas directamente a Replicate por lo que uses." position="right">
          <button className="text-slate-400 hover:text-slate-600 transition-colors">
            <HelpCircle size={20} />
          </button>
        </Tooltip>
      </div>

      {/* Alert si no tiene API key */}
      {!loading && !hasApiKey && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900 ml-2 flex items-center justify-between">
            <span>Configura tu API Token de Replicate primero</span>
            <Button
              variant="link"
              className="text-amber-900 underline p-0"
              onClick={() => window.location.href = '/settings'}
            >
              Ir a Ajustes
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Cómo funciona */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-semibold text-slate-900">¿Cómo funciona el cobro?</h2>
          <Tooltip content="No hay suscripciones. Solo pagas por cada imagen que procesas." position="right">
            <button className="text-slate-400 hover:text-slate-600">
              <HelpCircle size={16} />
            </button>
          </Tooltip>
        </div>
        
        <p className="text-sm text-slate-600 mb-4">
          Removin usa <strong>Replicate</strong> para procesar imágenes con IA. 
          Tú pagas directamente a Replicate según lo que uses (pago por uso).
        </p>

        <div className="bg-slate-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700">Remover fondo</span>
              <Tooltip content="Costo aproximado usando el modelo estándar. Varía según el modelo elegido." position="right">
                <HelpCircle size={14} className="text-slate-400" />
              </Tooltip>
            </div>
            <span className="text-sm font-medium text-slate-900">~$0.0002 - $0.001 / imagen</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700">Generar imagen</span>
              <Tooltip content="Generación con SDXL 1.0. El tiempo y costo dependen del tamaño de imagen." position="right">
                <HelpCircle size={14} className="text-slate-400" />
              </Tooltip>
            </div>
            <span className="text-sm font-medium text-slate-900">~$0.003 / imagen</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700">Almacenamiento temporal</span>
              <Tooltip content="Las imágenes se guardan temporalmente en Firebase. No hay costo adicional." position="right">
                <HelpCircle size={14} className="text-slate-400" />
              </Tooltip>
            </div>
            <span className="text-sm font-medium text-green-600">Incluido</span>
          </div>
        </div>
      </Card>

      {/* Gestionar cuenta */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-semibold text-slate-900">Gestionar tu cuenta de Replicate</h2>
          <Tooltip content="Todas las transacciones y facturación se manejan directamente en Replicate" position="right">
            <button className="text-slate-400 hover:text-slate-600">
              <HelpCircle size={16} />
            </button>
          </Tooltip>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Para ver tu uso detallado, agregar créditos o gestionar tu facturación, 
          accede directamente a tu cuenta de Replicate.
        </p>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-between h-11"
            onClick={() => window.open('https://replicate.com/account/billing', '_blank')}
          >
            <span className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Ver Facturación
            </span>
            <ExternalLink className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            className="w-full justify-between h-11"
            onClick={() => window.open('https://replicate.com/account', '_blank')}
          >
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Agregar Créditos
            </span>
            <ExternalLink className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            className="w-full justify-between h-11"
            onClick={() => window.open('https://replicate.com/pricing', '_blank')}
          >
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Ver Precios de Replicate
            </span>
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Nota */}
      <div className="text-center text-xs text-slate-500 py-4">
        Los precios son aproximados y pueden variar según el modelo de IA utilizado
      </div>
    </div>
  );
}
