export type AppMode = 'demo' | 'production';

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function detectAppMode(): AppMode {
  const explicit = normalize(import.meta.env.VITE_APP_MODE as string | undefined);
  if (explicit === 'demo') return 'demo';
  if (normalize(import.meta.env.MODE) === 'demo') return 'demo';
  return 'production';
}

export const appMode: AppMode = detectAppMode();
export const isDemoMode = appMode === 'demo';

export function getAppMode(): AppMode {
  return appMode;
}
