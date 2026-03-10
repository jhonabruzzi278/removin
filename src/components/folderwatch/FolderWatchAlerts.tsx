import { Loader2, AlertCircle, RefreshCw, Zap, Clock } from 'lucide-react';

interface FolderWatchAlertsProps {
  isRestoring: boolean;
  isMonitoring: boolean;
  useObserver: boolean;
  lastScanTime: Date | null;
  scanCount: number;
  checkingToken: boolean;
  hasToken: boolean;
  getTimeSinceLastScan: () => string;
  onRefreshToken: () => void;
}

export function FolderWatchAlerts({
  isRestoring,
  isMonitoring,
  useObserver,
  lastScanTime,
  scanCount,
  checkingToken,
  hasToken,
  getTimeSinceLastScan,
  onRefreshToken,
}: FolderWatchAlertsProps) {
  return (
    <div className="space-y-3">
      {/* Restaurando */}
      {isRestoring && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-100 border-2 border-indigo-300">
          <Loader2 className="h-4 w-4 text-indigo-700 animate-spin shrink-0" />
          <p className="text-sm font-medium text-indigo-900">
            <span className="font-bold">Restaurando carpetas</span> guardadas anteriormente…
          </p>
        </div>
      )}

      {/* Monitoreo activo */}
      {isMonitoring && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl bg-emerald-100 border-2 border-emerald-400">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-emerald-900">Monitoreo activo</span>
                {useObserver ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                    <Zap size={10} />
                    Observer + Respaldo 10s
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                    <Clock size={10} />
                    Escaneo cada 3s
                  </span>
                )}
              </div>
              {!useObserver && lastScanTime && (
                <p className="text-xs font-medium text-emerald-800 mt-0.5">
                  Último escaneo: {getTimeSinceLastScan()} · #{scanCount}
                </p>
              )}
              {useObserver && (
                <p className="text-xs font-medium text-emerald-800 mt-0.5">
                  Detección instantánea con escaneo de respaldo cada 10 segundos
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Token no configurado */}
      {!checkingToken && !hasToken && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl bg-amber-100 border-2 border-amber-400">
          <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
          <p className="text-sm font-medium text-amber-900 flex-1">
            <span className="font-bold">Token requerido:</span> Configura tu token de Replicate
            para usar esta función.
          </p>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              onClick={onRefreshToken}
              className="text-xs font-bold text-amber-700 hover:text-amber-900 whitespace-nowrap flex items-center gap-1"
            >
              <RefreshCw size={12} /> Reintentar
            </button>
            <button
              onClick={() => (window.location.href = '/settings')}
              className="text-xs font-bold text-amber-900 underline underline-offset-2 hover:text-amber-700 whitespace-nowrap"
            >
              Ir a Ajustes →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
