import React, { useEffect, useMemo, useState } from 'react';

type CapturedError = {
  type: 'error' | 'unhandledrejection' | 'react';
  message: string;
  stack?: string;
  time: number;
};

const formatTime = (t: number) => new Date(t).toLocaleTimeString();

export function DevRuntimeErrorOverlay() {
  const [errors, setErrors] = useState<CapturedError[]>([]);

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      const message =
        e.message ||
        (e.error && (e.error as any).message) ||
        'Unknown error';
      const stack = (e.error && (e.error as any).stack) || undefined;
      setErrors((prev) => [
        ...prev,
        { type: 'error', message: String(message), stack, time: Date.now() },
      ].slice(-10));
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const reason: any = e.reason;
      const message = reason?.message ? String(reason.message) : String(reason);
      const stack = reason?.stack ? String(reason.stack) : undefined;
      setErrors((prev) => [
        ...prev,
        { type: 'unhandledrejection', message: `Unhandled promise: ${message}`, stack, time: Date.now() },
      ].slice(-10));
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  const latest = errors[errors.length - 1];

  const debugText = useMemo(() => {
    const ua = navigator.userAgent;
    const href = window.location.href;
    const lines = [
      `URL: ${href}`,
      `UA: ${ua}`,
      '',
      ...errors.flatMap((e) => {
        const header = `[${formatTime(e.time)}] ${e.type}: ${e.message}`;
        const stack = e.stack ? `\n${e.stack}` : '';
        return [header + stack, ''];
      }),
    ];
    return lines.join('\n');
  }, [errors]);

  if (errors.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.88)',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
        padding: 16,
        overflow: 'auto',
      }}
      role="alert"
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Runtime error (dev)</div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>
              This overlay appears when the app crashes after mounting. Screenshot or copy the text.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigator.clipboard?.writeText(debugText)}
              style={{
                background: '#8B5CF6',
                border: 0,
                color: 'white',
                borderRadius: 10,
                padding: '10px 12px',
                fontWeight: 700,
              }}
            >
              Copy
            </button>
            <button
              onClick={() => setErrors([])}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white',
                borderRadius: 10,
                padding: '10px 12px',
                fontWeight: 700,
              }}
            >
              Dismiss
            </button>
          </div>
        </div>

        {latest && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Latest</div>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, lineHeight: 1.35 }}>
              {latest.message}
              {latest.stack ? `\n\n${latest.stack}` : ''}
            </div>
          </div>
        )}

        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, opacity: 0.9 }}>All captured errors</summary>
          <pre
            style={{
              marginTop: 10,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: 'rgba(255,255,255,0.06)',
              padding: 12,
              borderRadius: 12,
              lineHeight: 1.35,
              fontSize: 12,
            }}
          >
            {debugText}
          </pre>
        </details>
      </div>
    </div>
  );
}

export default DevRuntimeErrorOverlay;

