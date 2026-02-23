import { NavLink } from 'react-router-dom';
import { Layers, Zap, Settings, Sparkles, Wand2, CreditCard, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { name: 'Remove BG', path: '/', icon: Layers },
  { name: 'Generate', path: '/generate', icon: Wand2, badge: 'New' },
  { name: 'Compress', path: '/compress', icon: Zap },
  { name: 'Auto Monitor', path: '/folder-watch', icon: Activity, badge: 'New' },
  { name: 'Usage & Billing', path: '/usage', icon: CreditCard },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export function Sidebar() {
  const usagePercent = 0; // 0 de 300

  return (
    <aside className="hidden md:flex flex-col w-64 bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 text-white h-screen fixed left-0 top-0 border-r border-slate-800 z-50">
      {/* Logo Area */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800/50 bg-linear-to-r from-slate-900 to-slate-800/50">
        <div className="flex items-center gap-2.5">
          <div className="bg-linear-to-br from-blue-500 to-blue-600 p-2 rounded-xl shadow-lg shadow-blue-900/50">
            <Sparkles className="text-white w-4 h-4" />
          </div>
          <span className="text-lg font-bold tracking-tight bg-linear-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Removin
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group relative overflow-hidden",
                isActive 
                  ? "bg-linear-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25" 
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3">
                  <item.icon size={18} className="transition-transform group-hover:scale-110" />
                  <span>{item.name}</span>
                </div>
                {item.badge && !isActive && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-slate-800 text-slate-400">
                    {item.badge}
                  </Badge>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer / Status Area */}
      <div className="p-4 border-t border-slate-800/50 bg-linear-to-b from-transparent to-slate-950/50">
        <div className="space-y-3 bg-slate-800/30 backdrop-blur-sm rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Uso Diario</span>
            <span className="text-slate-200 font-semibold">
              {Math.round((usagePercent / 100) * 300)} / 300
            </span>
          </div>
          <Progress value={usagePercent} className="h-1.5 bg-slate-700" />
          <p className="text-[10px] text-slate-500">
            Renueva en <span className="text-slate-400 font-semibold">24h</span>
          </p>
        </div>
      </div>
    </aside>
  );
}