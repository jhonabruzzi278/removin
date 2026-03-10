import { CheckCircle2, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FolderSelectorProps {
  label: 'Entrada' | 'Salida';
  folder: FileSystemDirectoryHandle | null;
  isMonitoring: boolean;
  description: string;
  selectedDescription: string;
  colorScheme: 'emerald' | 'indigo';
  onSelect: () => void;
}

export function FolderSelector({
  label,
  folder,
  isMonitoring,
  description,
  selectedDescription,
  colorScheme,
  onSelect,
}: FolderSelectorProps) {
  const colors = {
    emerald: {
      border: 'border-emerald-500',
      bg: 'bg-emerald-100',
      iconBg: 'bg-emerald-500',
      text: 'text-emerald-900',
      descText: 'text-emerald-700',
    },
    indigo: {
      border: 'border-indigo-500',
      bg: 'bg-indigo-100',
      iconBg: 'bg-indigo-600',
      text: 'text-indigo-900',
      descText: 'text-indigo-700',
    },
  };

  const scheme = colors[colorScheme];

  return (
    <div
      className={cn(
        "group rounded-2xl border-2 transition-all duration-200 overflow-hidden",
        folder
          ? `${scheme.border} ${scheme.bg}`
          : "border-dashed border-slate-300 bg-white hover:border-indigo-500 hover:bg-indigo-50",
        isMonitoring && "pointer-events-none grayscale"
      )}
    >
      <button
        onClick={onSelect}
        disabled={isMonitoring}
        className="w-full p-5 text-left"
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              folder ? scheme.iconBg : "bg-slate-100 group-hover:bg-indigo-200"
            )}
          >
            {folder ? (
              <CheckCircle2 className="w-5 h-5 text-white" />
            ) : (
              <Folder className="w-5 h-5 text-slate-600 group-hover:text-indigo-700" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">
              {label}
            </p>
            <p
              className={cn(
                "text-sm font-bold truncate",
                folder ? scheme.text : "text-slate-700"
              )}
            >
              {folder ? folder.name : "Seleccionar carpeta"}
            </p>
          </div>
        </div>
        <p
          className={cn(
            "text-xs font-medium",
            folder ? scheme.descText : "text-slate-500"
          )}
        >
          {folder ? selectedDescription : description}
        </p>
      </button>
    </div>
  );
}
