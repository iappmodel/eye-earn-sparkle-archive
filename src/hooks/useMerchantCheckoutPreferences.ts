import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  LabelLanguagePreference,
  MerchantCategory,
  TipInteractionEventKind,
  TipPromptLayout,
} from '@/features/merchantCheckout/types';
import { merchantCheckoutService } from '@/services/merchantCheckout.service';

const PREFS_KEY = 'merchant_checkout_prefs_v1';
const TIP_INTERACTION_KEY = 'merchant_checkout_tip_interactions_v1';
const SHORTCUT_COOLDOWN_KEY = 'merchant_checkout_tip_layout_shortcut_cooldown_v1';

interface StoredCheckoutPrefs {
  hasChosenLabelLanguage: boolean;
  labelLanguage: LabelLanguagePreference;
  tipPromptLayoutGlobal: TipPromptLayout;
  tipPromptLayoutByCategory: Partial<Record<MerchantCategory, TipPromptLayout>>;
  autoConvertPreferenceEnabled: boolean;
  version: number;
}

interface StoredTipInteractionData {
  recentByCategory: Partial<Record<MerchantCategory, TipInteractionEventKind[]>>;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore localStorage failures
  }
}

const DEFAULT_PREFS: StoredCheckoutPrefs = {
  hasChosenLabelLanguage: false,
  labelLanguage: 'TRANSLATED_FALLBACK',
  tipPromptLayoutGlobal: 'AUTO',
  tipPromptLayoutByCategory: {},
  autoConvertPreferenceEnabled: false,
  version: 1,
};

const DEFAULT_INTERACTIONS: StoredTipInteractionData = {
  recentByCategory: {},
};

export function useMerchantCheckoutPreferences() {
  const [prefs, setPrefs] = useState<StoredCheckoutPrefs>(() => readJson(PREFS_KEY, DEFAULT_PREFS));
  const [interactionData, setInteractionData] = useState<StoredTipInteractionData>(() =>
    readJson(TIP_INTERACTION_KEY, DEFAULT_INTERACTIONS)
  );
  const [lastShortcutPromptAt, setLastShortcutPromptAt] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(SHORTCUT_COOLDOWN_KEY);
    const num = raw ? Number(raw) : NaN;
    return Number.isFinite(num) ? num : null;
  });
  const [remotePrefsReady, setRemotePrefsReady] = useState(false);
  const remoteSaveTimeoutRef = useRef<number | null>(null);
  const lastRemoteSyncedFingerprintRef = useRef<string | null>(null);

  useEffect(() => writeJson(PREFS_KEY, prefs), [prefs]);
  useEffect(() => writeJson(TIP_INTERACTION_KEY, interactionData), [interactionData]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (lastShortcutPromptAt == null) {
      window.localStorage.removeItem(SHORTCUT_COOLDOWN_KEY);
      return;
    }
    window.localStorage.setItem(SHORTCUT_COOLDOWN_KEY, String(lastShortcutPromptAt));
  }, [lastShortcutPromptAt]);

  const prefsFingerprint = useMemo(() => JSON.stringify(prefs), [prefs]);

  useEffect(() => {
    let isCancelled = false;

    void merchantCheckoutService
      .loadPreferences()
      .then((remotePrefs) => {
        if (isCancelled || !remotePrefs) return;
        setPrefs((prev) => {
          const remoteLooksDefault =
            remotePrefs.version === 1 &&
            !remotePrefs.hasChosenLabelLanguage &&
            remotePrefs.labelLanguage === DEFAULT_PREFS.labelLanguage &&
            remotePrefs.tipPromptLayoutGlobal === DEFAULT_PREFS.tipPromptLayoutGlobal &&
            Object.keys(remotePrefs.tipPromptLayoutByCategory ?? {}).length === 0 &&
            !remotePrefs.autoConvertPreferenceEnabled;

          const localIsCustomized =
            prev.hasChosenLabelLanguage !== DEFAULT_PREFS.hasChosenLabelLanguage ||
            prev.labelLanguage !== DEFAULT_PREFS.labelLanguage ||
            prev.tipPromptLayoutGlobal !== DEFAULT_PREFS.tipPromptLayoutGlobal ||
            Object.keys(prev.tipPromptLayoutByCategory ?? {}).length > 0 ||
            prev.autoConvertPreferenceEnabled !== DEFAULT_PREFS.autoConvertPreferenceEnabled;

          const next = remoteLooksDefault && localIsCustomized
            ? { ...prev, version: remotePrefs.version }
            : {
                ...prev,
                ...remotePrefs,
                tipPromptLayoutByCategory: remotePrefs.tipPromptLayoutByCategory ?? {},
                version: remotePrefs.version ?? prev.version,
              };

          lastRemoteSyncedFingerprintRef.current = JSON.stringify(next);
          return next;
        });
      })
      .catch(() => {
        // ignore and keep local-only behavior
      })
      .finally(() => {
        if (!isCancelled) setRemotePrefsReady(true);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!remotePrefsReady) return;
    if (lastRemoteSyncedFingerprintRef.current === prefsFingerprint) return;

    if (remoteSaveTimeoutRef.current != null && typeof window !== 'undefined') {
      window.clearTimeout(remoteSaveTimeoutRef.current);
    }

    if (typeof window === 'undefined') return;
    remoteSaveTimeoutRef.current = window.setTimeout(() => {
      const snapshot = { ...prefs };
      void merchantCheckoutService
        .savePreferences({
          preferences: snapshot,
          version: snapshot.version,
        })
        .then((result) => {
          if (result?.version && result.version !== snapshot.version) {
            setPrefs((prev) => ({ ...prev, version: result.version }));
            lastRemoteSyncedFingerprintRef.current = JSON.stringify({ ...snapshot, version: result.version });
            return;
          }
          lastRemoteSyncedFingerprintRef.current = JSON.stringify(snapshot);
        })
        .catch(() => {
          // ignore and keep local copy; next local change will retry
        });
    }, 350);

    return () => {
      if (remoteSaveTimeoutRef.current != null) {
        window.clearTimeout(remoteSaveTimeoutRef.current);
      }
    };
  }, [prefs, prefsFingerprint, remotePrefsReady]);

  const setLabelLanguage = useCallback((value: LabelLanguagePreference) => {
    setPrefs((prev) => ({ ...prev, labelLanguage: value, hasChosenLabelLanguage: true }));
  }, []);

  const completeLabelLanguageOnboarding = useCallback(() => {
    setPrefs((prev) => ({ ...prev, hasChosenLabelLanguage: true }));
  }, []);

  const setTipPromptLayoutGlobal = useCallback((value: TipPromptLayout) => {
    setPrefs((prev) => ({ ...prev, tipPromptLayoutGlobal: value }));
  }, []);

  const setTipPromptLayoutForCategory = useCallback((category: MerchantCategory, value: TipPromptLayout) => {
    setPrefs((prev) => ({
      ...prev,
      tipPromptLayoutByCategory: {
        ...prev.tipPromptLayoutByCategory,
        [category]: value,
      },
    }));
  }, []);

  const clearTipPromptLayoutForCategory = useCallback((category: MerchantCategory) => {
    setPrefs((prev) => {
      const next = { ...prev.tipPromptLayoutByCategory };
      delete next[category];
      return { ...prev, tipPromptLayoutByCategory: next };
    });
  }, []);

  const setAutoConvertPreferenceEnabled = useCallback((value: boolean) => {
    setPrefs((prev) => ({ ...prev, autoConvertPreferenceEnabled: value }));
  }, []);

  const recordTipInteraction = useCallback((category: MerchantCategory, event: TipInteractionEventKind) => {
    setInteractionData((prev) => {
      const current = prev.recentByCategory[category] ?? [];
      const next = [...current, event].slice(-20);
      return {
        recentByCategory: {
          ...prev.recentByCategory,
          [category]: next,
        },
      };
    });
  }, []);

  const shouldShowTipLayoutShortcut = useCallback(
    (category: MerchantCategory) => {
      const history = interactionData.recentByCategory[category] ?? [];
      const lastFive = history.slice(-5);
      const changesOrSkips = lastFive.filter((e) => e === 'CHANGED' || e === 'SKIPPED').length;
      if (changesOrSkips < 3) return false;
      if (!lastShortcutPromptAt) return true;
      const seventyTwoHours = 72 * 60 * 60 * 1000;
      return Date.now() - lastShortcutPromptAt >= seventyTwoHours;
    },
    [interactionData.recentByCategory, lastShortcutPromptAt]
  );

  const markTipLayoutShortcutShown = useCallback(() => {
    setLastShortcutPromptAt(Date.now());
  }, []);

  return {
    hasChosenLabelLanguage: prefs.hasChosenLabelLanguage,
    labelLanguage: prefs.labelLanguage,
    tipPromptLayoutGlobal: prefs.tipPromptLayoutGlobal,
    tipPromptLayoutByCategory: prefs.tipPromptLayoutByCategory,
    autoConvertPreferenceEnabled: prefs.autoConvertPreferenceEnabled,
    preferencesVersion: prefs.version,
    setLabelLanguage,
    completeLabelLanguageOnboarding,
    setTipPromptLayoutGlobal,
    setTipPromptLayoutForCategory,
    clearTipPromptLayoutForCategory,
    setAutoConvertPreferenceEnabled,
    recordTipInteraction,
    shouldShowTipLayoutShortcut,
    markTipLayoutShortcutShown,
  };
}
