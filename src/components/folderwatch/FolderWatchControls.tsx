import { Play, Pause, RefreshCw, Trash2 } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

interface FolderWatchControlsProps {
  isMonitoring: boolean;
  canStart: boolean;
  onStart: () => void;
  onStop: () => void;
  onForceScan: () => void;
  onReset: () => void;
}

export function FolderWatchControls({
  isMonitoring,
  canStart,
  onStart,
  onStop,
  onForceScan,
  onReset,
}: FolderWatchControlsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {!isMonitoring ? (
        <button
          onClick={onStart}
          disabled={!canStart}
          className="flex-1 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-bold tracking-wide transition-all duration-150 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <Play className="w-4 h-4" />
          Iniciar Monitoreo
        </button>
      ) : (
        <>
          <button
            onClick={onStop}
            className="flex-1 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-sm font-bold tracking-wide transition-all duration-150 shadow-md shadow-rose-200 hover:shadow-lg hover:shadow-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
          >
            <Pause className="w-4 h-4" />
            Detener Monitoreo
          </button>
          <Tooltip content="Forzar escaneo inmediato de la carpeta" position="top">
            <button
              onClick={onForceScan}
              className="inline-flex items-center justify-center h-12 w-12 rounded-xl border-2 border-slate-300 bg-white hover:border-indigo-600 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </Tooltip>
        </>
      )}
      <Tooltip content="Reiniciar estadísticas y lista de archivos procesados" position="top">
        <button
          onClick={onReset}
          className="inline-flex items-center justify-center h-12 w-12 rounded-xl border-2 border-slate-300 bg-white hover:border-rose-500 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </Tooltip>
    </div>
  );
}
