import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Download, 
  Trash2, 
  Eye, 
  MapPin, 
  Mail, 
  BarChart3,
  Share2,
  AlertTriangle,
  Check,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { privacyService, ConsentType } from '@/services/privacy.service';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card3D } from '@/components/ui/Card3D';
import { Button3D } from '@/components/ui/Button3D';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ConsentItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  type: ConsentType;
  enabled: boolean;
  onToggle: (type: ConsentType, enabled: boolean) => void;
  loading?: boolean;
}

const ConsentItem: React.FC<ConsentItemProps> = ({
  icon,
  title,
  description,
  type,
  enabled,
  onToggle,
  loading
}) => (
  <div className="flex items-center justify-between gap-4 py-4 border-b border-border/50 last:border-0">
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-muted text-primary">{icon}</div>
      <div>
        <h4 className="font-medium text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    <Switch 
      checked={enabled} 
      onCheckedChange={(checked) => onToggle(type, checked)}
      disabled={loading}
    />
  </div>
);

export const PrivacySettings: React.FC = () => {
  const { user } = useAuth();
  const [consents, setConsents] = useState({
    analytics: false,
    personalized_ads: false,
    data_sharing: false,
    marketing_emails: false,
    location_tracking: false,
  });
  const [loading, setLoading] = useState(true);
  const [updatingConsent, setUpdatingConsent] = useState<ConsentType | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [deletionRequest, setDeletionRequest] = useState<{
    status: string;
    scheduledDate: Date;
  } | null>(null);

  useEffect(() => {
    if (user) {
      loadConsents();
      loadDeletionRequest();
    }
  }, [user]);

  const loadConsents = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await privacyService.getConsents(user.id);
      setConsents(data);
    } catch (error) {
      console.error('Failed to load consents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDeletionRequest = async () => {
    if (!user) return;
    const request = await privacyService.getDeletionRequest(user.id);
    if (request && request.status === 'pending') {
      setDeletionRequest({
        status: request.status,
        scheduledDate: request.scheduledDeletionAt,
      });
    }
  };

  const handleConsentToggle = async (type: ConsentType, enabled: boolean) => {
    if (!user) return;
    setUpdatingConsent(type);
    
    const success = await privacyService.updateConsent(user.id, type, enabled);
    
    if (success) {
      setConsents(prev => ({ ...prev, [type]: enabled }));
      toast.success(`${enabled ? 'Enabled' : 'Disabled'} ${type.replace('_', ' ')}`);
    } else {
      toast.error('Failed to update preference');
    }
    
    setUpdatingConsent(null);
  };

  const handleExportData = async () => {
    if (!user) return;
    setExportLoading(true);
    
    const requestId = await privacyService.requestDataExport(user.id);
    
    if (requestId) {
      toast.success('Data export requested. You will be notified when ready.');
    } else {
      toast.error('Failed to request data export');
    }
    
    setExportLoading(false);
  };

  const handleRequestDeletion = async () => {
    if (!user) return;
    
    const result = await privacyService.requestAccountDeletion(user.id, deletionReason);
    
    if (result.success && result.scheduledDate) {
      setDeletionRequest({
        status: 'pending',
        scheduledDate: result.scheduledDate,
      });
      toast.success(`Account scheduled for deletion on ${result.scheduledDate.toLocaleDateString()}`);
    } else {
      toast.error('Failed to request account deletion');
    }
  };

  const handleCancelDeletion = async () => {
    if (!user) return;
    
    const success = await privacyService.cancelAccountDeletion(user.id);
    
    if (success) {
      setDeletionRequest(null);
      toast.success('Account deletion cancelled');
    } else {
      toast.error('Failed to cancel deletion');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-primary/10">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">
            Privacy & Data
          </h2>
          <p className="text-sm text-muted-foreground">
            GDPR & CCPA compliant controls
          </p>
        </div>
      </div>

      {/* Data Consents */}
      <Card3D className="p-4" tiltEnabled={false}>
        <h3 className="font-display text-lg font-semibold mb-4 gradient-text">
          Data Preferences
        </h3>
        
        <ConsentItem
          icon={<BarChart3 className="w-5 h-5" />}
          title="Analytics"
          description="Help improve the app with anonymous usage data"
          type="analytics"
          enabled={consents.analytics}
          onToggle={handleConsentToggle}
          loading={updatingConsent === 'analytics'}
        />

        <ConsentItem
          icon={<Eye className="w-5 h-5" />}
          title="Personalized Ads"
          description="See relevant promotions based on your interests"
          type="personalized_ads"
          enabled={consents.personalized_ads}
          onToggle={handleConsentToggle}
          loading={updatingConsent === 'personalized_ads'}
        />

        <ConsentItem
          icon={<Share2 className="w-5 h-5" />}
          title="Data Sharing"
          description="Share data with trusted partners for better rewards"
          type="data_sharing"
          enabled={consents.data_sharing}
          onToggle={handleConsentToggle}
          loading={updatingConsent === 'data_sharing'}
        />

        <ConsentItem
          icon={<Mail className="w-5 h-5" />}
          title="Marketing Emails"
          description="Receive updates about new features and offers"
          type="marketing_emails"
          enabled={consents.marketing_emails}
          onToggle={handleConsentToggle}
          loading={updatingConsent === 'marketing_emails'}
        />

        <ConsentItem
          icon={<MapPin className="w-5 h-5" />}
          title="Location Tracking"
          description="Enable location-based promotions near you"
          type="location_tracking"
          enabled={consents.location_tracking}
          onToggle={handleConsentToggle}
          loading={updatingConsent === 'location_tracking'}
        />
      </Card3D>

      {/* Data Export */}
      <Card3D className="p-4" tiltEnabled={false}>
        <h3 className="font-display text-lg font-semibold mb-4 gradient-text">
          Your Data
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Download className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-foreground">Download Your Data</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Get a copy of all your personal data (GDPR Article 20)
              </p>
              <Button3D
                variant="secondary"
                size="sm"
                onClick={handleExportData}
                disabled={exportLoading}
              >
                {exportLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Requesting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Request Export
                  </>
                )}
              </Button3D>
            </div>
          </div>

          <a 
            href="/privacy-policy" 
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            View Privacy Policy
          </a>
        </div>
      </Card3D>

      {/* Account Deletion */}
      <Card3D className="p-4 border-destructive/20" tiltEnabled={false}>
        <h3 className="font-display text-lg font-semibold mb-4 text-destructive">
          Danger Zone
        </h3>
        
        {deletionRequest ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <h4 className="font-medium text-destructive">
                  Deletion Scheduled
                </h4>
                <p className="text-sm text-destructive/80">
                  Your account will be permanently deleted on{' '}
                  <strong>{deletionRequest.scheduledDate.toLocaleDateString()}</strong>
                </p>
              </div>
            </div>
            
            <Button
              variant="outline"
              onClick={handleCancelDeletion}
              className="w-full"
            >
              <Check className="w-4 h-4 mr-2" />
              Cancel Deletion Request
            </Button>
          </div>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Your Account?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    This will permanently delete your account and all associated data.
                    You have a 14-day cooling off period to cancel.
                  </p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Reason (optional)
                    </label>
                    <Textarea
                      placeholder="Tell us why you're leaving..."
                      value={deletionReason}
                      onChange={(e) => setDeletionReason(e.target.value)}
                      className="resize-none"
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRequestDeletion}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete My Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          After deletion, your rewards balance will be forfeited and cannot be recovered.
        </p>
      </Card3D>

      {/* Do Not Sell (CCPA) */}
      <Card3D className="p-4" tiltEnabled={false}>
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium text-foreground">
              Do Not Sell My Personal Information
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              California residents: We do not sell your personal information.
              Disable "Data Sharing" above to opt-out of data sharing entirely.
            </p>
            <p className="text-xs text-muted-foreground">
              CCPA compliant | Last updated: December 2024
            </p>
          </div>
        </div>
      </Card3D>
    </div>
  );
};
