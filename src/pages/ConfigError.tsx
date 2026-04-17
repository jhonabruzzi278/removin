import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, ExternalLink, Settings } from 'lucide-react';

export default function ConfigErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 via-red-50 to-slate-100 p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="mx-auto bg-red-100 p-4 rounded-full w-fit">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">Configuracion Requerida</CardTitle>
          <CardDescription className="text-base">
            Necesitas configurar Supabase (Auth + DB) para usar la aplicacion
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Variables de entorno no configuradas</AlertTitle>
            <AlertDescription>
              No se encontraron las credenciales de Supabase en el archivo .env
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Pasos para configurar:
            </h3>

            <ol className="space-y-4 list-decimal list-inside text-sm text-slate-700">
              <li className="pl-2">
                <strong>Crea un proyecto en Supabase</strong>
                <p className="ml-6 mt-1 text-slate-600">
                  Ve a{' '}
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    supabase.com/dashboard <ExternalLink size={12} />
                  </a>{' '}
                  y habilita Google Sign-In en Authentication.
                </p>
              </li>

              <li className="pl-2">
                <strong>Configura el archivo .env</strong>
                <div className="ml-6 mt-2 bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-xs">
                  <div>VITE_SUPABASE_URL=https://xxxx.supabase.co</div>
                  <div>VITE_SUPABASE_ANON_KEY=eyJ...</div>
                  <div className="text-slate-500">VITE_API_URL=http://localhost:3001</div>
                </div>
              </li>

              <li className="pl-2">
                <strong>Configura el backend (api/.env)</strong>
                <div className="ml-6 mt-2 bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-xs">
                  <div>SUPABASE_URL=https://xxxx.supabase.co</div>
                  <div>SUPABASE_SERVICE_ROLE_KEY=eyJ...</div>
                  <div>DATABASE_URL=postgresql://...neon...</div>
                </div>
              </li>

              <li className="pl-2">
                <strong>Reinicia el servidor de desarrollo</strong>
                <div className="ml-6 mt-2 bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-xs">
                  npm run dev
                </div>
              </li>
            </ol>
          </div>

          <div className="pt-4 border-t">
            <Button className="w-full" onClick={() => window.location.reload()}>
              Ya configure las credenciales - Recargar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
