export type ChunkErrorLike = unknown;

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|ChunkLoadError|Loading chunk\s+\d+\s+failed|Importing a module script failed|error loading dynamically imported module/i;

const RECOVERY_TS_KEY = '__lovable_chunk_recovery_ts__';
const MIN_RETRY_MS = 15_000;

function getMessage(err: ChunkErrorLike): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || String(err);
  // Vite/Browser sometimes provides ErrorEvent-like objects
  if (typeof err === 'object' && err && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return String(err);
}

export function isChunkLoadError(err: ChunkErrorLike): boolean {
  const msg = getMessage(err);
  return CHUNK_ERROR_RE.test(msg);
}

async function unregisterServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
}

async function clearCaches(): Promise<void> {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
}

export async function attemptChunkRecovery(options?: { force?: boolean }): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if (!options?.force) {
      const last = Number(sessionStorage.getItem(RECOVERY_TS_KEY) || '0');
      if (Date.now() - last < MIN_RETRY_MS) return;
      sessionStorage.setItem(RECOVERY_TS_KEY, String(Date.now()));
    }
  } catch {
    // ignore sessionStorage failures
  }

  try {
    await unregisterServiceWorkers();
  } catch {
    // ignore
  }

  try {
    await clearCaches();
  } catch {
    // ignore
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_r', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}
