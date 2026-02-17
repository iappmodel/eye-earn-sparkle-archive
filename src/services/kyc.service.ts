/**
 * KYC Service – Identity verification: submissions, status, document uploads.
 * Integrates with kyc_submissions and profiles.kyc_status (synced via DB trigger when approved/rejected).
 */
import { supabase } from '@/integrations/supabase/client';

export type KycSubmissionStatus = 'pending' | 'submitted' | 'under_review' | 'approved' | 'rejected';
export type DocumentType = 'passport' | 'drivers_license' | 'national_id';

export interface KycSubmissionRow {
  id: string;
  user_id: string;
  selfie_url: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  document_type: DocumentType | null;
  document_number: string | null;
  document_country: string | null;
  status: KycSubmissionStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

const KYC_BUCKET = 'kyc-documents';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validateFile(file: File): { ok: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: 'File must be under 5MB' };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: 'Use JPEG, PNG, or WebP' };
  }
  return { ok: true };
}

/**
 * Get the current user's KYC submission (if any).
 */
export async function getKycSubmission(userId: string): Promise<KycSubmissionRow | null> {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[KYC] getKycSubmission error:', error);
    return null;
  }
  return data as KycSubmissionRow | null;
}

/**
 * Upload a file to KYC storage and return the public URL.
 */
export async function uploadKycDocument(
  userId: string,
  file: File,
  folder: string
): Promise<string | null> {
  const validation = validateFile(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${folder}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(KYC_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    console.error('[KYC] upload error:', error);
    throw new Error(error.message || 'Upload failed');
  }

  const { data: urlData } = supabase.storage.from(KYC_BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

/**
 * Submit or update selfie only (keeps status pending until ID is submitted).
 */
export async function submitSelfie(userId: string, selfieFile: File): Promise<KycSubmissionRow | null> {
  const selfieUrl = await uploadKycDocument(userId, selfieFile, 'selfie');
  if (!selfieUrl) return null;

  const { data, error } = await supabase
    .from('kyc_submissions')
    .upsert(
      {
        user_id: userId,
        selfie_url: selfieUrl,
        status: 'pending',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('[KYC] submitSelfie error:', error);
    throw new Error(error.message);
  }
  return data as KycSubmissionRow;
}

/**
 * Submit ID documents and set status to submitted (ready for review).
 * Updates profile.kyc_status to 'submitted' for UI consistency.
 */
export async function submitIdDocuments(
  userId: string,
  frontFile: File,
  backFile: File | null,
  documentType: DocumentType
): Promise<KycSubmissionRow | null> {
  const idFrontUrl = await uploadKycDocument(userId, frontFile, 'id-front');
  if (!idFrontUrl) return null;

  let idBackUrl: string | null = null;
  if (backFile) {
    idBackUrl = await uploadKycDocument(userId, backFile, 'id-back');
  }

  const { data, error } = await supabase
    .from('kyc_submissions')
    .upsert(
      {
        user_id: userId,
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        document_type: documentType,
        status: 'submitted',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('[KYC] submitIdDocuments error:', error);
    throw new Error(error.message);
  }

  await supabase
    .from('profiles')
    .update({ kyc_status: 'submitted', updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  return data as KycSubmissionRow;
}

/**
 * Map kyc_submissions.status to profile-facing status.
 * approved -> verified for display; profile.kyc_status is synced by trigger.
 */
export function toProfileKycStatus(status: KycSubmissionStatus): 'pending' | 'submitted' | 'verified' | 'rejected' {
  if (status === 'approved') return 'verified';
  if (status === 'under_review') return 'submitted'; // show as "Under Review"
  return status as 'pending' | 'submitted' | 'rejected';
}

/**
 * Admin-only: approve or reject a KYC submission via edge function.
 * Trigger syncs profiles.kyc_status when status is approved/rejected.
 */
export async function reviewKycSubmission(
  submissionId: string,
  action: 'approve' | 'reject',
  rejectionReason?: string
): Promise<{ success: boolean; error?: string }> {
  if (action === 'reject' && !rejectionReason?.trim()) {
    return { success: false, error: 'Rejection reason is required' };
  }
  const { data, error } = await supabase.functions.invoke('kyc-review', {
    body: {
      submission_id: submissionId,
      action,
      rejection_reason: action === 'reject' ? rejectionReason?.trim() : undefined,
    },
  });
  if (error) return { success: false, error: error.message };
  const err = (data as { error?: string })?.error;
  if (err) return { success: false, error: err };
  return { success: true };
}
