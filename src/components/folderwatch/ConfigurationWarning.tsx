import { Info } from 'lucide-react';

interface ConfigurationWarningProps {
  hasInputDir: boolean;
  hasOutputDir: boolean;
  hasModel: boolean;
  hasToken: boolean;
  checkingToken: boolean;
  isMonitoring: boolean;
}

export function ConfigurationWarning({
  hasInputDir,
  hasOutputDir,
  hasModel,
  hasToken,
  checkingToken,
  isMonitoring,
}: ConfigurationWarningProps) {
  if (isMonitoring) return null;
  
  const needsConfiguration = !hasInputDir || !hasOutputDir || !hasModel || (!checkingToken && !hasToken);
  
  if (!needsConfiguration) return null;

  const getMessage = () => {
    if (!hasInputDir || !hasOutputDir) {
      return "Selecciona la carpeta de entrada y salida para continuar";
    }
    if (!hasModel) {
      return "Selecciona un modelo de IA para continuar";
    }
    return "Configura tu token de Replicate en Ajustes para continuar";
  };

  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-100 border-2 border-slate-300">
      <Info className="h-4 w-4 text-slate-600 shrink-0" />
      <p className="text-sm font-medium text-slate-700">{getMessage()}</p>
    </div>
  );
}
