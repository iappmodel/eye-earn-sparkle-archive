// Privacy Service for GDPR/CCPA Compliance
import { supabase } from '@/integrations/supabase/client';

export type ConsentType = 
  | 'analytics'
  | 'personalized_ads'
  | 'data_sharing'
  | 'marketing_emails'
  | 'location_tracking';

interface ConsentRecord {
  type: ConsentType;
  granted: boolean;
  grantedAt: Date | null;
  revokedAt: Date | null;
}

interface PrivacyConsents {
  analytics: boolean;
  personalized_ads: boolean;
  data_sharing: boolean;
  marketing_emails: boolean;
  location_tracking: boolean;
}

interface DataExportRequest {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  requestType: 'export' | 'delete';
  fileUrl: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}

interface DeletionRequest {
  id: string;
  status: 'pending' | 'cancelled' | 'executed';
  scheduledDeletionAt: Date;
  reason: string | null;
}

class PrivacyService {
  private cachedConsents: PrivacyConsents | null = null;

  // Get all consents for a user
  async getConsents(userId: string): Promise<PrivacyConsents> {
    if (this.cachedConsents) return this.cachedConsents;

    try {
      const { data, error } = await supabase
        .from('privacy_consents')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const consents: PrivacyConsents = {
        analytics: false,
        personalized_ads: false,
        data_sharing: false,
        marketing_emails: false,
        location_tracking: false,
      };

      (data || []).forEach(record => {
        const type = record.consent_type as ConsentType;
        if (type in consents) {
          consents[type] = record.granted;
        }
      });

      this.cachedConsents = consents;
      return consents;
    } catch (error) {
      console.error('[Privacy] Get consents error:', error);
      return {
        analytics: false,
        personalized_ads: false,
        data_sharing: false,
        marketing_emails: false,
        location_tracking: false,
      };
    }
  }

  // Update a single consent
  async updateConsent(
    userId: string,
    consentType: ConsentType,
    granted: boolean
  ): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('privacy_consents')
        .upsert({
          user_id: userId,
          consent_type: consentType,
          granted,
          granted_at: granted ? now : null,
          revoked_at: granted ? null : now,
          user_agent: navigator.userAgent,
        }, {
          onConflict: 'user_id,consent_type',
        });

      if (error) throw error;

      // Clear cache
      this.cachedConsents = null;
      
      console.log('[Privacy] Consent updated:', { consentType, granted });
      return true;
    } catch (error) {
      console.error('[Privacy] Update consent error:', error);
      return false;
    }
  }

  // Update multiple consents at once
  async updateAllConsents(
    userId: string,
    consents: Partial<PrivacyConsents>
  ): Promise<boolean> {
    try {
      const promises = Object.entries(consents).map(([type, granted]) =>
        this.updateConsent(userId, type as ConsentType, granted)
      );
      
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error('[Privacy] Update all consents error:', error);
      return false;
    }
  }

  // Request data export (GDPR)
  async requestDataExport(userId: string): Promise<string | null> {
    try {
      // Check for existing pending request
      const { data: existing, error: checkError } = await supabase
        .from('data_export_requests')
        .select('id, status')
        .eq('user_id', userId)
        .in('status', ['pending', 'processing'])
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        console.log('[Privacy] Export request already pending');
        return existing.id;
      }

      const { data, error } = await supabase
        .from('data_export_requests')
        .insert({
          user_id: userId,
          request_type: 'export',
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) throw error;

      console.log('[Privacy] Data export requested:', data.id);
      return data.id;
    } catch (error) {
      console.error('[Privacy] Request export error:', error);
      return null;
    }
  }

  // Get data export requests
  async getExportRequests(userId: string): Promise<DataExportRequest[]> {
    try {
      const { data, error } = await supabase
        .from('data_export_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(r => ({
        id: r.id,
        status: r.status as DataExportRequest['status'],
        requestType: r.request_type as 'export' | 'delete',
        fileUrl: r.file_url,
        createdAt: new Date(r.created_at),
        expiresAt: r.expires_at ? new Date(r.expires_at) : null,
      }));
    } catch (error) {
      console.error('[Privacy] Get exports error:', error);
      return [];
    }
  }

  // Request account deletion (with cooling off period)
  async requestAccountDeletion(
    userId: string,
    reason?: string
  ): Promise<{ success: boolean; scheduledDate?: Date }> {
    try {
      // 14-day cooling off period
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 14);

      const { data, error } = await supabase
        .from('account_deletion_requests')
        .upsert({
          user_id: userId,
          reason: reason || null,
          scheduled_deletion_at: scheduledDate.toISOString(),
          status: 'pending',
          cancelled_at: null,
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) throw error;

      console.log('[Privacy] Deletion scheduled for:', scheduledDate);
      return { success: true, scheduledDate };
    } catch (error) {
      console.error('[Privacy] Request deletion error:', error);
      return { success: false };
    }
  }

  // Cancel account deletion
  async cancelAccountDeletion(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('account_deletion_requests')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (error) throw error;

      console.log('[Privacy] Deletion cancelled');
      return true;
    } catch (error) {
      console.error('[Privacy] Cancel deletion error:', error);
      return false;
    }
  }

  // Get deletion request status
  async getDeletionRequest(userId: string): Promise<DeletionRequest | null> {
    try {
      const { data, error } = await supabase
        .from('account_deletion_requests')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        status: data.status as DeletionRequest['status'],
        scheduledDeletionAt: new Date(data.scheduled_deletion_at),
        reason: data.reason,
      };
    } catch (error) {
      console.error('[Privacy] Get deletion request error:', error);
      return null;
    }
  }

  // Check if user has given consent for a specific type
  hasConsent(type: ConsentType): boolean {
    return this.cachedConsents?.[type] ?? false;
  }

  // Clear cached consents (on logout)
  clearCache(): void {
    this.cachedConsents = null;
  }
}

export const privacyService = new PrivacyService();
