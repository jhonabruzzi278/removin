import { Activity, HelpCircle } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

interface FolderWatchHeaderProps {
  whiteBackground: boolean;
  onToggleWhiteBackground: () => void;
}

export function FolderWatchHeader({
  whiteBackground,
  onToggleWhiteBackground,
}: FolderWatchHeaderProps) {
  return (
    <div className="pt-2">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Título */}
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-indigo-200">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Auto Monitor</h1>
              <Tooltip
                content="Monitorea una carpeta y procesa automáticamente las imágenes nuevas que detecte"
                position="right"
              >
                <button className="text-slate-400 hover:text-slate-600 transition-colors">
                  <HelpCircle size={16} />
                </button>
              </Tooltip>
            </div>
            <p className="text-sm font-medium text-slate-500 mt-0.5">
              Detección automática · Procesamiento en cola · Sin intervención manual
            </p>
          </div>
        </div>

        {/* Toggle Fondo Blanco */}
        <div className="flex items-center gap-2.5 bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 self-start shadow-sm">
          <div className="w-4 h-4 rounded-full border-2 border-slate-500 bg-white shrink-0" />
          <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">
            Fondo Blanco
          </span>
          <Tooltip
            content="Guarda las imágenes con fondo blanco (JPG) en lugar de transparente (PNG)"
            position="left"
          >
            <button className="text-slate-400 hover:text-slate-600 transition-colors">
              <HelpCircle size={14} />
            </button>
          </Tooltip>
          <button
            role="switch"
            aria-checked={whiteBackground}
            onClick={onToggleWhiteBackground}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
              whiteBackground ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                whiteBackground ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
