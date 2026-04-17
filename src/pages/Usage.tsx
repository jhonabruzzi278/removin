import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip } from '@/components/ui/tooltip';
import {
  DollarSign,
  ExternalLink,
  AlertCircle,
  HelpCircle,
  Package,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function UsagePage() {
  const { hasToken, checkingToken } = useAuth();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-slate-900">Uso y Facturacion</h1>
        <Tooltip
          content="Removin usa Replicate para procesar imagenes. Pagas directamente a Replicate por lo que uses."
          position="right"
        >
          <button className="text-slate-400 hover:text-slate-600 transition-colors">
            <HelpCircle size={20} />
          </button>
        </Tooltip>
      </div>

      {!checkingToken && !hasToken && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900 ml-2 flex items-center justify-between">
            <span>Configura tu API Token de Replicate primero</span>
            <Button
              variant="link"
              className="text-amber-900 underline p-0"
              onClick={() => (window.location.href = '/settings')}
            >
              Ir a Ajustes
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-semibold text-slate-900">Como funciona el cobro?</h2>
          <Tooltip
            content="No hay suscripciones. Solo pagas por cada imagen que procesas."
            position="right"
          >
            <button className="text-slate-400 hover:text-slate-600">
              <HelpCircle size={16} />
            </button>
          </Tooltip>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Removin usa <strong>Replicate</strong> para procesar imagenes con IA. Tu pagas
          directamente a Replicate segun lo que uses (pago por uso).
        </p>

        <div className="bg-slate-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700">Remover fondo</span>
              <Tooltip
                content="Costo aproximado usando el modelo estandar. Varia segun el modelo elegido."
                position="right"
              >
                <HelpCircle size={14} className="text-slate-400" />
              </Tooltip>
            </div>
            <span className="text-sm font-medium text-slate-900">~$0.0002 - $0.001 / imagen</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700">Generar imagen</span>
              <Tooltip
                content="Generacion con SDXL 1.0. El tiempo y costo dependen del tamano de imagen."
                position="right"
              >
                <HelpCircle size={14} className="text-slate-400" />
              </Tooltip>
            </div>
            <span className="text-sm font-medium text-slate-900">~$0.003 / imagen</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700">Almacenamiento temporal</span>
              <Tooltip
                content="Las imagenes se guardan temporalmente en tablas seguras de Supabase con acceso firmado. No hay costo adicional."
                position="right"
              >
                <HelpCircle size={14} className="text-slate-400" />
              </Tooltip>
            </div>
            <span className="text-sm font-medium text-green-600">Incluido</span>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-semibold text-slate-900">Gestionar tu cuenta de Replicate</h2>
          <Tooltip
            content="Todas las transacciones y facturacion se manejan directamente en Replicate"
            position="right"
          >
            <button className="text-slate-400 hover:text-slate-600">
              <HelpCircle size={16} />
            </button>
          </Tooltip>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Para ver tu uso detallado, agregar creditos o gestionar tu facturacion, accede
          directamente a tu cuenta de Replicate.
        </p>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-between h-11"
            onClick={() => window.open('https://replicate.com/account/billing', '_blank')}
          >
            <span className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Ver Facturacion
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
              Agregar Creditos
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

      <div className="text-center text-xs text-slate-500 py-4">
        Los precios son aproximados y pueden variar segun el modelo de IA utilizado
      </div>
    </div>
  );
}
