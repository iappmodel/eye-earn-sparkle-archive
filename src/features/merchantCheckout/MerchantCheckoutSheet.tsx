import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
} from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  buildScenarioFromParsedEntryInput,
  calculateQuote,
  formatCurrencyMinor,
  getMerchantCheckoutScenarios,
  resolveMerchantCheckoutPlan,
  resolveTipSelectionMinor,
} from './mockResolver';
import type {
  CheckoutScreenId,
  MerchantCategory,
  MerchantCheckoutAccessibility,
  MerchantCheckoutDraftState,
  MerchantCheckoutEntryType,
  MerchantCheckoutPlan,
  MerchantCheckoutScenario,
  TipPromptLayout,
  TipSelection,
} from './types';
import { useMerchantCheckoutPreferences } from '@/hooks/useMerchantCheckoutPreferences';
import { useUserRole } from '@/hooks/useUserRole';
import { merchantCheckoutService } from '@/services/merchantCheckout.service';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  CreditCard,
  ImageUp,
  Info,
  Loader2,
  Link2,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';

type LaunchMode = 'scan' | 'link' | null;
type SimAuthMethod = 'FACE_ID' | 'PIN';

interface MerchantCheckoutSheetProps {
  open: boolean;
  onClose: () => void;
  icoins: number;
  vicoins: number;
  launchMode?: LaunchMode;
}

interface ActiveFlowState {
  checkoutSessionId: string;
  scenario: MerchantCheckoutScenario;
  plan: MerchantCheckoutPlan;
  screenIndex: number;
  currentScreen: CheckoutScreenId;
  draft: MerchantCheckoutDraftState;
  postPayTipSelection: TipSelection;
  quote: ReturnType<typeof calculateQuote>['quote'] | null;
  autoConvertEligible: boolean;
  paymentConfirmed: boolean;
  paymentId: string | null;
  simulatedAuthMethod: SimAuthMethod | null;
  postPayTipStatus: 'idle' | 'sending' | 'sent' | 'failed';
  postPayTipMinor: number;
  showTipLayoutShortcut: boolean;
}

function toMinorFromIcoins(icoins: number) {
  return Math.max(0, Math.floor(icoins * 100));
}

function getAccessibilitySnapshot(): MerchantCheckoutAccessibility {
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    screenReader: false,
    largeText: false,
    reducedMotion,
  };
}

function getTipSelectionLabel(selection: TipSelection, flow: ActiveFlowState) {
  if (selection.kind === 'NONE') return 'No tip';
  if (selection.kind === 'CUSTOM') return formatCurrencyMinor(selection.amountMinor);
  return flow.plan.tipPlan.presets[selection.presetIndex]?.displayLabel ?? 'Tip';
}

function getTipLayoutDisplayLabel(layout: TipPromptLayout) {
  switch (layout) {
    case 'AUTO':
      return 'Auto';
    case 'BOTTOM_SHEET':
      return 'Bottom sheet';
    case 'FULL_SCREEN':
      return 'Full screen';
  }
}

function getEntryTypeLabel(entryType: MerchantCheckoutEntryType) {
  switch (entryType) {
    case 'QR_DYNAMIC':
      return 'In-store QR (Dynamic)';
    case 'QR_STATIC':
      return 'In-store QR (Static)';
    case 'ONLINE_CHECKOUT_LINK':
      return 'Online Checkout Link';
    case 'MERCHANT_REQUEST_LINK':
      return 'Merchant Request Link';
  }
}

function getCheckoutScreenLabel(screen: CheckoutScreenId) {
  switch (screen) {
    case 'ENTER_AMOUNT':
      return 'Amount';
    case 'PAYMENT_DETAILS':
      return 'Payment method';
    case 'REVIEW_PAYMENT':
      return 'Review';
    case 'AUTHENTICATE':
      return 'Confirm';
    case 'RECEIPT':
      return 'Receipt';
    case 'POST_PAY_TIP':
      return 'Tip (optional)';
  }
}

function getPaymentSourceLabel(flow: ActiveFlowState) {
  return flow.draft.paymentSourceSelection === 'AUTO_CONVERT' ? 'Vicoins + auto-convert' : 'Icoins';
}

type BarcodeDetectorResultLike = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<BarcodeDetectorResultLike[]>;
};
type BarcodeDetectorCtorLike = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

function getBarcodeDetectorCtor(): BarcodeDetectorCtorLike | null {
  if (typeof window === 'undefined') return null;
  return ((window as unknown as { BarcodeDetector?: BarcodeDetectorCtorLike }).BarcodeDetector ?? null);
}

async function decodeQrTextFromImageFile(file: File): Promise<string | null> {
  const BarcodeDetectorCtor = getBarcodeDetectorCtor();
  if (!BarcodeDetectorCtor) {
    throw new Error('QR scanning is not supported in this browser. Paste the checkout QR payload or link instead.');
  }

  const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
  const bitmap = await createImageBitmap(file);
  try {
    const matches = await detector.detect(bitmap);
    const first = matches.find((m) => typeof m.rawValue === 'string' && m.rawValue.trim().length > 0);
    return first?.rawValue?.trim() ?? null;
  } finally {
    bitmap.close();
  }
}

export function MerchantCheckoutSheet({
  open,
  onClose,
  icoins,
  vicoins,
  launchMode = null,
}: MerchantCheckoutSheetProps) {
  const prefs = useMerchantCheckoutPreferences();
  const { canAccessAdmin } = useUserRole();
  const [entryFilter, setEntryFilter] = useState<MerchantCheckoutEntryType | null>(null);
  const [manualEntryInput, setManualEntryInput] = useState('');
  const [manualEntryError, setManualEntryError] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [isServiceBusy, setIsServiceBusy] = useState(false);
  const [isQrDecodeBusy, setIsQrDecodeBusy] = useState(false);
  const [activeFlow, setActiveFlow] = useState<ActiveFlowState | null>(null);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [onboardingSelection, setOnboardingSelection] = useState(prefs.labelLanguage);
  const draftSyncSeqRef = useRef(0);
  const activeFlowRef = useRef<ActiveFlowState | null>(null);
  const qrFileInputRef = useRef<HTMLInputElement | null>(null);
  const qrCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrCameraStreamRef = useRef<MediaStream | null>(null);
  const qrScanRafRef = useRef<number | null>(null);
  const qrDetectBusyRef = useRef(false);
  const qrDetectorRef = useRef<BarcodeDetectorLike | null>(null);
  const qrScanningSupported = useMemo(() => getBarcodeDetectorCtor() !== null, []);
  const [qrCameraActive, setQrCameraActive] = useState(false);
  const [qrCameraStarting, setQrCameraStarting] = useState(false);
  const [qrCameraError, setQrCameraError] = useState<string | null>(null);
  const qrCameraSupported = useMemo(
    () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && qrScanningSupported,
    [qrScanningSupported]
  );

  useEffect(() => {
    activeFlowRef.current = activeFlow;
  }, [activeFlow]);

  const stopQrCamera = useCallback(() => {
    if (qrScanRafRef.current != null) {
      cancelAnimationFrame(qrScanRafRef.current);
      qrScanRafRef.current = null;
    }
    qrDetectBusyRef.current = false;
    if (qrCameraStreamRef.current) {
      qrCameraStreamRef.current.getTracks().forEach((track) => track.stop());
      qrCameraStreamRef.current = null;
    }
    if (qrCameraVideoRef.current) {
      qrCameraVideoRef.current.pause();
      qrCameraVideoRef.current.srcObject = null;
    }
    setQrCameraActive(false);
    setQrCameraStarting(false);
  }, []);

  useEffect(() => {
    if (open) return;
    stopQrCamera();
    setQrCameraError(null);
  }, [open, stopQrCamera]);

  useEffect(() => () => stopQrCamera(), [stopQrCamera]);

  const walletSnapshot = useMemo(
    () => ({
      icoinsAvailableMinor: toMinorFromIcoins(icoins),
      vicoinsAvailable: Math.max(0, Math.floor(vicoins)),
      exchangeRate: {
        vicoinsPerIcoinMinorUnit: 0.1,
        conversionFeeMinor: 25,
      },
    }),
    [icoins, vicoins]
  );

  useEffect(() => {
    if (!open) return;
    if (launchMode === 'scan') {
      setEntryFilter('QR_DYNAMIC');
    } else if (launchMode === 'link') {
      setEntryFilter('ONLINE_CHECKOUT_LINK');
    }
  }, [open, launchMode]);

  useEffect(() => {
    const currentFlow = activeFlowRef.current;
    if (!currentFlow) return;
    const nextPlan = resolveMerchantCheckoutPlan({
      scenario: currentFlow.scenario,
      userPreferences: {
        labelLanguage: prefs.labelLanguage,
        tipPromptLayoutGlobal: prefs.tipPromptLayoutGlobal,
        tipPromptLayoutByCategory: prefs.tipPromptLayoutByCategory,
        autoConvertPreferenceEnabled: prefs.autoConvertPreferenceEnabled,
      },
      wallet: walletSnapshot,
      accessibility: getAccessibilitySnapshot(),
    });

    setActiveFlow((prev) => {
      if (!prev) return prev;
      const screenStillExists = nextPlan.screens.includes(prev.currentScreen);
      const nextCurrentScreen = screenStillExists
        ? prev.currentScreen
        : nextPlan.screens[Math.min(prev.screenIndex, nextPlan.screens.length - 1)];
      const nextScreenIndex = Math.max(0, nextPlan.screens.indexOf(nextCurrentScreen));

      const recalculated = calculateQuote({
        scenario: prev.scenario,
        plan: nextPlan,
        draft: prev.draft,
        wallet: walletSnapshot,
      });

      return {
        ...prev,
        plan: nextPlan,
        currentScreen: nextCurrentScreen,
        screenIndex: nextScreenIndex,
        quote: recalculated.quote,
        autoConvertEligible: recalculated.autoConvertEligible,
      };
    });
  }, [
    prefs.labelLanguage,
    prefs.tipPromptLayoutGlobal,
    prefs.tipPromptLayoutByCategory,
    prefs.autoConvertPreferenceEnabled,
    walletSnapshot,
  ]);

  const scenarios = getMerchantCheckoutScenarios(entryFilter);
  const canSeeDemoScenarios = import.meta.env.DEV || canAccessAdmin;

  const startScenario = useCallback(async (scenario: MerchantCheckoutScenario) => {
    setIsServiceBusy(true);
    setServiceError(null);
    setManualEntryError(null);
    try {
      const resolved = await merchantCheckoutService.resolve({
        scenario,
        userPreferences: {
          labelLanguage: prefs.labelLanguage,
          tipPromptLayoutGlobal: prefs.tipPromptLayoutGlobal,
          tipPromptLayoutByCategory: prefs.tipPromptLayoutByCategory,
          autoConvertPreferenceEnabled: prefs.autoConvertPreferenceEnabled,
        },
        wallet: walletSnapshot,
        accessibility: getAccessibilitySnapshot(),
      });

      const autoConvertEligible =
        !resolved.plan.paymentSourcePlan.autoConvert.offered ||
        !!resolved.plan.paymentSourcePlan.autoConvert.eligible;

      setActiveFlow({
        checkoutSessionId: resolved.checkoutSessionId,
        scenario,
        plan: resolved.plan,
        screenIndex: 0,
        currentScreen: resolved.plan.screens[0],
        draft: resolved.draft,
        postPayTipSelection: { kind: 'NONE' },
        quote: resolved.quote,
        autoConvertEligible,
        paymentConfirmed: false,
        paymentId: null,
        simulatedAuthMethod: null,
        postPayTipStatus: 'idle',
        postPayTipMinor: 0,
        showTipLayoutShortcut: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open checkout';
      setServiceError(message);
    } finally {
      setIsServiceBusy(false);
    }
  }, [
    prefs.autoConvertPreferenceEnabled,
    prefs.labelLanguage,
    prefs.tipPromptLayoutByCategory,
    prefs.tipPromptLayoutGlobal,
    walletSnapshot,
  ]);

  const syncDraftToService = async (payload: {
    checkoutSessionId: string;
    draft: MerchantCheckoutDraftState;
  }) => {
    const seq = ++draftSyncSeqRef.current;
    try {
      const result = await merchantCheckoutService.patchDraft({
        checkoutSessionId: payload.checkoutSessionId,
        draft: payload.draft,
        userPreferences: {
          labelLanguage: prefs.labelLanguage,
          tipPromptLayoutGlobal: prefs.tipPromptLayoutGlobal,
          tipPromptLayoutByCategory: prefs.tipPromptLayoutByCategory,
          autoConvertPreferenceEnabled: prefs.autoConvertPreferenceEnabled,
        },
        accessibility: getAccessibilitySnapshot(),
      });
      if (seq !== draftSyncSeqRef.current) return;

      setActiveFlow((prev) => {
        if (!prev || prev.checkoutSessionId !== result.checkoutSessionId) return prev;
        const screenStillExists = result.plan.screens.includes(prev.currentScreen);
        const nextCurrentScreen = screenStillExists
          ? prev.currentScreen
          : result.plan.screens[Math.min(prev.screenIndex, result.plan.screens.length - 1)];
        const nextScreenIndex = Math.max(0, result.plan.screens.indexOf(nextCurrentScreen));
        return {
          ...prev,
          plan: result.plan,
          draft: result.draft,
          quote: result.quote,
          autoConvertEligible: result.autoConvertEligible,
          currentScreen: nextCurrentScreen,
          screenIndex: nextScreenIndex,
        };
      });
    } catch (err) {
      if (seq !== draftSyncSeqRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to refresh checkout quote';
      setServiceError(message);
    }
  };

  const updateDraft = (updater: (draft: MerchantCheckoutDraftState) => MerchantCheckoutDraftState) => {
    let syncPayload: { checkoutSessionId: string; draft: MerchantCheckoutDraftState } | null = null;
    setActiveFlow((prev) => {
      if (!prev) return prev;
      const nextDraft = updater(prev.draft);
      const quoteCalc = calculateQuote({
        scenario: prev.scenario,
        plan: prev.plan,
        draft: nextDraft,
        wallet: walletSnapshot,
      });
      syncPayload = {
        checkoutSessionId: prev.checkoutSessionId,
        draft: nextDraft,
      };
      return {
        ...prev,
        draft: nextDraft,
        quote: quoteCalc.quote,
        autoConvertEligible: quoteCalc.autoConvertEligible,
      };
    });
    if (syncPayload) void syncDraftToService(syncPayload);
  };

  const goToNextScreen = () => {
    setActiveFlow((prev) => {
      if (!prev) return prev;
      const nextIndex = Math.min(prev.plan.screens.length - 1, prev.screenIndex + 1);
      return { ...prev, screenIndex: nextIndex, currentScreen: prev.plan.screens[nextIndex] };
    });
  };

  const goToPreviousScreen = () => {
    setActiveFlow((prev) => {
      if (!prev) return prev;
      const nextIndex = Math.max(0, prev.screenIndex - 1);
      return { ...prev, screenIndex: nextIndex, currentScreen: prev.plan.screens[nextIndex] };
    });
  };

  const resetFlow = () => {
    setActiveFlow(null);
    setManualEntryError(null);
  };

  const handleClose = () => {
    stopQrCamera();
    resetFlow();
    setShowSettingsPanel(false);
    setServiceError(null);
    setIsServiceBusy(false);
    setIsQrDecodeBusy(false);
    setQrCameraError(null);
    onClose();
  };

  const launchFromParsedEntry = useCallback((rawInput: string) => {
    const scenario = buildScenarioFromParsedEntryInput(rawInput);
    if (!scenario) {
      setManualEntryError(
        'Could not parse this checkout payload. Try a checkout URL/QR payload with merchantId/scenarioId, or demo tokens like "cafe", "salon", "market", "request".'
      );
      return false;
    }
    void startScenario(scenario);
    setManualEntryError(null);
    return true;
  }, [startScenario]);

  const handleManualEntryLaunch = () => {
    const launched = launchFromParsedEntry(manualEntryInput);
    if (!launched) return;
  };

  const handlePickQrImage = () => {
    qrFileInputRef.current?.click();
  };

  const scanQrFromLiveVideo = useCallback(async () => {
    const video = qrCameraVideoRef.current;
    const detector = qrDetectorRef.current;
    if (!video || !detector || !qrCameraStreamRef.current) return;
    if (video.readyState < 2) {
      qrScanRafRef.current = requestAnimationFrame(() => void scanQrFromLiveVideo());
      return;
    }
    if (qrDetectBusyRef.current) {
      qrScanRafRef.current = requestAnimationFrame(() => void scanQrFromLiveVideo());
      return;
    }

    qrDetectBusyRef.current = true;
    try {
      const matches = await detector.detect(video);
      const first = matches.find((m) => typeof m.rawValue === 'string' && m.rawValue.trim().length > 0);
      const decoded = first?.rawValue?.trim();
      if (decoded) {
        setManualEntryInput(decoded);
        stopQrCamera();
        const launched = launchFromParsedEntry(decoded);
        if (!launched) {
          setManualEntryError(
            'QR code was detected, but it does not match a supported checkout payload yet. Paste it below to inspect or try another QR.'
          );
        }
        return;
      }
    } catch (err) {
      console.warn('[merchantCheckout] live QR detect failed', err);
    } finally {
      qrDetectBusyRef.current = false;
    }

    qrScanRafRef.current = requestAnimationFrame(() => void scanQrFromLiveVideo());
  }, [launchFromParsedEntry, stopQrCamera]);

  const handleStartQrCamera = useCallback(async () => {
    if (!qrCameraSupported) {
      setQrCameraError('Live camera scanning is not supported in this browser. Use a photo or paste the checkout payload.');
      return;
    }
    if (qrCameraActive || qrCameraStarting) return;

    setQrCameraError(null);
    setManualEntryError(null);
    setQrCameraStarting(true);

    try {
      const BarcodeDetectorCtor = getBarcodeDetectorCtor();
      if (!BarcodeDetectorCtor) {
        throw new Error('QR scanning is not supported in this browser.');
      }
      qrDetectorRef.current = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      qrCameraStreamRef.current = stream;

      const video = qrCameraVideoRef.current;
      if (!video) throw new Error('Camera preview failed to initialize.');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();

      setQrCameraActive(true);
      setQrCameraStarting(false);
      qrScanRafRef.current = requestAnimationFrame(() => void scanQrFromLiveVideo());
    } catch (err) {
      stopQrCamera();
      setQrCameraError(err instanceof Error ? err.message : 'Failed to start camera');
    } finally {
      setQrCameraStarting(false);
    }
  }, [qrCameraActive, qrCameraStarting, qrCameraSupported, scanQrFromLiveVideo, stopQrCamera]);

  const handleQrImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsQrDecodeBusy(true);
    setManualEntryError(null);
    try {
      const decoded = await decodeQrTextFromImageFile(file);
      if (!decoded) {
        setManualEntryError('No QR code was detected in this image. Try another photo or paste the checkout payload.');
        return;
      }
      setManualEntryInput(decoded);
      const launched = launchFromParsedEntry(decoded);
      if (!launched) {
        setManualEntryError(
          'QR code was read, but it does not match a supported checkout payload yet. Paste the payload to inspect it or try a different QR.'
        );
      }
    } catch (err) {
      setManualEntryError(err instanceof Error ? err.message : 'Failed to scan QR image');
    } finally {
      setIsQrDecodeBusy(false);
      event.currentTarget.value = '';
    }
  };

  const handlePrimaryAction = () => {
    if (!activeFlow) return;
    if (isServiceBusy) return;
    const { currentScreen, quote, plan, draft } = activeFlow;

    if (currentScreen === 'ENTER_AMOUNT') {
      const amount = draft.enteredAmountMinor ?? 0;
      if (!Number.isFinite(amount) || amount <= 0) {
        setManualEntryError('Enter a valid amount');
        return;
      }
      setManualEntryError(null);
      goToNextScreen();
      return;
    }

    if (currentScreen === 'PAYMENT_DETAILS') {
      if (!quote || quote.amountMinor <= 0) {
        setManualEntryError('Enter a valid amount');
        return;
      }
      if (
        plan.tipPlan.enabled &&
        plan.tipPlan.timing === 'PRE_PAY' &&
        plan.tipPlan.mode === 'CHOICE_REQUIRED' &&
        !draft.prePayTipSelection
      ) {
        setManualEntryError('Choose a tip option');
        return;
      }
      if (plan.resolvedCheckoutMode === 'REVIEW_REQUIRED') {
        goToNextScreen();
      } else {
        goToNextScreen();
      }
      return;
    }

    if (currentScreen === 'REVIEW_PAYMENT') {
      goToNextScreen();
      return;
    }

    if (currentScreen === 'AUTHENTICATE') {
      const authMethod = activeFlow.simulatedAuthMethod ?? 'FACE_ID';
      setIsServiceBusy(true);
      setServiceError(null);
      setActiveFlow((prev) =>
        prev
          ? {
              ...prev,
              paymentConfirmed: true,
              simulatedAuthMethod: authMethod,
            }
          : prev
      );
      void merchantCheckoutService
        .confirm({
          checkoutSessionId: activeFlow.checkoutSessionId,
          authMethod,
          idempotencyKey: crypto.randomUUID(),
        })
        .then((result) => {
          setActiveFlow((prev) =>
            prev && prev.checkoutSessionId === result.checkoutSessionId
              ? {
                  ...prev,
                  paymentConfirmed: true,
                  paymentId: result.paymentId,
                  simulatedAuthMethod: result.receipt.authMethod,
                }
              : prev
          );
          goToNextScreen();
        })
        .catch((err) => {
          setServiceError(err instanceof Error ? err.message : 'Failed to confirm payment');
        })
        .finally(() => setIsServiceBusy(false));
      return;
    }

    if (currentScreen === 'RECEIPT') {
      if (plan.tipPlan.enabled && plan.tipPlan.timing === 'POST_PAY') {
        goToNextScreen();
        return;
      }
      handleClose();
      return;
    }

    if (currentScreen === 'POST_PAY_TIP') {
      if (activeFlow.postPayTipStatus === 'sent') {
        handlePostPayDone();
        return;
      }
      handleSubmitPostPayTip();
    }
  };

  const handleSubmitPostPayTip = (selectionOverride?: TipSelection) => {
    let submitPayload:
      | {
          checkoutSessionId: string;
          selection: TipSelection;
          category: MerchantCategory;
          localTipMinor: number;
        }
      | null = null;

    setActiveFlow((prev) => {
      if (!prev) return prev;
      const tipPlan = prev.plan.tipPlan;
      const selection = selectionOverride ?? prev.postPayTipSelection;
      const amountMinor = prev.quote?.amountMinor ?? 0;
      const tipMinor = resolveTipSelectionMinor(selection, tipPlan.presets, amountMinor);

      if (tipPlan.mode === 'CHOICE_REQUIRED' && !selection) {
        return prev;
      }

      submitPayload = {
        checkoutSessionId: prev.checkoutSessionId,
        selection,
        category: prev.scenario.merchant.category,
        localTipMinor: tipMinor,
      };

      return {
        ...prev,
        postPayTipSelection: selection,
        postPayTipStatus: 'sending',
      };
    });

    if (!submitPayload) return;

    setIsServiceBusy(true);
    setServiceError(null);
    void merchantCheckoutService
      .submitPostPayTip({
        checkoutSessionId: submitPayload.checkoutSessionId,
        selection: submitPayload.selection,
        idempotencyKey: crypto.randomUUID(),
      })
      .then((result) => {
        const isNoTip = result.tipAmountMinor <= 0;
        prefs.recordTipInteraction(submitPayload.category, isNoTip ? 'SKIPPED' : 'CHANGED');
        const shouldPrompt = prefs.shouldShowTipLayoutShortcut(submitPayload.category);
        if (shouldPrompt) prefs.markTipLayoutShortcutShown();

        setActiveFlow((prev) =>
          prev && prev.checkoutSessionId === result.checkoutSessionId
            ? {
                ...prev,
                postPayTipStatus: 'sent',
                postPayTipMinor: result.tipAmountMinor,
                showTipLayoutShortcut: shouldPrompt,
              }
            : prev
        );
      })
      .catch((err) => {
        setActiveFlow((prev) => (prev ? { ...prev, postPayTipStatus: 'failed' } : prev));
        setServiceError(err instanceof Error ? err.message : 'Failed to send tip');
      })
      .finally(() => setIsServiceBusy(false));
  };

  const handlePostPayDone = () => {
    handleClose();
  };

  const currentTipPromptLayout = activeFlow
    ? resolveCurrentTipPromptLayout(activeFlow.scenario.merchant.category, prefs.tipPromptLayoutByCategory, prefs.tipPromptLayoutGlobal, getAccessibilitySnapshot())
    : prefs.tipPromptLayoutGlobal;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && handleClose()}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-3xl px-4 sm:px-6 overflow-y-auto">
        <SheetHeader className="pr-10 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Merchant Checkout
          </SheetTitle>
          <SheetDescription>
            V1 frontend implementation: unified merchant checkout shell with local resolver, tips, and preference controls.
          </SheetDescription>
        </SheetHeader>

        {!prefs.hasChosenLabelLanguage && !activeFlow ? (
          <OnboardingLabelLanguagePanel
            value={onboardingSelection}
            onChange={setOnboardingSelection}
            onContinue={() => {
              prefs.setLabelLanguage(onboardingSelection);
              prefs.completeLabelLanguageOnboarding();
            }}
          />
        ) : activeFlow ? (
          <div className="space-y-4 pb-8">
            <CheckoutFlowHeader
              flow={activeFlow}
              currentTipPromptLayout={currentTipPromptLayout}
              canSeeDemoScenarios={canSeeDemoScenarios}
              onBack={activeFlow.screenIndex > 0 ? goToPreviousScreen : resetFlow}
              onOpenSettings={() => setShowSettingsPanel((v) => !v)}
              showSettings={showSettingsPanel}
            />

            {showSettingsPanel && (
              <CheckoutPreferencesPanel
                category={activeFlow.scenario.merchant.category}
                labelLanguage={prefs.labelLanguage}
                tipPromptLayoutGlobal={prefs.tipPromptLayoutGlobal}
                tipPromptLayoutByCategory={prefs.tipPromptLayoutByCategory}
                autoConvertPreferenceEnabled={prefs.autoConvertPreferenceEnabled}
                onLabelLanguageChange={prefs.setLabelLanguage}
                onTipPromptLayoutGlobalChange={prefs.setTipPromptLayoutGlobal}
                onTipPromptLayoutCategoryChange={prefs.setTipPromptLayoutForCategory}
                onTipPromptLayoutCategoryClear={prefs.clearTipPromptLayoutForCategory}
                onAutoConvertPreferenceChange={prefs.setAutoConvertPreferenceEnabled}
              />
            )}

            {manualEntryError && (
              <div role="alert" aria-live="assertive" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {manualEntryError}
              </div>
            )}
            {serviceError && (
              <div role="alert" aria-live="assertive" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {serviceError}
              </div>
            )}

            <div className="rounded-2xl border border-border/60 p-4 space-y-4">
              {activeFlow.currentScreen === 'ENTER_AMOUNT' && (
                <EnterAmountScreen
                  flow={activeFlow}
                  onAmountChange={(nextMinor) =>
                    updateDraft((draft) => ({
                      ...draft,
                      enteredAmountMinor: nextMinor,
                    }))
                  }
                />
              )}

              {activeFlow.currentScreen === 'PAYMENT_DETAILS' && (
                <PaymentDetailsScreen
                  flow={activeFlow}
                  onSelectPaymentSource={(source) =>
                    updateDraft((draft) => ({ ...draft, paymentSourceSelection: source }))
                  }
                  onSelectPrePayTip={(selection) =>
                    updateDraft((draft) => ({ ...draft, prePayTipSelection: selection }))
                  }
                  onAutoConvertAndPay={() => {
                    updateDraft((draft) => ({ ...draft, paymentSourceSelection: 'AUTO_CONVERT' }));
                  }}
                />
              )}

              {activeFlow.currentScreen === 'REVIEW_PAYMENT' && (
                <ReviewPaymentScreen flow={activeFlow} />
              )}

              {activeFlow.currentScreen === 'AUTHENTICATE' && (
                <AuthenticateScreen
                  flow={activeFlow}
                  onChooseFaceId={() =>
                    setActiveFlow((prev) => (prev ? { ...prev, simulatedAuthMethod: 'FACE_ID' } : prev))
                  }
                  onChoosePin={() =>
                    setActiveFlow((prev) => (prev ? { ...prev, simulatedAuthMethod: 'PIN' } : prev))
                  }
                />
              )}

              {activeFlow.currentScreen === 'RECEIPT' && (
                <ReceiptScreen flow={activeFlow} />
              )}

              {activeFlow.currentScreen === 'POST_PAY_TIP' && (
                <PostPayTipScreen
                  flow={activeFlow}
                  currentTipPromptLayout={currentTipPromptLayout}
                  onSelectTip={(selection) =>
                    setActiveFlow((prev) => (prev ? { ...prev, postPayTipSelection: selection } : prev))
                  }
                  onDone={handlePostPayDone}
                  onSetTipLayoutPreference={(scope, layout) => {
                    if (scope === 'GLOBAL') prefs.setTipPromptLayoutGlobal(layout);
                    else prefs.setTipPromptLayoutForCategory(activeFlow.scenario.merchant.category, layout);
                    setActiveFlow((prev) => (prev ? { ...prev, showTipLayoutShortcut: false } : prev));
                  }}
                  onDismissTipLayoutShortcut={() =>
                    setActiveFlow((prev) => (prev ? { ...prev, showTipLayoutShortcut: false } : prev))
                  }
                />
              )}
            </div>

            <CheckoutBottomBar
              flow={activeFlow}
              isBusy={isServiceBusy}
              onPrimaryAction={handlePrimaryAction}
              onClose={handleClose}
            />
          </div>
        ) : (
          <div className="space-y-5 pb-8">
            <div className="flex items-center justify-between rounded-2xl border border-border/60 p-3">
              <div className="text-sm">
                <p className="font-medium">{canSeeDemoScenarios ? 'Entry Source Filter' : 'Checkout Settings'}</p>
                <p className="text-muted-foreground text-xs">
                  {canSeeDemoScenarios
                    ? 'Switch between QR, online links, and merchant requests.'
                    : 'Production mode hides demo scenarios. Use QR scan or paste a real merchant request.'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowSettingsPanel((v) => !v)}>
                {showSettingsPanel ? 'Hide Settings' : 'Checkout Settings'}
              </Button>
            </div>

            {canSeeDemoScenarios && (
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['QR_DYNAMIC', 'Dynamic QR'],
                  ['QR_STATIC', 'Static QR'],
                  ['ONLINE_CHECKOUT_LINK', 'Online Link'],
                  ['MERCHANT_REQUEST_LINK', 'Request Link'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setEntryFilter((curr) => (curr === value ? null : value))}
                  aria-pressed={entryFilter === value}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm text-left transition-colors min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    entryFilter === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/70 hover:bg-muted/40'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {showSettingsPanel && (
              <CheckoutPreferencesPanel
                category={undefined}
                labelLanguage={prefs.labelLanguage}
                tipPromptLayoutGlobal={prefs.tipPromptLayoutGlobal}
                tipPromptLayoutByCategory={prefs.tipPromptLayoutByCategory}
                autoConvertPreferenceEnabled={prefs.autoConvertPreferenceEnabled}
                onLabelLanguageChange={prefs.setLabelLanguage}
                onTipPromptLayoutGlobalChange={prefs.setTipPromptLayoutGlobal}
                onTipPromptLayoutCategoryChange={prefs.setTipPromptLayoutForCategory}
                onTipPromptLayoutCategoryClear={prefs.clearTipPromptLayoutForCategory}
                onAutoConvertPreferenceChange={prefs.setAutoConvertPreferenceEnabled}
              />
            )}

            {canSeeDemoScenarios && (
              <>
                <div className="space-y-3">
                  {scenarios.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => void startScenario(scenario)}
                      className="w-full rounded-2xl border border-border/70 p-4 text-left hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{scenario.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{scenario.description}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline">{scenario.merchant.name}</Badge>
                            <Badge variant="secondary">{scenario.merchant.settings.mode === 'EXPRESS' ? 'Express' : 'Review Required'}</Badge>
                            <Badge variant="outline">{getEntryTypeLabel(scenario.entry.entryType)}</Badge>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 shrink-0 mt-1 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>

                <Separator />
              </>
            )}

            <div className="rounded-2xl border border-border/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-primary" />
                <p className="font-medium">Scan checkout QR (camera/photo)</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Uses your browser&apos;s QR detector to read a checkout payload from a live camera preview or photo.
              </p>
              <input
                ref={qrFileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => void handleQrImageSelected(e)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void handleStartQrCamera()}
                  disabled={isServiceBusy || isQrDecodeBusy || qrCameraStarting || !qrCameraSupported}
                  className="gap-2"
                >
                  {qrCameraStarting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  {qrCameraActive ? 'Camera Active' : qrCameraStarting ? 'Starting…' : 'Open Camera'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePickQrImage}
                  disabled={isServiceBusy || isQrDecodeBusy}
                  className="gap-2"
                >
                  <ImageUp className="w-4 h-4" />
                  Choose photo
                </Button>
                {qrCameraActive && (
                  <Button type="button" variant="ghost" onClick={stopQrCamera}>
                    Stop Camera
                  </Button>
                )}
              </div>
              {qrCameraActive && (
                <div className="rounded-xl border border-border/60 overflow-hidden bg-black/90">
                  <video
                    ref={qrCameraVideoRef}
                    className="w-full aspect-video object-cover"
                    muted
                    autoPlay
                    playsInline
                  />
                  <div className="px-3 py-2 text-xs text-muted-foreground bg-background/95">
                    Point the camera at a merchant checkout QR code.
                  </div>
                </div>
              )}
              {qrCameraError && <p className="text-xs text-destructive">{qrCameraError}</p>}
              {!qrScanningSupported && (
                <p className="text-xs text-muted-foreground">
                  QR scanning is not available in this browser. Paste the checkout link or raw QR payload below.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                <p className="font-medium">Paste checkout link / QR payload / request</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Supports URLs, custom schemes, JSON/KV payloads, and demo tokens: <code>cafe</code>, <code>salon</code>, <code>market</code>, <code>request</code>.
              </p>
              <div className="flex gap-2">
                <Input
                  value={manualEntryInput}
                  onChange={(e) => setManualEntryInput(e.target.value)}
                  placeholder="Paste checkout URL, QR payload, or request link"
                  aria-label="Paste checkout link, QR payload, or request"
                />
                <Button onClick={handleManualEntryLaunch} disabled={isServiceBusy}>
                  {isServiceBusy ? 'Opening…' : 'Open'}
                </Button>
              </div>
            {manualEntryError && <p role="alert" aria-live="assertive" className="text-xs text-destructive">{manualEntryError}</p>}
            {serviceError && <p role="alert" aria-live="assertive" className="text-xs text-destructive">{serviceError}</p>}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function OnboardingLabelLanguagePanel(props: {
  value: 'MERCHANT_ORIGINAL' | 'TRANSLATED_FALLBACK';
  onChange: (value: 'MERCHANT_ORIGINAL' | 'TRANSLATED_FALLBACK') => void;
  onContinue: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/70 p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-base">Payment label language</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose how merchant checkout mode labels appear during payment.
        </p>
      </div>
      <RadioGroup value={props.value} onValueChange={(value) => props.onChange(value as typeof props.value)}>
        <label className="flex items-start gap-3 rounded-xl border border-border/60 p-3 cursor-pointer">
          <RadioGroupItem value="MERCHANT_ORIGINAL" className="mt-0.5" />
          <div>
            <p className="font-medium text-sm">Merchant original</p>
            <p className="text-xs text-muted-foreground">Show the merchant label exactly as provided.</p>
          </div>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-border/60 p-3 cursor-pointer">
          <RadioGroupItem value="TRANSLATED_FALLBACK" className="mt-0.5" />
          <div>
            <p className="font-medium text-sm">Translated fallback</p>
            <p className="text-xs text-muted-foreground">Show a platform label in your app language.</p>
          </div>
        </label>
      </RadioGroup>
      <Button onClick={props.onContinue} className="w-full">
        Continue
      </Button>
    </div>
  );
}

function CheckoutFlowHeader(props: {
  flow: ActiveFlowState;
  currentTipPromptLayout: TipPromptLayout;
  canSeeDemoScenarios: boolean;
  onBack: () => void;
  onOpenSettings: () => void;
  showSettings: boolean;
}) {
  const { flow } = props;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={props.onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          {flow.screenIndex === 0 ? (props.canSeeDemoScenarios ? 'All scenarios' : 'Checkout Home') : 'Back'}
        </Button>
        <Button variant="outline" size="sm" onClick={props.onOpenSettings}>
          {props.showSettings ? 'Hide Settings' : 'Checkout Settings'}
        </Button>
      </div>
      <div className="rounded-2xl border border-border/70 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{flow.scenario.merchant.name}</p>
            <p className="text-xs text-muted-foreground mt-1">{flow.scenario.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Step {flow.screenIndex + 1} of {flow.plan.screens.length}: {getCheckoutScreenLabel(flow.currentScreen)}
              </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline">{flow.plan.policyProfile.profileType}</Badge>
            <span className="text-[11px] text-muted-foreground">
              Tip prompt: {getTipLayoutDisplayLabel(props.currentTipPromptLayout)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckoutPreferencesPanel(props: {
  category?: MerchantCategory;
  labelLanguage: 'MERCHANT_ORIGINAL' | 'TRANSLATED_FALLBACK';
  tipPromptLayoutGlobal: TipPromptLayout;
  tipPromptLayoutByCategory: Partial<Record<MerchantCategory, TipPromptLayout>>;
  autoConvertPreferenceEnabled: boolean;
  onLabelLanguageChange: (value: 'MERCHANT_ORIGINAL' | 'TRANSLATED_FALLBACK') => void;
  onTipPromptLayoutGlobalChange: (value: TipPromptLayout) => void;
  onTipPromptLayoutCategoryChange: (category: MerchantCategory, value: TipPromptLayout) => void;
  onTipPromptLayoutCategoryClear: (category: MerchantCategory) => void;
  onAutoConvertPreferenceChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/60 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-medium">Checkout Preferences</h3>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Label language</Label>
        <RadioGroup
          value={props.labelLanguage}
          onValueChange={(v) => props.onLabelLanguageChange(v as typeof props.labelLanguage)}
          className="grid grid-cols-1 gap-2"
        >
          <label className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer">
            <RadioGroupItem value="MERCHANT_ORIGINAL" />
            <div className="text-sm">
              <p className="font-medium">Merchant original</p>
              <p className="text-xs text-muted-foreground">Show merchant custom labels when available.</p>
            </div>
          </label>
          <label className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer">
            <RadioGroupItem value="TRANSLATED_FALLBACK" />
            <div className="text-sm">
              <p className="font-medium">Translated fallback</p>
              <p className="text-xs text-muted-foreground">Use platform label wording.</p>
            </div>
          </label>
        </RadioGroup>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tip prompt layout (global)</Label>
        <div className="grid grid-cols-3 gap-2">
          {(['AUTO', 'BOTTOM_SHEET', 'FULL_SCREEN'] as const).map((layout) => (
            <button
              key={layout}
              type="button"
              onClick={() => props.onTipPromptLayoutGlobalChange(layout)}
              className={cn(
                'rounded-xl border px-3 py-2 text-xs font-medium',
                props.tipPromptLayoutGlobal === layout
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/60'
              )}
            >
              {getTipLayoutDisplayLabel(layout)}
            </button>
          ))}
        </div>
      </div>

      {props.category && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {props.category.replace(/_/g, ' ')} override
            </Label>
            {props.tipPromptLayoutByCategory[props.category] && (
              <Button variant="ghost" size="sm" onClick={() => props.onTipPromptLayoutCategoryClear(props.category)}>
                Clear override
              </Button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['AUTO', 'BOTTOM_SHEET', 'FULL_SCREEN'] as const).map((layout) => (
              <button
                key={layout}
                type="button"
                onClick={() => props.onTipPromptLayoutCategoryChange(props.category!, layout)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-xs font-medium',
                  props.tipPromptLayoutByCategory[props.category!] === layout
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60'
                )}
              >
                {getTipLayoutDisplayLabel(layout)}
              </button>
            ))}
          </div>
        </div>
      )}

      <Separator />

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
        <div>
          <p className="text-sm font-medium">Prefer one-tap auto-convert</p>
          <p className="text-xs text-muted-foreground">
            Preselect auto-convert when Icoins are insufficient (conversion math stays visible).
          </p>
        </div>
        <Switch
          checked={props.autoConvertPreferenceEnabled}
          onCheckedChange={props.onAutoConvertPreferenceChange}
          aria-label="Prefer one-tap auto-convert"
        />
      </div>
    </div>
  );
}

function CheckoutModeBadge({ flow }: { flow: ActiveFlowState }) {
  if (!flow.plan.modeBadge.visible || !flow.plan.modeBadge.labelText) return null;
  return (
    <Badge variant="secondary" className="rounded-full">
      {flow.plan.modeBadge.labelText}
    </Badge>
  );
}

function PaymentDetailsScreen(props: {
  flow: ActiveFlowState;
  onSelectPaymentSource: (value: 'ICOINS' | 'AUTO_CONVERT') => void;
  onSelectPrePayTip: (selection: TipSelection) => void;
  onAutoConvertAndPay: () => void;
}) {
  const { flow } = props;
  const quote = flow.quote;
  const amountLabel = quote ? formatCurrencyMinor(quote.amountMinor, flow.scenario.entry.currencyCode) : 'Enter amount';
  const totalLabel = quote ? formatCurrencyMinor(quote.totalMinor, flow.scenario.entry.currencyCode) : '—';
  const needsAmount = (flow.draft.enteredAmountMinor ?? 0) <= 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Pay {flow.scenario.merchant.name}</p>
          <h3 className="text-xl font-semibold mt-1">{amountLabel}</h3>
          <p className="text-xs text-muted-foreground mt-1">{getEntryTypeLabel(flow.scenario.entry.entryType)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {flow.scenario.merchant.verified && (
            <Badge variant="outline" className="rounded-full">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Verified
            </Badge>
          )}
          <CheckoutModeBadge flow={flow} />
        </div>
      </div>

      {needsAmount && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          This is a static QR payment. Enter the amount first.
        </div>
      )}

      {flow.plan.tipPlan.enabled && flow.plan.tipPlan.timing === 'PRE_PAY' && (
        <TipSelectorCard
          title={flow.plan.tipPlan.mode === 'CHOICE_REQUIRED' ? 'Choose a tip option' : 'Add a tip'}
          helper={
            flow.plan.tipPlan.mode === 'CHOICE_REQUIRED'
              ? 'You must choose one option to continue'
              : 'Optional'
          }
          currencyCode={flow.scenario.entry.currencyCode}
          amountMinor={quote?.amountMinor ?? 0}
          presets={flow.plan.tipPlan.presets}
          customTipEnabled={flow.plan.tipPlan.customTipEnabled}
          selection={flow.draft.prePayTipSelection}
          onChange={props.onSelectPrePayTip}
        />
      )}

      <div className="rounded-xl border border-border/60 p-3 space-y-3">
        <p className="text-sm font-medium">Pay with</p>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => props.onSelectPaymentSource('ICOINS')}
            aria-pressed={flow.draft.paymentSourceSelection === 'ICOINS'}
            className={cn(
              'rounded-xl border p-3 text-left min-h-11 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              flow.draft.paymentSourceSelection === 'ICOINS' ? 'border-primary bg-primary/5' : 'border-border/60'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">Icoins (spendable money)</p>
                <p className="text-xs text-muted-foreground">Uses your available Icoin balance first.</p>
              </div>
              <CreditCard className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>

          {flow.plan.paymentSourcePlan.autoConvert.offered && (
            <button
              type="button"
              onClick={() => props.onSelectPaymentSource('AUTO_CONVERT')}
              aria-pressed={flow.draft.paymentSourceSelection === 'AUTO_CONVERT'}
              className={cn(
                'rounded-xl border p-3 text-left min-h-11 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                flow.draft.paymentSourceSelection === 'AUTO_CONVERT'
                  ? 'border-primary bg-primary/5'
                  : 'border-border/60'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">Vicoins (platform credits) + auto-convert</p>
                  <p className="text-xs text-muted-foreground">One tap confirms conversion math before auth.</p>
                </div>
                <Wallet className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          )}
        </div>
      </div>

      {flow.plan.paymentSourcePlan.autoConvert.offered && quote && quote.autoConvertShortfallMinor > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium">Not enough Icoins</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Convert {quote.autoConvertVicoinsNeeded.toLocaleString()} Vicoins to cover{' '}
            {formatCurrencyMinor(quote.autoConvertShortfallMinor, flow.scenario.entry.currencyCode)}.
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-background/80 p-2 border border-border/40">
              <p className="text-muted-foreground">Fee</p>
              <p className="font-medium">
                {formatCurrencyMinor(flow.plan.paymentSourcePlan.autoConvert.conversionFeeMinor ?? 0, flow.scenario.entry.currencyCode)}
              </p>
            </div>
            <div className="rounded-lg bg-background/80 p-2 border border-border/40">
              <p className="text-muted-foreground">Eligible</p>
              <p className={cn('font-medium', flow.autoConvertEligible ? 'text-primary' : 'text-destructive')}>
                {flow.autoConvertEligible ? 'Yes' : 'No'}
              </p>
            </div>
          </div>
          {flow.autoConvertEligible && (
            <Button variant="outline" size="sm" className="w-full" onClick={props.onAutoConvertAndPay}>
              {flow.plan.paymentSourcePlan.autoConvert.ctaLabel ?? 'Auto-convert and pay'}
            </Button>
          )}
        </div>
      )}

      <SummaryRows
        rows={[
          ['Amount', quote ? formatCurrencyMinor(quote.amountMinor, flow.scenario.entry.currencyCode) : '—'],
          ...(quote && quote.tipMinor > 0 ? [['Tip', formatCurrencyMinor(quote.tipMinor, flow.scenario.entry.currencyCode)] as [string, string]] : []),
          ...(quote && quote.conversionFeeMinor > 0
            ? [['Conversion fee', formatCurrencyMinor(quote.conversionFeeMinor, flow.scenario.entry.currencyCode)] as [string, string]]
            : []),
          ['Total', totalLabel],
        ]}
      />
    </div>
  );
}

function EnterAmountScreen(props: {
  flow: ActiveFlowState;
  onAmountChange: (minor: number) => void;
}) {
  const displayAmount =
    props.flow.draft.enteredAmountMinor != null
      ? (props.flow.draft.enteredAmountMinor / 100).toFixed(2)
      : '';
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Enter amount</p>
        <h3 className="text-xl font-semibold mt-1">Paying {props.flow.scenario.merchant.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">Enter the amount shown by the merchant.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="merchant-amount">Amount</Label>
        <Input
          id="merchant-amount"
          inputMode="decimal"
          value={displayAmount}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^\d.]/g, '');
            const parsed = Number(cleaned);
            const nextMinor = Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
            props.onAmountChange(nextMinor);
          }}
          placeholder="0.00"
          aria-describedby="merchant-amount-help"
        />
        <p id="merchant-amount-help" className="text-xs text-muted-foreground">
          Amount must be greater than 0.
        </p>
      </div>
    </div>
  );
}

function ReviewPaymentScreen({ flow }: { flow: ActiveFlowState }) {
  const quote = flow.quote;
  const rows: [string, string][] = [
    ['Merchant', flow.scenario.merchant.name],
    ['Amount', quote ? formatCurrencyMinor(quote.amountMinor, flow.scenario.entry.currencyCode) : '—'],
    ...(quote && quote.tipMinor > 0 ? [['Tip', formatCurrencyMinor(quote.tipMinor, flow.scenario.entry.currencyCode)] as [string, string]] : [['Tip', 'No tip'] as [string, string]]),
    ...(quote && quote.conversionFeeMinor > 0
      ? [['Conversion fee', formatCurrencyMinor(quote.conversionFeeMinor, flow.scenario.entry.currencyCode)] as [string, string]]
      : []),
    ['Pay with', flow.draft.paymentSourceSelection === 'AUTO_CONVERT' ? 'Vicoins + auto-convert' : 'Icoins'],
    ['Total', quote ? formatCurrencyMinor(quote.totalMinor, flow.scenario.entry.currencyCode) : '—'],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Review payment</p>
          <h3 className="text-xl font-semibold mt-1">Check details before you confirm</h3>
        </div>
        <CheckoutModeBadge flow={flow} />
      </div>
      <SummaryRows rows={rows} />
      <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
        Next, you’ll confirm with Face ID, Touch ID, or PIN.
      </div>
    </div>
  );
}

function AuthenticateScreen(props: {
  flow: ActiveFlowState;
  onChooseFaceId: () => void;
  onChoosePin: () => void;
}) {
  const quote = props.flow.quote;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Confirm payment</p>
        <h3 className="text-xl font-semibold mt-1">
          {quote ? `Pay ${formatCurrencyMinor(quote.totalMinor, props.flow.scenario.entry.currencyCode)}` : 'Pay'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">to {props.flow.scenario.merchant.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={props.onChooseFaceId}
          aria-pressed={props.flow.simulatedAuthMethod === 'FACE_ID'}
          className={cn(
            'rounded-xl border p-3 text-left min-h-11 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            props.flow.simulatedAuthMethod === 'FACE_ID' ? 'border-primary bg-primary/5' : 'border-border/60'
          )}
        >
          <p className="font-medium text-sm">Face ID / Touch ID</p>
          <p className="text-xs text-muted-foreground">Fast biometric confirmation (simulated in this demo).</p>
        </button>
        <button
          type="button"
          onClick={props.onChoosePin}
          aria-pressed={props.flow.simulatedAuthMethod === 'PIN'}
          className={cn(
            'rounded-xl border p-3 text-left min-h-11 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            props.flow.simulatedAuthMethod === 'PIN' ? 'border-primary bg-primary/5' : 'border-border/60'
          )}
        >
          <p className="font-medium text-sm">Use PIN instead</p>
          <p className="text-xs text-muted-foreground">Fallback path for accessibility or biometric issues.</p>
        </button>
      </div>
      <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
        One tap confirms checkout action, but authentication is still required to complete payment.
      </div>
    </div>
  );
}

function ReceiptScreen({ flow }: { flow: ActiveFlowState }) {
  const quote = flow.quote;
  const total = quote ? formatCurrencyMinor(quote.totalMinor, flow.scenario.entry.currencyCode) : '—';
  return (
    <div className="space-y-4">
      <div role="status" aria-live="polite" className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold">Payment sent</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {flow.scenario.merchant.name} received {total}
            </p>
          </div>
        </div>
      </div>

      <SummaryRows
        rows={[
          ['Merchant', flow.scenario.merchant.name],
          ['Amount', quote ? formatCurrencyMinor(quote.amountMinor, flow.scenario.entry.currencyCode) : '—'],
          ...(quote && quote.tipMinor > 0 ? [['Tip', formatCurrencyMinor(quote.tipMinor, flow.scenario.entry.currencyCode)] as [string, string]] : []),
          ...(quote && quote.conversionFeeMinor > 0 ? [['Conversion fee', formatCurrencyMinor(quote.conversionFeeMinor, flow.scenario.entry.currencyCode)] as [string, string]] : []),
          ['Paid with', flow.draft.paymentSourceSelection === 'AUTO_CONVERT' ? 'Vicoins + auto-convert' : 'Icoins'],
          ['Total', total],
          ['Transaction ID', `txn_${flow.scenario.id.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`],
          ['Auth method', flow.simulatedAuthMethod === 'PIN' ? 'PIN' : 'Face ID / Touch ID'],
        ]}
      />

      {flow.plan.tipPlan.enabled && flow.plan.tipPlan.timing === 'POST_PAY' && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground flex items-center gap-2">
          <Receipt className="w-4 h-4" />
          Post-pay tip is enabled for this merchant. The next step is a separate charge.
        </div>
      )}
    </div>
  );
}

function PostPayTipScreen(props: {
  flow: ActiveFlowState;
  currentTipPromptLayout: TipPromptLayout;
  onSelectTip: (selection: TipSelection) => void;
  onDone: () => void;
  onSetTipLayoutPreference: (scope: 'GLOBAL' | 'CATEGORY', layout: TipPromptLayout) => void;
  onDismissTipLayoutShortcut: () => void;
}) {
  const flow = props.flow;
  const tipPlan = flow.plan.tipPlan;
  const quote = flow.quote;
  const layout = props.currentTipPromptLayout === 'AUTO' ? 'BOTTOM_SHEET' : props.currentTipPromptLayout;

  const selectedTipMinor = resolveTipSelectionMinor(
    flow.postPayTipSelection,
    tipPlan.presets,
    quote?.amountMinor ?? 0
  );

  if (flow.postPayTipStatus === 'sent') {
    return (
      <div className="space-y-4">
        <div role="status" aria-live="polite" className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold">{flow.postPayTipMinor > 0 ? 'Tip sent' : 'Finished'}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {flow.postPayTipMinor > 0
                  ? `${flow.scenario.merchant.name} received ${formatCurrencyMinor(flow.postPayTipMinor, flow.scenario.entry.currencyCode)}.`
                  : 'Your payment is complete.'}
              </p>
            </div>
          </div>
        </div>
        {flow.showTipLayoutShortcut && (
          <TipLayoutShortcutCard
            category={flow.scenario.merchant.category}
            onChoose={(scope, layoutChoice) => props.onSetTipLayoutPreference(scope, layoutChoice)}
            onDismiss={props.onDismissTipLayoutShortcut}
          />
        )}
        <Button className="w-full" onClick={props.onDone}>
          Done
        </Button>
      </div>
    );
  }

  const title = tipPlan.mode === 'CHOICE_REQUIRED' ? 'Choose a tip option' : `Add a tip for ${flow.scenario.merchant.name}?`;
  const helper = tipPlan.mode === 'CHOICE_REQUIRED' ? 'Select an option to finish' : 'Optional';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Post-pay tip</p>
          <h3 className="text-lg font-semibold mt-1">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{helper}. This is a separate charge.</p>
        </div>
        <Badge variant="outline">{layout === 'BOTTOM_SHEET' ? 'Bottom Sheet' : 'Full Screen'}</Badge>
      </div>

      <div
        className={cn(
          'border border-border/60 bg-background',
          layout === 'BOTTOM_SHEET' ? 'rounded-2xl shadow-[0_-8px_20px_rgba(0,0,0,0.06)] p-4' : 'rounded-2xl p-4'
        )}
      >
        <TipSelectorCard
          title={tipPlan.mode === 'CHOICE_REQUIRED' ? 'Choose a tip option' : 'Add a tip'}
          helper={tipPlan.mode === 'CHOICE_REQUIRED' ? 'No tip is available.' : 'Optional'}
          currencyCode={flow.scenario.entry.currencyCode}
          amountMinor={quote?.amountMinor ?? 0}
          presets={tipPlan.presets}
          customTipEnabled={tipPlan.customTipEnabled}
          selection={flow.postPayTipSelection}
          onChange={props.onSelectTip}
          hideContainer
        />

        <Separator className="my-4" />

        <div className="flex items-center justify-between text-sm mb-4">
          <span className="text-muted-foreground">Tip amount</span>
          <span className="font-semibold">
            {formatCurrencyMinor(selectedTipMinor, flow.scenario.entry.currencyCode)}
          </span>
        </div>

      </div>

      {flow.showTipLayoutShortcut && (
        <TipLayoutShortcutCard
          category={flow.scenario.merchant.category}
          onChoose={(scope, layoutChoice) => props.onSetTipLayoutPreference(scope, layoutChoice)}
          onDismiss={props.onDismissTipLayoutShortcut}
        />
      )}
    </div>
  );
}

function TipLayoutShortcutCard(props: {
  category: MerchantCategory;
  onChoose: (scope: 'GLOBAL' | 'CATEGORY', layout: TipPromptLayout) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-primary mt-0.5" />
        <div>
          <p className="font-medium text-sm">
            Want tip prompts to open differently for {props.category.replace(/_/g, ' ')}?
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            You’ve changed or skipped tips multiple times in this category. Choose a layout that feels faster.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => props.onChoose('CATEGORY', 'BOTTOM_SHEET')}>
          Use bottom sheet
        </Button>
        <Button variant="outline" onClick={() => props.onChoose('CATEGORY', 'FULL_SCREEN')}>
          Use full screen
        </Button>
        <Button variant="outline" onClick={() => props.onChoose('CATEGORY', 'AUTO')}>
          Keep automatic
        </Button>
        <Button variant="ghost" onClick={() => props.onChoose('GLOBAL', 'BOTTOM_SHEET')}>
          Apply bottom sheet to all categories
        </Button>
      </div>
      <Button variant="ghost" size="sm" onClick={props.onDismiss}>
        Not now
      </Button>
    </div>
  );
}

function TipSelectorCard(props: {
  title: string;
  helper: string;
  currencyCode: string;
  amountMinor: number;
  presets: { type: 'PERCENT' | 'FLAT_MINOR'; value: number; displayLabel: string }[];
  customTipEnabled: boolean;
  selection: TipSelection;
  onChange: (selection: TipSelection) => void;
  hideContainer?: boolean;
}) {
  const [customValue, setCustomValue] = useState('');

  useEffect(() => {
    if (props.selection.kind === 'CUSTOM') {
      setCustomValue((props.selection.amountMinor / 100).toFixed(2));
    }
  }, [props.selection]);

  const content = (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{props.title}</p>
        <p className="text-xs text-muted-foreground mt-1">{props.helper}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <TipOptionButton
          selected={props.selection.kind === 'NONE'}
          onClick={() => props.onChange({ kind: 'NONE' })}
          label="No tip"
        />
        {props.presets.map((preset, index) => (
          <TipOptionButton
            key={`${preset.type}-${preset.value}-${index}`}
            selected={props.selection.kind === 'PRESET' && props.selection.presetIndex === index}
            onClick={() => props.onChange({ kind: 'PRESET', presetIndex: index })}
            label={preset.displayLabel}
            helper={
              preset.type === 'PERCENT'
                ? formatCurrencyMinor(Math.round((props.amountMinor * preset.value) / 100), props.currencyCode)
                : formatCurrencyMinor(preset.value, props.currencyCode)
            }
          />
        ))}
        {props.customTipEnabled && (
          <div className="rounded-xl border border-border/60 p-2 space-y-2 col-span-2 sm:col-span-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">Custom tip</p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  const parsed = Number(customValue);
                  const amountMinor = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
                  props.onChange({ kind: 'CUSTOM', amountMinor });
                }}
              >
                Apply
              </Button>
            </div>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value.replace(/[^\d.]/g, ''))}
            />
          </div>
        )}
      </div>
    </div>
  );

  if (props.hideContainer) return content;
  return <div className="rounded-xl border border-border/60 p-3">{content}</div>;
}

function TipOptionButton(props: {
  selected: boolean;
  onClick: () => void;
  label: string;
  helper?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.selected}
      className={cn(
        'rounded-xl border p-2 text-left transition-colors min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        props.selected ? 'border-primary bg-primary/10 text-primary' : 'border-border/60'
      )}
    >
      <p className="text-sm font-medium">{props.label}</p>
      {props.helper ? <p className="text-[11px] text-muted-foreground mt-0.5">{props.helper}</p> : null}
    </button>
  );
}

function SummaryRows({ rows }: { rows: Array<[label: string, value: string]> }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="space-y-2">
        {rows.map(([label, value], index) => (
          <div key={`${label}-${index}`} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckoutCtaSummary({ flow }: { flow: ActiveFlowState }) {
  const quote = flow.quote;
  if (!quote) return null;

  const isPreConfirmStep =
    flow.currentScreen === 'PAYMENT_DETAILS' ||
    flow.currentScreen === 'REVIEW_PAYMENT' ||
    flow.currentScreen === 'AUTHENTICATE';

  if (!isPreConfirmStep) return null;

  const currency = flow.scenario.entry.currencyCode;
  const totalLabel = formatCurrencyMinor(quote.totalMinor, currency);
  const amountLabel = formatCurrencyMinor(quote.amountMinor, currency);
  const tipLabel = quote.tipMinor > 0 ? formatCurrencyMinor(quote.tipMinor, currency) : 'No tip';
  const feeLabel = quote.conversionFeeMinor > 0 ? formatCurrencyMinor(quote.conversionFeeMinor, currency) : 'None';

  return (
    <div
      className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5"
      aria-label="Payment summary before confirming"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ready to pay</p>
          <p className="text-sm font-medium truncate">{getPaymentSourceLabel(flow)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{totalLabel}</p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-medium tabular-nums">{amountLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Tip</span>
          <span className="font-medium tabular-nums">{tipLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-2 col-span-2">
          <span className="text-muted-foreground">Conversion fee</span>
          <span className="font-medium tabular-nums">{feeLabel}</span>
        </div>
      </div>

      {quote.conversionFeeMinor > 0 && (
        <p className="mt-2 text-xs text-primary">
          Conversion fee included in total.
        </p>
      )}
    </div>
  );
}

function CheckoutBottomBar(props: {
  flow: ActiveFlowState;
  isBusy: boolean;
  onPrimaryAction: () => void;
  onClose: () => void;
}) {
  const { flow } = props;
  const quote = flow.quote;
  const primaryLabel = props.isBusy ? 'Processing…' : getPrimaryActionLabel(flow, quote?.totalMinor ?? null);
  const disablePrimary =
    props.isBusy ||
    (flow.currentScreen === 'AUTHENTICATE' && !flow.simulatedAuthMethod) ||
    (flow.currentScreen === 'ENTER_AMOUNT' && (flow.draft.enteredAmountMinor ?? 0) <= 0) ||
    (flow.currentScreen === 'POST_PAY_TIP' &&
      flow.plan.tipPlan.mode === 'CHOICE_REQUIRED' &&
      flow.postPayTipSelection == null);

  const showNotNow = flow.currentScreen === 'POST_PAY_TIP' && flow.plan.tipPlan.mode !== 'CHOICE_REQUIRED';
  const liveStatusMessage = props.isBusy
    ? 'Processing checkout. Please wait.'
    : `Step ${getCheckoutScreenLabel(flow.currentScreen)}. Primary action: ${primaryLabel}.`;

  return (
    <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mt-4">
      <div className="flex flex-col gap-2">
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {liveStatusMessage}
        </p>
        <CheckoutCtaSummary flow={flow} />
        {showNotNow && (
          <Button variant="outline" onClick={props.onClose} disabled={props.isBusy} className="h-11 rounded-xl">
            Finish without tip
          </Button>
        )}
        <Button onClick={props.onPrimaryAction} disabled={disablePrimary} className="h-11 rounded-xl">
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}

function getPrimaryActionLabel(flow: ActiveFlowState, totalMinor: number | null) {
  const currency = flow.scenario.entry.currencyCode;
  switch (flow.currentScreen) {
    case 'ENTER_AMOUNT':
      return 'Continue';
    case 'PAYMENT_DETAILS':
      if (flow.plan.resolvedCheckoutMode === 'REVIEW_REQUIRED') return 'Review payment';
      return totalMinor != null ? `Pay ${formatCurrencyMinor(totalMinor, currency)}` : 'Pay now';
    case 'REVIEW_PAYMENT':
      return 'Continue to confirm';
    case 'AUTHENTICATE':
      return flow.simulatedAuthMethod === 'PIN' ? 'Confirm with PIN' : 'Confirm payment';
    case 'RECEIPT':
      return flow.plan.tipPlan.enabled && flow.plan.tipPlan.timing === 'POST_PAY' ? 'Add tip' : 'Done';
    case 'POST_PAY_TIP': {
      if (flow.postPayTipStatus === 'sent') return 'Done';
      const tipMinor = resolveTipSelectionMinor(
        flow.postPayTipSelection,
        flow.plan.tipPlan.presets,
        flow.quote?.amountMinor ?? 0
      );
      return tipMinor > 0 ? `Send tip ${formatCurrencyMinor(tipMinor, currency)}` : 'Finish';
    }
    default:
      return 'Continue';
  }
}

function resolveCurrentTipPromptLayout(
  category: MerchantCategory,
  byCategory: Partial<Record<MerchantCategory, TipPromptLayout>>,
  globalLayout: TipPromptLayout,
  accessibility: MerchantCheckoutAccessibility
): TipPromptLayout {
  if (accessibility.screenReader || accessibility.largeText) return 'FULL_SCREEN';
  return byCategory[category] ?? globalLayout;
}
