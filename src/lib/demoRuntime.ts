import { isDemoMode } from '@/lib/appMode';
import { DEMO_CONTROLS_KEY } from '@/lib/demoState';

type StoredDemoControls = {
  simulateVisionInput?: boolean;
  simulateMapFallback?: boolean;
};

function looksLikePlaceholder(value: string | undefined | null): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.includes('your-project.supabase.co') ||
    normalized.includes('your-real-anon-key') ||
    normalized.includes('your-anon-key') ||
    normalized.includes('your-real-mapbox-public-token') ||
    normalized.includes('pk.your-')
  );
}

function readDemoControls(): StoredDemoControls {
  try {
    const raw = localStorage.getItem(DEMO_CONTROLS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredDemoControls;
  } catch {
    return {};
  }
}

export function isDemoVisionSimulationEnabled(): boolean {
  if (typeof window === 'undefined') return isDemoMode;
  const controls = readDemoControls();
  if (typeof controls.simulateVisionInput === 'boolean') return controls.simulateVisionInput;
  return isDemoMode;
}

export function isDemoMapFallbackEnabled(): boolean {
  if (typeof window === 'undefined') return isDemoMode;
  const controls = readDemoControls();
  if (typeof controls.simulateMapFallback === 'boolean') return controls.simulateMapFallback;
  return isDemoMode;
}

export function getCameraRuntimeIssue(): string | null {
  if (typeof window === 'undefined') return null;
  if (!window.isSecureContext) {
    return 'Camera requires HTTPS (or localhost).';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Camera API is not available in this browser.';
  }
  return null;
}

export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !key) return false;
  if (looksLikePlaceholder(url) || looksLikePlaceholder(key)) return false;
  return true;
}

export function getMapboxEnvToken(): string | null {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  if (looksLikePlaceholder(token)) return null;
  return token?.trim() || null;
}

export function hasMapboxEnvToken(): boolean {
  return !!getMapboxEnvToken();
}
