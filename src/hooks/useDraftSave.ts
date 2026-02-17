import { useEffect, useRef, useCallback, useState } from 'react';

const DRAFT_KEY_PREFIX = 'content_draft_';
const VERSION_KEY_PREFIX = 'content_draft_versions_';
const DEFAULT_AUTO_SAVE_INTERVAL_MS = 30_000; // 30 seconds
const DEFAULT_DEBOUNCE_MS = 2_000; // 2 seconds after last change
const MAX_VERSIONS = 5;
const PREVIEW_MAX_LEN = 60;

/** Shape of a single draft (persisted). Schedule fields allow restoring scheduling state. */
export interface DraftData {
  title: string;
  caption: string;
  tags: string[];
  mediaUrl: string | null;
  mediaType: string;
  locationAddress: string;
  callToAction: string;
  externalLink: string;
  budget: string;
  targetAudience: string;
  endDate?: string;
  isPublic?: boolean;
  contentType: string;
  savedAt: string;
  // Schedule (optional; restored so user doesn't lose "schedule post" state)
  enableSchedule?: boolean;
  scheduleDate?: string;
  scheduleTime?: string;
}

/** Form payload (what the consumer passes in); excludes savedAt and contentType. */
export type DraftFormData = Omit<DraftData, 'savedAt' | 'contentType'>;

/** Metadata for "last saved" and preview in UI. */
export interface DraftMetadata {
  savedAt: Date;
  preview: string;
  contentType: string;
  hasMedia: boolean;
}

/** One version in history (for "restore previous version"). */
export interface DraftVersionInfo {
  savedAt: Date;
  preview: string;
  index: number;
}

export interface UseDraftSaveOptions {
  /** Auto-save interval in ms. Default 30_000. */
  autoSaveIntervalMs?: number;
  /** Debounce delay after form change before saving (ms). Default 2_000. */
  debounceMs?: number;
  /** Max number of previous versions to keep. Default 5. */
  maxVersions?: number;
  /** Custom localStorage key prefix. */
  storageKeyPrefix?: string;
  /** If true, log save/clear to console (dev). */
  debug?: boolean;
}

const defaultOptions: Required<UseDraftSaveOptions> = {
  autoSaveIntervalMs: DEFAULT_AUTO_SAVE_INTERVAL_MS,
  debounceMs: DEFAULT_DEBOUNCE_MS,
  maxVersions: MAX_VERSIONS,
  storageKeyPrefix: DRAFT_KEY_PREFIX,
  debug: false,
};

function getVersionsKey(userId: string, contentType: string, prefix: string): string {
  return `${prefix.replace('content_draft_', VERSION_KEY_PREFIX)}${userId}_${contentType}`;
}

function safeSetItem(key: string, value: string, onQuotaError?: () => void): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
      onQuotaError?.();
    }
    return false;
  }
}

export function useDraftSave(
  userId: string | undefined,
  contentType: string | null,
  formData: DraftFormData,
  setFormData: (data: Partial<DraftData>) => void,
  options: UseDraftSaveOptions = {}
) {
  const opts = { ...defaultOptions, ...options };
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');
  /** Snapshot of form (no savedAt) used for isDirty comparison. */
  const lastSavedFormSnapshotRef = useRef<string>('');
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const getDraftKey = useCallback(() => {
    if (!userId || !contentType) return null;
    return `${opts.storageKeyPrefix}${userId}_${contentType}`;
  }, [userId, contentType, opts.storageKeyPrefix]);

  const getVersionKey = useCallback(() => {
    if (!userId || !contentType) return null;
    return getVersionsKey(userId, contentType, opts.storageKeyPrefix);
  }, [userId, contentType, opts.storageKeyPrefix]);

  const pruneAndSave = useCallback(
    (key: string, data: DraftData, versionKey: string | null): boolean => {
    const dataString = JSON.stringify(data);
    const formSnapshot = JSON.stringify({ ...data, savedAt: undefined });
    if (safeSetItem(key, dataString)) {
      lastSavedRef.current = dataString;
      lastSavedFormSnapshotRef.current = formSnapshot;
      setLastSavedAt(new Date());
      return true;
    }
      if (versionKey) {
        try {
          const raw = localStorage.getItem(versionKey);
          if (raw) {
            const versions = JSON.parse(raw) as DraftData[];
            const fewer = versions.slice(0, Math.max(0, versions.length - 2));
            localStorage.setItem(versionKey, JSON.stringify(fewer));
            return pruneAndSave(key, data, versionKey);
          }
        } catch {
          // ignore
        }
      }
      return false;
    },
    []
  );

  const saveDraft = useCallback(() => {
    const key = getDraftKey();
    if (!key) return;

    const draftData: DraftData = {
      ...formDataRef.current,
      contentType: contentType || '',
      savedAt: new Date().toISOString(),
    };

    const dataString = JSON.stringify(draftData);
    if (dataString === lastSavedRef.current) return;

    setIsSaving(true);
    const versionKey = getVersionKey();

    // Push current stored draft into version history before overwriting
    if (versionKey) {
      try {
        const currentRaw = localStorage.getItem(key);
        if (currentRaw) {
          const current = JSON.parse(currentRaw) as DraftData;
          const versionsRaw = localStorage.getItem(versionKey);
          const versions: DraftData[] = versionsRaw ? JSON.parse(versionsRaw) : [];
          versions.unshift({
            ...current,
            savedAt: current.savedAt,
          });
          const trimmed = versions.slice(0, opts.maxVersions);
          localStorage.setItem(versionKey, JSON.stringify(trimmed));
        }
      } catch {
        // ignore
      }
    }

    const success = pruneAndSave(key, draftData, versionKey);
    if (opts.debug && success) {
      console.log('[DraftSave] Draft saved at', new Date().toLocaleTimeString());
    }
    setIsSaving(false);
  }, [getDraftKey, getVersionKey, contentType, opts.maxVersions, opts.debug, pruneAndSave]);

  const loadDraft = useCallback((): DraftData | null => {
    const key = getDraftKey();
    if (!key) return null;
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved) as DraftData;
    } catch (e) {
      if (opts.debug) console.error('[DraftSave] Error loading draft:', e);
    }
    return null;
  }, [getDraftKey, opts.debug]);

  const loadVersions = useCallback((): DraftData[] => {
    const key = getVersionKey();
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as DraftData[];
    } catch {
      // ignore
    }
    return [];
  }, [getVersionKey]);

  const clearDraft = useCallback(() => {
    const key = getDraftKey();
    const versionKey = getVersionKey();
    if (key) {
      localStorage.removeItem(key);
      lastSavedRef.current = '';
      lastSavedFormSnapshotRef.current = '';
      setLastSavedAt(null);
    }
    if (versionKey) localStorage.removeItem(versionKey);
    if (opts.debug) console.log('[DraftSave] Draft cleared');
  }, [getDraftKey, getVersionKey, opts.debug]);

  const hasDraft = useCallback((): boolean => {
    const key = getDraftKey();
    if (!key) return false;
    return localStorage.getItem(key) !== null;
  }, [getDraftKey]);

  const restoreDraft = useCallback(() => {
    const draft = loadDraft();
    if (!draft) return false;
    setFormData({
      title: draft.title,
      caption: draft.caption,
      tags: draft.tags ?? [],
      mediaUrl: draft.mediaUrl,
      mediaType: draft.mediaType,
      locationAddress: draft.locationAddress,
      callToAction: draft.callToAction,
      externalLink: draft.externalLink,
      budget: draft.budget,
      targetAudience: draft.targetAudience,
      ...(draft.endDate !== undefined && { endDate: draft.endDate }),
      ...(draft.isPublic !== undefined && { isPublic: draft.isPublic }),
      ...(draft.enableSchedule !== undefined && { enableSchedule: draft.enableSchedule }),
      ...(draft.scheduleDate !== undefined && { scheduleDate: draft.scheduleDate }),
      ...(draft.scheduleTime !== undefined && { scheduleTime: draft.scheduleTime }),
    });
    lastSavedRef.current = JSON.stringify(draft);
    lastSavedFormSnapshotRef.current = JSON.stringify({ ...draft, savedAt: undefined });
    setLastSavedAt(draft.savedAt ? new Date(draft.savedAt) : null);
    return true;
  }, [loadDraft, setFormData]);

  const getDraftTimestamp = useCallback((): Date | null => {
    const draft = loadDraft();
    if (draft?.savedAt) return new Date(draft.savedAt);
    return null;
  }, [loadDraft]);

  const getDraftMetadata = useCallback((): DraftMetadata | null => {
    const draft = loadDraft();
    if (!draft) return null;
    const preview =
      draft.caption?.trim().slice(0, PREVIEW_MAX_LEN) ||
      draft.title?.trim().slice(0, PREVIEW_MAX_LEN) ||
      'Untitled draft';
    return {
      savedAt: new Date(draft.savedAt),
      preview: preview + (preview.length >= PREVIEW_MAX_LEN ? '…' : ''),
      contentType: draft.contentType || '',
      hasMedia: !!(draft.mediaUrl && draft.mediaUrl.trim()),
    };
  }, [loadDraft]);

  const listVersions = useCallback((): DraftVersionInfo[] => {
    const versions = loadVersions();
    return versions.map((v, index) => ({
      savedAt: new Date(v.savedAt),
      preview: (v.caption || v.title || 'Untitled').slice(0, PREVIEW_MAX_LEN) + (v.caption?.length > PREVIEW_MAX_LEN ? '…' : ''),
      index,
    }));
  }, [loadVersions]);

  const restoreVersion = useCallback(
    (versionIndex: number): boolean => {
      const versions = loadVersions();
      const v = versions[versionIndex];
      if (!v) return false;
      setFormData({
        title: v.title,
        caption: v.caption,
        tags: v.tags ?? [],
        mediaUrl: v.mediaUrl,
        mediaType: v.mediaType,
        locationAddress: v.locationAddress,
        callToAction: v.callToAction,
        externalLink: v.externalLink,
        budget: v.budget,
        targetAudience: v.targetAudience,
        ...(v.endDate !== undefined && { endDate: v.endDate }),
        ...(v.isPublic !== undefined && { isPublic: v.isPublic }),
        ...(v.enableSchedule !== undefined && { enableSchedule: v.enableSchedule }),
        ...(v.scheduleDate !== undefined && { scheduleDate: v.scheduleDate }),
        ...(v.scheduleTime !== undefined && { scheduleTime: v.scheduleTime }),
      });
      return true;
    },
    [loadVersions, setFormData]
  );

  const exportDraft = useCallback((): string => {
    const draft = loadDraft();
    if (!draft) return '';
    return JSON.stringify(draft, null, 2);
  }, [loadDraft]);

  const importDraft = useCallback(
    (json: string): boolean => {
      try {
        const draft = JSON.parse(json) as DraftData;
        if (!draft || typeof draft.caption !== 'string') return false;
        setFormData({
          title: draft.title ?? '',
          caption: draft.caption ?? '',
          tags: Array.isArray(draft.tags) ? draft.tags : [],
          mediaUrl: draft.mediaUrl ?? null,
          mediaType: draft.mediaType ?? 'image',
          locationAddress: draft.locationAddress ?? '',
          callToAction: draft.callToAction ?? '',
          externalLink: draft.externalLink ?? '',
          budget: draft.budget ?? '',
          targetAudience: draft.targetAudience ?? '',
          ...(draft.endDate !== undefined && { endDate: draft.endDate }),
          ...(draft.isPublic !== undefined && { isPublic: draft.isPublic }),
          ...(draft.enableSchedule !== undefined && { enableSchedule: draft.enableSchedule }),
          ...(draft.scheduleDate !== undefined && { scheduleDate: draft.scheduleDate }),
          ...(draft.scheduleTime !== undefined && { scheduleTime: draft.scheduleTime }),
        });
        return true;
      } catch {
        return false;
      }
    },
    [setFormData]
  );

  const isDirty = useCallback((): boolean => {
    if (!userId || !contentType) return false;
    if (!lastSavedFormSnapshotRef.current) return false;
    const current = JSON.stringify({
      ...formDataRef.current,
      contentType: contentType || '',
      savedAt: undefined,
    });
    return current !== lastSavedFormSnapshotRef.current;
  }, [userId, contentType]);

  // Debounced save when form data changes
  useEffect(() => {
    if (!userId || !contentType || opts.debounceMs <= 0) return;
    const serialized = JSON.stringify(formDataRef.current);
    if (serialized === lastSavedRef.current) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      saveDraft();
    }, opts.debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [userId, contentType, formData, opts.debounceMs, saveDraft]);

  // Auto-save interval
  useEffect(() => {
    if (!userId || !contentType) return;
    autoSaveTimerRef.current = setInterval(saveDraft, opts.autoSaveIntervalMs);
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [userId, contentType, saveDraft, opts.autoSaveIntervalMs]);

  // Save on visibility change (tab switch)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) saveDraft();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [saveDraft]);

  // Save before unload
  useEffect(() => {
    const handleBeforeUnload = () => saveDraft();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveDraft]);

  // Sync lastSavedAt from storage when we have a draft (e.g. after mount)
  useEffect(() => {
    if (!userId || !contentType) return;
    const d = loadDraft();
    if (d?.savedAt) setLastSavedAt(new Date(d.savedAt));
  }, [userId, contentType, loadDraft]);

  return {
    saveDraft,
    loadDraft,
    clearDraft,
    hasDraft,
    restoreDraft,
    getDraftTimestamp,
    getDraftMetadata,
    listVersions,
    restoreVersion,
    exportDraft,
    importDraft,
    isDirty,
    lastSavedAt,
    isSaving,
  };
}
