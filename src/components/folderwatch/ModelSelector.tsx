import { CheckCircle2, Star, HelpCircle } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { AIModel } from '@/data/models';

interface ModelSelectorProps {
  models: AIModel[];
  selectedModel: AIModel | null;
  isMonitoring: boolean;
  onSelectModel: (model: AIModel) => void;
  getQualityLevel: (quality: string) => number;
  getPricing: (cost: number) => string;
}

export function ModelSelector({
  models,
  selectedModel,
  isMonitoring,
  onSelectModel,
  getQualityLevel,
  getPricing,
}: ModelSelectorProps) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b-2 border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900">Modelo de IA</h2>
          <Tooltip
            content="Selecciona el modelo que se usará para eliminar el fondo de todas las imágenes"
            position="right"
          >
            <button className="text-slate-400 hover:text-slate-600 transition-colors">
              <HelpCircle size={14} />
            </button>
          </Tooltip>
        </div>
        <p className="text-xs font-medium text-slate-500 mt-0.5">
          Elige el equilibrio entre velocidad, calidad y costo
        </p>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {models.map((model) => {
          const quality = getQualityLevel(model.quality);
          const tier = quality >= 4 ? "Premium" : quality >= 3 ? "Estándar" : "Económico";
          const tierColor =
            quality >= 4
              ? "bg-violet-600 text-white"
              : quality >= 3
              ? "bg-blue-600 text-white"
              : "bg-slate-600 text-white";
          const isSelected = selectedModel?.id === model.id;

          return (
            <button
              key={model.id}
              onClick={() => onSelectModel(model)}
              disabled={isMonitoring}
              className={cn(
                "relative p-4 rounded-xl border-2 text-left transition-all duration-150 disabled:grayscale disabled:cursor-not-allowed",
                isSelected
                  ? "border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100"
                  : "border-slate-200 bg-white hover:border-indigo-400 hover:shadow-sm"
              )}
            >
              {isSelected && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shadow">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </span>
              )}

              <div className="flex items-center gap-0.5 mb-2.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={12}
                    className={
                      i < quality
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300 fill-slate-200"
                    }
                  />
                ))}
              </div>

              <p className="text-sm font-bold text-slate-900 leading-snug mb-2 pr-5">
                {model.name}
              </p>

              <div className="flex items-center justify-between">
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", tierColor)}>
                  {tier}
                </span>
                <span className="text-xs font-bold font-mono text-slate-700">
                  {getPricing(model.costPerRun)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
