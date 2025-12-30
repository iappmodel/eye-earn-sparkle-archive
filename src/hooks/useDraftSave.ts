import { useEffect, useRef, useCallback } from 'react';

const DRAFT_KEY_PREFIX = 'content_draft_';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

interface DraftData {
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
  contentType: string;
  savedAt: string;
}

export const useDraftSave = (
  userId: string | undefined,
  contentType: string | null,
  formData: Omit<DraftData, 'savedAt' | 'contentType'>,
  setFormData: (data: Partial<DraftData>) => void
) => {
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  const getDraftKey = useCallback(() => {
    if (!userId || !contentType) return null;
    return `${DRAFT_KEY_PREFIX}${userId}_${contentType}`;
  }, [userId, contentType]);

  // Save draft to localStorage
  const saveDraft = useCallback(() => {
    const key = getDraftKey();
    if (!key) return;

    const draftData: DraftData = {
      ...formData,
      contentType: contentType || '',
      savedAt: new Date().toISOString(),
    };

    const dataString = JSON.stringify(draftData);
    
    // Only save if data has changed
    if (dataString !== lastSavedRef.current) {
      localStorage.setItem(key, dataString);
      lastSavedRef.current = dataString;
      console.log('[DraftSave] Draft saved at', new Date().toLocaleTimeString());
    }
  }, [getDraftKey, formData, contentType]);

  // Load draft from localStorage
  const loadDraft = useCallback((): DraftData | null => {
    const key = getDraftKey();
    if (!key) return null;

    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const draft = JSON.parse(saved) as DraftData;
        return draft;
      }
    } catch (error) {
      console.error('[DraftSave] Error loading draft:', error);
    }
    return null;
  }, [getDraftKey]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    const key = getDraftKey();
    if (key) {
      localStorage.removeItem(key);
      lastSavedRef.current = '';
      console.log('[DraftSave] Draft cleared');
    }
  }, [getDraftKey]);

  // Check if draft exists
  const hasDraft = useCallback((): boolean => {
    const key = getDraftKey();
    if (!key) return false;
    return localStorage.getItem(key) !== null;
  }, [getDraftKey]);

  // Restore draft data to form
  const restoreDraft = useCallback(() => {
    const draft = loadDraft();
    if (draft) {
      setFormData({
        title: draft.title,
        caption: draft.caption,
        tags: draft.tags,
        mediaUrl: draft.mediaUrl,
        mediaType: draft.mediaType,
        locationAddress: draft.locationAddress,
        callToAction: draft.callToAction,
        externalLink: draft.externalLink,
        budget: draft.budget,
        targetAudience: draft.targetAudience,
      });
      return true;
    }
    return false;
  }, [loadDraft, setFormData]);

  // Get draft timestamp
  const getDraftTimestamp = useCallback((): Date | null => {
    const draft = loadDraft();
    if (draft?.savedAt) {
      return new Date(draft.savedAt);
    }
    return null;
  }, [loadDraft]);

  // Set up auto-save interval
  useEffect(() => {
    if (!userId || !contentType) return;

    autoSaveTimerRef.current = setInterval(saveDraft, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [userId, contentType, saveDraft]);

  // Save on visibility change (when user switches tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveDraft();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveDraft]);

  // Save before unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveDraft();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveDraft]);

  return {
    saveDraft,
    loadDraft,
    clearDraft,
    hasDraft,
    restoreDraft,
    getDraftTimestamp,
  };
};
