import { useState, useCallback, useEffect } from 'react';
import {
  payoutService,
  getPayoutErrorMessage,
  type PayoutMethod,
  type CoinType,
  type PayoutRequestRow,
  type PaymentMethodRow,
  getPayoutFee,
} from '@/services/payout.service';

const PAYOUT_HISTORY_LIMIT = 20;

export function usePayout() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<PayoutRequestRow[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPaymentMethods = useCallback(async () => {
    setLoadingMethods(true);
    setError(null);
    try {
      const list = await payoutService.getPaymentMethods();
      setPaymentMethods(list);
    } catch (e) {
      setError(getPayoutErrorMessage((e as Error)?.message));
    } finally {
      setLoadingMethods(false);
    }
  }, []);

  const loadPayoutHistory = useCallback(async () => {
    setLoadingHistory(true);
    setError(null);
    try {
      const list = await payoutService.getPayoutRequests(PAYOUT_HISTORY_LIMIT);
      setPayoutHistory(list);
    } catch (e) {
      setError(getPayoutErrorMessage((e as Error)?.message));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const requestPayout = useCallback(
    async (params: {
      amount: number;
      coinType: CoinType;
      method: PayoutMethod;
      paymentMethodId?: string | null;
    }) => {
      setRequesting(true);
      setError(null);
      try {
        const result = await payoutService.requestPayout(params);
        if (result.success) {
          await loadPayoutHistory();
          return result;
        }
        const friendlyError = result.error ?? 'Request failed';
        setError(getPayoutErrorMessage(friendlyError));
        return result;
      } catch (e) {
        const msg = getPayoutErrorMessage((e as Error)?.message);
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setRequesting(false);
      }
    },
    [loadPayoutHistory]
  );

  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  return {
    paymentMethods,
    payoutHistory,
    loadPaymentMethods,
    loadPayoutHistory,
    requestPayout,
    getPayoutFee,
    loadingMethods,
    loadingHistory,
    requesting,
    error,
    clearError: () => setError(null),
  };
}
