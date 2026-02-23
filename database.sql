-- ================================================
-- 🗄️ BASE DE DATOS REMOVIN SAAS
-- ================================================
-- Ejecuta este SQL en el dashboard de Supabase

-- 1. Tabla de configuración de usuarios
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  replicate_api_token TEXT,
  has_custom_token BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de suscripciones (para futuro)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 3. Tabla de historial de procesamiento
CREATE TABLE IF NOT EXISTS public.processing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('remove-bg', 'generate', 'compress')),
  credits_used INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_history_user_id ON public.processing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_history_created_at ON public.processing_history(created_at DESC);

-- ================================================
-- 🔒 ROW LEVEL SECURITY (RLS)
-- ================================================

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_history ENABLE ROW LEVEL SECURITY;

-- Políticas para user_settings
DROP POLICY IF EXISTS "Users can read own settings" ON public.user_settings;
CREATE POLICY "Users can read own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = id);

-- Políticas para subscriptions
DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;
CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Políticas para processing_history
DROP POLICY IF EXISTS "Users can read own history" ON public.processing_history;
CREATE POLICY "Users can read own history"
  ON public.processing_history FOR SELECT
  USING (auth.uid() = user_id);

-- ================================================
-- 📊 VISTAS ÚTILES
-- ================================================

-- Vista de uso mensual por usuario
CREATE OR REPLACE VIEW public.monthly_usage AS
SELECT 
  user_id,
  DATE_TRUNC('month', created_at) as month,
  job_type,
  COUNT(*) as total_jobs,
  SUM(credits_used) as total_credits
FROM public.processing_history
GROUP BY user_id, DATE_TRUNC('month', created_at), job_type;

-- Comentarios
COMMENT ON TABLE public.user_settings IS 'Configuración y tokens de API por usuario';
COMMENT ON TABLE public.subscriptions IS 'Planes de suscripción (free, pro, enterprise)';
COMMENT ON TABLE public.processing_history IS 'Historial de procesamiento para billing y analytics';
