import { Activity, CheckCircle2, AlertCircle, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FolderWatchStatsProps {
  total: number;
  success: number;
  errors: number;
  tracked: number;
}

export function FolderWatchStats({ total, success, errors, tracked }: FolderWatchStatsProps) {
  const stats = [
    { 
      label: "Total", 
      value: total, 
      color: "text-slate-950", 
      bg: "bg-slate-100", 
      border: "border-slate-400", 
      icon: <Activity className="w-4 h-4 text-slate-600" /> 
    },
    { 
      label: "Exitosas", 
      value: success, 
      color: "text-emerald-900", 
      bg: "bg-emerald-100", 
      border: "border-emerald-500", 
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 
    },
    { 
      label: "Errores", 
      value: errors, 
      color: "text-rose-900", 
      bg: "bg-rose-100", 
      border: "border-rose-500", 
      icon: <AlertCircle className="w-4 h-4 text-rose-600" /> 
    },
    { 
      label: "Rastreados", 
      value: tracked, 
      color: "text-indigo-900", 
      bg: "bg-indigo-100", 
      border: "border-indigo-500", 
      icon: <Folder className="w-4 h-4 text-indigo-600" /> 
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(({ label, value, color, bg, border, icon }) => (
        <div key={label} className={cn("rounded-2xl border-2 p-4 flex flex-col gap-2", bg, border)}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{label}</span>
            {icon}
          </div>
          <span className={cn("text-4xl font-black tracking-tight", color)}>{value}</span>
        </div>
      ))}
    </div>
  );
}
