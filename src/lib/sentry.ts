import * as Sentry from '@sentry/react';

function getSentryDsn(): string | null {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || typeof dsn !== 'string') {
    return null;
  }

  const trimmed = dsn.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isSentryEnabled(): boolean {
  return Boolean(getSentryDsn()) && (import.meta.env.PROD || import.meta.env.VITE_DEBUG_SENTRY === 'true');
}

export function initSentry() {
  const dsn = getSentryDsn();
  if (!dsn || !isSentryEnabled()) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    ignoreErrors: [
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      /^chrome-extension:/,
      /^moz-extension:/,
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = event.request.url.replace(/token=[^&]+/g, 'token=[REDACTED]');
      }

      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }

      return event;
    },
  });
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (isSentryEnabled()) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    console.error('Error capturado:', error, context);
  }
}

export function setUserContext(userId: string | null) {
  if (!isSentryEnabled()) {
    return;
  }

  if (userId) {
    Sentry.setUser({ id: userId.slice(0, 8) });
  } else {
    Sentry.setUser(null);
  }
}

export function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>) {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

export { Sentry };
