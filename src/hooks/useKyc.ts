/**
 * useKyc – KYC status, submission, and refetch for the current user.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getKycSubmission,
  submitSelfie,
  submitIdDocuments,
  toProfileKycStatus,
  type KycSubmissionRow,
  type KycSubmissionStatus,
  type DocumentType,
} from '@/services/kyc.service';

export type ProfileKycStatus = 'pending' | 'submitted' | 'verified' | 'rejected';

export interface UseKycResult {
  /** Current submission row from DB (null if none) */
  submission: KycSubmissionRow | null;
  /** Profile-facing status (pending | submitted | verified | rejected) */
  status: ProfileKycStatus;
  /** Raw kyc_submissions.status for under_review etc. */
  rawStatus: KycSubmissionStatus | null;
  /** Rejection reason when status is rejected */
  rejectionReason: string | null;
  /** Loading submission from DB */
  isLoading: boolean;
  /** Refetch submission and derive status */
  refetch: () => Promise<void>;
  /** Submit selfie; returns success */
  submitSelfieDocument: (file: File) => Promise<boolean>;
  /** Submit ID docs; returns success */
  submitIdDocuments: (frontFile: File, backFile: File | null, docType: DocumentType) => Promise<boolean>;
  /** Whether user can proceed to ID upload (has selfie) */
  hasSelfie: boolean;
  /** Whether full submission is done (selfie + ID) and awaiting review or result */
  isSubmitted: boolean;
}

export function useKyc(): UseKycResult {
  const { user } = useAuth();
  const [submission, setSubmission] = useState<KycSubmissionRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setSubmission(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const row = await getKycSubmission(user.id);
      setSubmission(row);
    } catch (e) {
      console.error('[useKyc] load error:', e);
      setSubmission(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const submitSelfieDocument = useCallback(
    async (file: File): Promise<boolean> => {
      if (!user) return false;
      try {
        const row = await submitSelfie(user.id, file);
        if (row) {
          setSubmission(row);
          return true;
        }
      } catch (e) {
        console.error('[useKyc] submitSelfie error:', e);
      }
      return false;
    },
    [user?.id]
  );

  const submitIdDocumentsHandler = useCallback(
    async (frontFile: File, backFile: File | null, docType: DocumentType): Promise<boolean> => {
      if (!user) return false;
      try {
        const row = await submitIdDocuments(user.id, frontFile, backFile, docType);
        if (row) {
          setSubmission(row);
          return true;
        }
      } catch (e) {
        console.error('[useKyc] submitIdDocuments error:', e);
      }
      return false;
    },
    [user?.id]
  );

  const status: ProfileKycStatus = submission
    ? toProfileKycStatus(submission.status as KycSubmissionStatus)
    : 'pending';
  const rawStatus: KycSubmissionStatus | null = submission ? (submission.status as KycSubmissionStatus) : null;
  const rejectionReason = submission?.rejection_reason ?? null;
  const hasSelfie = !!submission?.selfie_url;
  const isSubmitted =
    (submission?.status === 'submitted' ||
      submission?.status === 'under_review' ||
      submission?.status === 'approved' ||
      submission?.status === 'rejected') &&
    !!submission?.id_front_url;

  return {
    submission,
    status,
    rawStatus,
    rejectionReason,
    isLoading,
    refetch: load,
    submitSelfieDocument,
    submitIdDocuments: submitIdDocumentsHandler,
    hasSelfie,
    isSubmitted,
  };
}
