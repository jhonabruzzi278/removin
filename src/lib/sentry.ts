/**
 * Configuración de Sentry para monitoreo de errores en producción
 * https://docs.sentry.io/platforms/javascript/guides/react/
 */

import * as Sentry from '@sentry/react';

// DSN de Sentry configurado
const SENTRY_DSN = "https://694639b5ae1656b1c5084857a1a4ce1b@o4510275775561728.ingest.us.sentry.io/4511020474630144";

// Determinar si Sentry debe estar activo
const isSentryEnabled = () => import.meta.env.PROD || import.meta.env.VITE_DEBUG_SENTRY === 'true';

export function initSentry() {
  if (isSentryEnabled()) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      sendDefaultPii: false, // No enviar datos personales por defecto
      
      // Performance monitoring
      tracesSampleRate: 0.1, // 10% de transacciones
      
      // Session replay (opcional, consume más recursos)
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      // Filtrar errores no relevantes
      ignoreErrors: [
        // Errores de red comunes
        'Network request failed',
        'Failed to fetch',
        'Load failed',
        // Errores de extensiones de navegador
        /^chrome-extension:/,
        /^moz-extension:/,
        // Errores de ResizeObserver (comunes y no críticos)
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
      ],
      
      // Sanitizar datos sensibles
      beforeSend(event) {
        // Remover tokens de las URLs
        if (event.request?.url) {
          event.request.url = event.request.url.replace(/token=[^&]+/g, 'token=[REDACTED]');
        }
        
        // Remover datos de usuario sensibles
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
        }
        
        return event;
      },
    });
    
    console.info('🔍 Sentry inicializado para monitoreo de errores');
  }
}

/**
 * Capturar error manualmente con contexto adicional
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (isSentryEnabled()) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    console.error('Error capturado:', error, context);
  }
}

/**
 * Añadir contexto de usuario para mejor tracking
 */
export function setUserContext(userId: string | null) {
  if (isSentryEnabled()) {
    if (userId) {
      Sentry.setUser({ id: userId.slice(0, 8) }); // Solo primeros 8 chars por privacidad
    } else {
      Sentry.setUser(null);
    }
  }
}

/**
 * Añadir breadcrumb para debugging
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>) {
  if (isSentryEnabled()) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }
}

// Re-exportar Sentry para uso directo si es necesario
export { Sentry };
