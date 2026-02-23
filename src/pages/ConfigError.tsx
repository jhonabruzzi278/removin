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
          <CardTitle className="text-2xl font-bold text-slate-900">
            Configuración Requerida
          </CardTitle>
          <CardDescription className="text-base">
            Necesitas configurar Firebase para usar la aplicación
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Variables de entorno no configuradas</AlertTitle>
            <AlertDescription>
              No se encontraron las credenciales de Firebase en el archivo .env
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Pasos para configurar:
            </h3>
            
            <ol className="space-y-4 list-decimal list-inside text-sm text-slate-700">
              <li className="pl-2">
                <strong>Crea un proyecto en Firebase</strong>
                <p className="ml-6 mt-1 text-slate-600">
                  Ve a <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                    console.firebase.google.com <ExternalLink size={12} />
                  </a> y crea un nuevo proyecto gratuito
                </p>
              </li>
              
              <li className="pl-2">
                <strong>Habilita Autenticación y Storage</strong>
                <p className="ml-6 mt-1 text-slate-600">
                  En Authentication, habilita el proveedor de Google. En Storage, crea un bucket predeterminado.
                </p>
              </li>
              
              <li className="pl-2">
                <strong>Obtén tus credenciales</strong>
                <p className="ml-6 mt-1 text-slate-600">
                  En Project Settings → General, añade una Web App (ícono &lt;/&gt;) y copia la configuración:
                </p>
              </li>
              
              <li className="pl-2">
                <strong>Configura el archivo .env</strong>
                <div className="ml-6 mt-2 bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-xs">
                  <div>VITE_FIREBASE_API_KEY=tu_api_key</div>
                  <div>VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com</div>
                  <div>VITE_FIREBASE_PROJECT_ID=tu_proyecto_id</div>
                  <div>VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com</div>
                  <div>VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id</div>
                  <div>VITE_FIREBASE_APP_ID=tu_app_id</div>
                  <div className="text-slate-500">VITE_API_URL=http://localhost:3001</div>
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
            <Button
              className="w-full"
              onClick={() => window.location.reload()}
            >
              Ya configuré las credenciales - Recargar
            </Button>
          </div>

          <p className="text-xs text-center text-slate-500">
            Necesitas ayuda? Consulta el <a href="https://github.com/tuusuario/removin/blob/main/README.md" className="text-blue-600 hover:underline">README.md</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
