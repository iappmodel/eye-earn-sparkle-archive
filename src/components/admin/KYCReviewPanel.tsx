import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { reviewKycSubmission } from '@/services/kyc.service';
import { CheckCircle2, XCircle, Loader2, FileCheck, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface KycRow {
  id: string;
  user_id: string;
  selfie_url: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  document_type: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
}

const KYCReviewPanel: React.FC = () => {
  const [submissions, setSubmissions] = useState<(KycRow & { profile?: ProfileRow })[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; userId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSubmissions = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('kyc_submissions')
      .select('*')
      .in('status', ['submitted', 'under_review'])
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('KYC fetch error:', error);
      setSubmissions([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set((rows || []).map((r) => r.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, username')
      .in('user_id', userIds);

    const profileMap = new Map<string, ProfileRow>();
    (profiles || []).forEach((p) => profileMap.set(p.user_id, p));

    setSubmissions(
      (rows || []).map((r) => ({
        ...r,
        profile: profileMap.get(r.user_id),
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleApprove = async (submissionId: string) => {
    setActionLoading(submissionId);
    const result = await reviewKycSubmission(submissionId, 'approve');
    setActionLoading(null);
    if (result.success) {
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    }
  };

  const handleReject = async () => {
    if (!rejectDialog || !rejectReason.trim()) return;
    setActionLoading(rejectDialog.id);
    const result = await reviewKycSubmission(rejectDialog.id, 'reject', rejectReason.trim());
    setActionLoading(null);
    setRejectDialog(null);
    setRejectReason('');
    if (result.success) {
      setSubmissions((prev) => prev.filter((s) => s.id !== rejectDialog.id));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="w-5 h-5" />
          KYC Review
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchSubmissions} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : submissions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No KYC submissions pending review.</p>
        ) : (
          <div className="space-y-4">
            {submissions.map((s) => (
              <div
                key={s.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card"
              >
                <div className="flex gap-4">
                  {s.selfie_url && (
                    <img
                      src={s.selfie_url}
                      alt="Selfie"
                      className="w-16 h-16 rounded-full object-cover border"
                    />
                  )}
                  <div>
                    <p className="font-medium">
                      {s.profile?.display_name || s.profile?.username || s.user_id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      @{s.profile?.username || '—'} · {s.document_type || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {s.id_front_url && (
                        <a
                          href={s.id_front_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary underline"
                        >
                          View ID (front)
                        </a>
                      )}
                      {s.id_back_url && (
                        <a
                          href={s.id_back_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary underline"
                        >
                          View ID (back)
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{s.status}</Badge>
                  <Button
                    size="sm"
                    className="text-green-600 hover:text-green-700"
                    variant="outline"
                    onClick={() => handleApprove(s.id)}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === s.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                    )}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setRejectDialog({ id: s.id, userId: s.user_id })}
                    disabled={actionLoading !== null}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject KYC</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection. The user will see this message and can resubmit.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Photo is blurry, document expired, face doesn't match..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            className="mt-2"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || actionLoading !== null}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default KYCReviewPanel;
