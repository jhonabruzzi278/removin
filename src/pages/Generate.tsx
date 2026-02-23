import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/api';
import {
  Sparkles, Wand2, Download, Loader2, Image as ImageIcon,
  ChevronDown, ChevronUp, RefreshCw, Copy, Check
} from 'lucide-react';

// ─── Tipos ──────────────────────────────────────────────────
type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:2';

interface HistoryEntry {
  id: string;
  url: string;
  prompt: string;
  time: number;
}

// ─── Config ─────────────────────────────────────────────────
const RATIOS: Record<AspectRatio, { w: number; h: number; label: string }> = {
  '1:1':  { w: 1024, h: 1024, label: 'Cuadrado' },
  '16:9': { w: 1024, h: 576,  label: 'Paisaje' },
  '9:16': { w: 576,  h: 1024, label: 'Vertical' },
  '4:3':  { w: 1024, h: 768,  label: 'Clásico' },
  '3:2':  { w: 1024, h: 682,  label: 'Foto' },
};

const SCHEDULERS = [
  { value: 'DPMSolverMultistep', label: 'DPM++ 2M' },
  { value: 'K_EULER',            label: 'Euler' },
  { value: 'K_EULER_ANCESTRAL',  label: 'Euler a' },
  { value: 'DDIM',               label: 'DDIM' },
];

const STYLES = [
  { label: 'Realista',       suffix: 'photorealistic, highly detailed, 8k, sharp focus' },
  { label: 'Digital Art',    suffix: 'digital art, vibrant colors, concept art, trending on artstation' },
  { label: 'Anime',          suffix: 'anime style, cel shading, vibrant, detailed' },
  { label: 'Óleo',           suffix: 'oil painting, rich textures, dramatic lighting, masterwork' },
  { label: 'Cinematic',      suffix: 'cinematic, dramatic lighting, film still, anamorphic, bokeh' },
  { label: '3D',             suffix: '3D render, octane render, volumetric lighting, unreal engine 5' },
];

const EXAMPLES = [
  'A serene Japanese garden with cherry blossoms and a koi pond, golden hour, photorealistic',
  'Futuristic cyberpunk city at night, neon signs, rain-soaked streets, cinematic',
  'Cozy coffee shop interior, warm lighting, books, indoor plants, morning sunlight',
  'Astronaut on Mars, Earth in the sky, dramatic red landscape, volumetric dust, 8k',
];

const DEFAULT_NEGATIVE = 'ugly, blurry, poor quality, distorted, deformed, bad anatomy, watermark, text';
const COST_PER_RUN = 0.0095;

// ─── Componente ─────────────────────────────────────────────
export default function GeneratePage() {
  const { user } = useAuth();
  const { toasts, dismiss, error: showError, success: showSuccess } = useToast();

  // Form
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState(DEFAULT_NEGATIVE);
  const [ratio, setRatio] = useState<AspectRatio>('1:1');
  const [steps, setSteps] = useState(30);
  const [cfg, setCfg] = useState(7.5);
  const [scheduler, setScheduler] = useState('DPMSolverMultistep');

  // UI
  const [showOptions, setShowOptions] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const dims = RATIOS[ratio];

  // ── Generate ──────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!prompt.trim() || !user || isProcessing) return;
    setIsProcessing(true);
    setResult(null);
    const t0 = Date.now();

    try {
      const data = await apiClient.generateImage(prompt.trim(), negativePrompt.trim() || undefined, {
        width: dims.w, height: dims.h,
        num_inference_steps: steps,
        guidance_scale: cfg,
        scheduler,
      });
      if (!data.success || data.error) throw new Error(data.error || 'Error al generar');

      const elapsed = (Date.now() - t0) / 1000;
      setResult(data.outputUrl);
      setTime(elapsed);
      setHistory(prev => [{ id: crypto.randomUUID(), url: data.outputUrl, prompt: prompt.trim(), time: elapsed }, ...prev].slice(0, 12));
      showSuccess('Imagen generada');
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setIsProcessing(false);
    }
  }, [prompt, negativePrompt, user, isProcessing, dims, steps, cfg, scheduler, showSuccess, showError]);

  // ── Keyboard shortcut ─────────────────────────────────────
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && prompt.trim() && !isProcessing) {
        e.preventDefault();
        generate();
      }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [generate, prompt, isProcessing]);

  // ── Helpers ───────────────────────────────────────────────
  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result;
    a.download = `removin_${Date.now()}.png`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyPrompt = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const addStyle = (suffix: string) => {
    setPrompt(prev => {
      const base = prev.trim();
      if (!base) return suffix;
      if (base.includes(suffix)) return base;
      return `${base}, ${suffix}`;
    });
    promptRef.current?.focus();
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-purple-600" />
          Generar Imagen
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          SDXL por Stability AI &middot; ~${COST_PER_RUN} por imagen &middot; Escribe en inglés para mejores resultados
        </p>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left: Form ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">

            {/* Prompt */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="prompt" className="text-sm font-medium text-slate-700">
                  Prompt
                </Label>
                <div className="flex items-center gap-1.5">
                  {prompt && (
                    <button
                      onClick={copyPrompt}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label="Copiar prompt"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <span className={`text-xs tabular-nums ${prompt.length > 900 ? 'text-amber-500' : 'text-slate-400'}`}>
                    {prompt.length}/1000
                  </span>
                </div>
              </div>
              <textarea
                ref={promptRef}
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 1000))}
                rows={4}
                placeholder="A cozy mountain cabin in winter, snow falling, warm light from windows, photorealistic, 8k..."
                className="w-full p-3 rounded-lg border border-slate-200/80 bg-white/90 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400 transition-all placeholder:text-slate-400"
                aria-required="true"
              />
              <p className="text-[11px] text-slate-400">
                Tip: Incluye estilo, iluminación y calidad. <kbd className="px-1 py-px bg-slate-100 rounded text-[10px]">Ctrl+Enter</kbd> para generar.
              </p>
            </div>

            {/* Estilos rápidos */}
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map(s => (
                <button
                  key={s.label}
                  onClick={() => addStyle(s.suffix)}
                  className="text-xs px-2.5 py-1 rounded-full border border-slate-200/80 bg-white/60 text-slate-600 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50/80 transition-all"
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Tamaño</Label>
              <div className="flex gap-1.5" role="radiogroup" aria-label="Relación de aspecto">
                {(Object.entries(RATIOS) as [AspectRatio, typeof RATIOS[AspectRatio]][]).map(([key, val]) => (
                  <button
                    key={key}
                    role="radio"
                    aria-checked={ratio === key}
                    onClick={() => setRatio(key)}
                    className={`flex-1 py-2 rounded-lg text-center transition-all text-xs font-medium ${
                      ratio === key
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white/70 text-slate-600 hover:bg-white border border-slate-200/60'
                    }`}
                  >
                    <div>{key}</div>
                    <div className={`text-[10px] ${ratio === key ? 'text-purple-200' : 'text-slate-400'}`}>
                      {val.w}×{val.h}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Opciones avanzadas (colapsable) */}
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors py-1"
              aria-expanded={showOptions}
            >
              {showOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Opciones avanzadas
            </button>

            {showOptions && (
              <div className="space-y-4 pl-3 border-l-2 border-purple-200/60 ml-1">
                {/* Negative Prompt */}
                <div className="space-y-1">
                  <Label htmlFor="neg" className="text-xs text-slate-500">Prompt negativo</Label>
                  <Input
                    id="neg"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="ugly, blurry, distorted..."
                    className="text-xs h-8 bg-white/90 border-slate-200/80"
                  />
                </div>

                {/* Steps */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <Label htmlFor="steps" className="text-xs text-slate-500">Pasos</Label>
                    <span className="text-xs font-mono text-slate-600">{steps}</span>
                  </div>
                  <input
                    id="steps"
                    type="range"
                    min={10} max={50} step={5}
                    value={steps}
                    onChange={(e) => setSteps(Number(e.target.value))}
                    className="w-full accent-purple-600 h-1.5"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Rápido</span><span>Detallado</span>
                  </div>
                </div>

                {/* CFG */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <Label htmlFor="cfg" className="text-xs text-slate-500">Guidance (CFG)</Label>
                    <span className="text-xs font-mono text-slate-600">{cfg}</span>
                  </div>
                  <input
                    id="cfg"
                    type="range"
                    min={1} max={20} step={0.5}
                    value={cfg}
                    onChange={(e) => setCfg(Number(e.target.value))}
                    className="w-full accent-purple-600 h-1.5"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Creativo</span><span>Fiel al prompt</span>
                  </div>
                </div>

                {/* Scheduler */}
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Sampler</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {SCHEDULERS.map(s => (
                      <button
                        key={s.value}
                        onClick={() => setScheduler(s.value)}
                        className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                          scheduler === s.value
                            ? 'bg-slate-800 text-white'
                            : 'bg-white/70 text-slate-600 hover:bg-white border border-slate-200/60'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Botón generar */}
            <button
              onClick={generate}
              disabled={!prompt.trim() || isProcessing}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <span className="flex items-center gap-2 text-sm">
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generar
                  </>
                )}
              </span>
            </button>

            {/* Ejemplos */}
            <div className="space-y-1.5">
              <p className="text-[11px] text-slate-400 uppercase tracking-wide">Ejemplos</p>
              <div className="space-y-1">
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => { setPrompt(ex); promptRef.current?.focus(); }}
                    className="w-full text-left text-xs text-slate-500 hover:text-slate-800 hover:bg-white/60 px-2.5 py-2 rounded-md transition-colors truncate"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>

        {/* ── Right: Result ── */}
        <div className="space-y-4" ref={resultRef}>

          {/* Canvas / Preview */}
          <div
            className={`rounded-xl border bg-slate-50 flex items-center justify-center overflow-hidden transition-all ${
              result ? 'border-slate-200' : 'border-2 border-dashed border-slate-300'
            }`}
            style={{ minHeight: 380, aspectRatio: `${dims.w}/${dims.h}` }}
          >
              {/* Vacío */}
              {!result && !isProcessing && (
                <div className="text-center p-6">
                  <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Tu imagen aparecerá aquí</p>
                  <p className="text-xs text-slate-300 mt-1">{dims.w} × {dims.h} px</p>
                </div>
              )}

              {/* Procesando */}
              {isProcessing && (
                <div className="text-center p-6" role="status" aria-live="polite">
                  <Loader2 className="w-8 h-8 text-purple-500 mx-auto mb-3 animate-spin" />
                  <p className="text-sm text-slate-600">Generando imagen...</p>
                  <p className="text-xs text-slate-400 mt-1">Esto puede tomar 15-30 segundos</p>
                </div>
              )}

              {/* Resultado */}
              {result && !isProcessing && (
                <img
                  src={result}
                  alt={`Generada: ${prompt.slice(0, 100)}`}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

          {/* Acciones post-generación */}
          {result && !isProcessing && (
            <div className="flex gap-2">
              <button
                onClick={download}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 text-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar
              </button>
              <button
                onClick={generate}
                disabled={isProcessing}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Stats */}
          {result && time > 0 && (
            <div className="flex gap-4 text-xs text-slate-400">
              <span>{time.toFixed(1)}s</span>
              <span>~${COST_PER_RUN}</span>
              <span>{dims.w}×{dims.h}</span>
              <span>{steps} pasos</span>
            </div>
          )}

          {/* Historial */}
          {history.length > 1 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-400 uppercase tracking-wide">Recientes</p>
                <button
                  onClick={() => setHistory([])}
                  className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Limpiar
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {history.map(h => (
                  <button
                    key={h.id}
                    onClick={() => {
                      setPrompt(h.prompt);
                      setResult(h.url);
                      setTime(h.time);
                    }}
                    className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:border-purple-400 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
                    aria-label={`Cargar: ${h.prompt.slice(0, 40)}`}
                  >
                    <img src={h.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Info rápida del modelo */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5 text-xs text-slate-500">
            <p className="font-medium text-slate-700 text-xs">Sobre el modelo</p>
            <p>
              <strong>SDXL 1.0</strong> por Stability AI vía Replicate. Genera imágenes de alta calidad
              a partir de texto. Soporta múltiples estilos, desde fotorrealismo hasta ilustración.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px]">
              <span>Costo: <strong>${COST_PER_RUN}/img</strong></span>
              <span>Tiempo: <strong>15-30s</strong></span>
              <span>Max: <strong>1024×1024</strong></span>
              <span>Límite: <strong>~5 req/min</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </div>
  );
}
