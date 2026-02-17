import React, { useState, useEffect } from 'react';
import { useAdmin, ContentFlag, UserReport, ModerationAppeal } from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Flag, 
  AlertTriangle, 
  Check, 
  X, 
  Eye,
  Clock,
  CheckCircle,
  Ban,
  Loader2,
  FileQuestion,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getContentForModeration, type ContentPreview } from '@/services/moderation.service';

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const ContentModeration: React.FC = () => {
  const {
    contentFlags,
    userReports,
    moderationAppeals,
    resolveFlag,
    resolveReport,
    resolveAppeal,
    updateFlagModeratorNotes,
    updateReportModeratorNotes,
    banUser,
  } = useAdmin();
  const [selectedFlag, setSelectedFlag] = useState<ContentFlag | null>(null);
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [selectedAppeal, setSelectedAppeal] = useState<ModerationAppeal | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [appealReviewNote, setAppealReviewNote] = useState('');
  const [flagFilter, setFlagFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [showBanFromReport, setShowBanFromReport] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [banPermanent, setBanPermanent] = useState(true);
  const [banning, setBanning] = useState(false);
  const [contentPreview, setContentPreview] = useState<ContentPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [resolvingFlag, setResolvingFlag] = useState(false);

  const pendingFlags = contentFlags.filter(f => f.status === 'pending');
  const resolvedFlags = contentFlags.filter(f => f.status === 'resolved');
  const pendingReports = userReports.filter(r => r.status === 'pending');
  const resolvedReports = userReports.filter(r => r.status === 'resolved');
  const pendingAppeals = moderationAppeals.filter(a => a.status === 'pending');

  const filteredFlags = (flagFilter === 'pending' ? pendingFlags : flagFilter === 'resolved' ? resolvedFlags : contentFlags)
    .filter(f => severityFilter === 'all' || (f.severity ?? 'medium') === severityFilter)
    .sort((a, b) => (severityOrder[b.severity ?? 'medium'] ?? 2) - (severityOrder[a.severity ?? 'medium'] ?? 2));
  const filteredReports = (reportFilter === 'pending' ? pendingReports : reportFilter === 'resolved' ? resolvedReports : userReports)
    .filter(r => severityFilter === 'all' || (r.severity ?? 'medium') === severityFilter)
    .sort((a, b) => (severityOrder[b.severity ?? 'medium'] ?? 2) - (severityOrder[a.severity ?? 'medium'] ?? 2));

  useEffect(() => {
    if (!selectedFlag) {
      setContentPreview(null);
      return;
    }
    setLoadingPreview(true);
    getContentForModeration(selectedFlag.content_id)
      .then(setContentPreview)
      .finally(() => setLoadingPreview(false));
  }, [selectedFlag?.id, selectedFlag?.content_id]);

  const handleBanFromReport = async () => {
    if (!selectedReport) return;
    const reason = banReason.trim() || selectedReport.reason;
    if (!reason) return;
    setBanning(true);
    await banUser(selectedReport.reported_user_id, reason, banPermanent);
    await resolveReport(selectedReport.id, 'user_banned' + (actionNote ? `: ${actionNote}` : ''), {
      moderatorNote: actionNote.trim() || undefined,
    });
    setBanning(false);
    setShowBanFromReport(false);
    setBanReason('');
    setBanPermanent(true);
    setSelectedReport(null);
    setActionNote('');
  };

  const handleResolveFlag = async (action: string) => {
    if (!selectedFlag) return;
    setResolvingFlag(true);
    const note = actionNote.trim();
    await resolveFlag(
      selectedFlag.id,
      action + (note ? `: ${note}` : ''),
      action === 'content_removed'
        ? { removeContent: true, contentId: selectedFlag.content_id, moderatorNote: note || undefined }
        : { moderatorNote: note || undefined }
    );
    setResolvingFlag(false);
    setSelectedFlag(null);
    setActionNote('');
  };

  const handleResolveReport = async (action: string) => {
    if (!selectedReport) return;
    await resolveReport(selectedReport.id, action + (actionNote ? `: ${actionNote}` : ''), {
      moderatorNote: actionNote.trim() || undefined,
    });
    setSelectedReport(null);
    setActionNote('');
  };

  const handleResolveAppeal = async (outcome: 'upheld' | 'rejected') => {
    if (!selectedAppeal) return;
    await resolveAppeal(selectedAppeal.id, outcome, appealReviewNote.trim() || undefined);
    setSelectedAppeal(null);
    setAppealReviewNote('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-warning border-warning"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="text-primary border-primary"><CheckCircle className="w-3 h-3 mr-1" /> Resolved</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string | undefined) => {
    const s = severity ?? 'medium';
    const variant = s === 'critical' ? 'destructive' : s === 'high' ? 'destructive' : 'secondary';
    return <Badge variant={variant} className="text-xs">{s}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="flags" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="flags" className="flex items-center gap-2">
            <Flag className="w-4 h-4" />
            Content Flags ({pendingFlags.length})
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            User Reports ({pendingReports.length})
          </TabsTrigger>
          <TabsTrigger value="appeals" className="flex items-center gap-2">
            <FileQuestion className="w-4 h-4" />
            Appeals ({pendingAppeals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flags" className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Show:</span>
            <Select value={flagFilter} onValueChange={(v) => setFlagFilter(v as 'all' | 'pending' | 'resolved')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending ({pendingFlags.length})</SelectItem>
                <SelectItem value="resolved">Resolved ({resolvedFlags.length})</SelectItem>
                <SelectItem value="all">All ({contentFlags.length})</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={(v: SeverityFilter) => setSeverityFilter(v)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-warning" />
                Content Flags ({filteredFlags.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredFlags.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No flags</p>
              ) : (
                <div className="space-y-3">
                  {filteredFlags.map((flag) => (
                    <div 
                      key={flag.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary">{flag.content_type}</Badge>
                          {getSeverityBadge(flag.severity)}
                          <span className="font-medium truncate max-w-[180px]">{flag.content_id}</span>
                        </div>
                        <p className="text-sm text-destructive font-medium">{flag.reason}</p>
                        {flag.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{flag.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(flag.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => setSelectedFlag(flag)}>
                        <Eye className="w-4 h-4 mr-1" /> Review
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Show:</span>
            <Select value={reportFilter} onValueChange={(v) => setReportFilter(v as 'all' | 'pending' | 'resolved')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending ({pendingReports.length})</SelectItem>
                <SelectItem value="resolved">Resolved ({resolvedReports.length})</SelectItem>
                <SelectItem value="all">All ({userReports.length})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-warning" />
                User Reports ({filteredReports.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredReports.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No reports</p>
              ) : (
                <div className="space-y-3">
                  {filteredReports.map((report) => (
                    <div 
                      key={report.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">User: {report.reported_user_id.slice(0, 8)}...</p>
                          {getSeverityBadge(report.severity)}
                        </div>
                        <p className="text-sm text-destructive font-medium">{report.reason}</p>
                        {report.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{report.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => setSelectedReport(report)}>
                        <Eye className="w-4 h-4 mr-1" /> Review
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="appeals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileQuestion className="w-5 h-5" />
                Moderation Appeals ({pendingAppeals.length} pending)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Users can appeal resolved flags or reports. Review and uphold or reject.
              </p>
            </CardHeader>
            <CardContent>
              {moderationAppeals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No appeals yet</p>
              ) : (
                <div className="space-y-3">
                  {moderationAppeals.map((appeal) => (
                    <div
                      key={appeal.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{appeal.appealable_type}</Badge>
                          <Badge variant={appeal.status === 'pending' ? 'secondary' : 'outline'}>
                            {appeal.status}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">Appeal: {appeal.reason}</p>
                        <p className="text-xs text-muted-foreground">
                          {appeal.appealable_type} #{appeal.appealable_id.slice(0, 8)}… · {formatDistanceToNow(new Date(appeal.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {appeal.status === 'pending' && (
                        <Button size="sm" onClick={() => setSelectedAppeal(appeal)}>
                          <Eye className="w-4 h-4 mr-1" /> Review
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Flag Review Dialog */}
      <Dialog open={!!selectedFlag} onOpenChange={() => setSelectedFlag(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Content Flag</DialogTitle>
            <DialogDescription>
              Take action on this flagged content. Removing content will set it to deleted.
            </DialogDescription>
          </DialogHeader>
          {selectedFlag && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{selectedFlag.content_type}</span>
                  {getSeverityBadge(selectedFlag.severity)}
                </div>
                <p className="text-sm text-muted-foreground break-all">ID: {selectedFlag.content_id}</p>
                <p><strong>Reason:</strong> {selectedFlag.reason}</p>
                {selectedFlag.description && (
                  <p className="text-sm"><strong>Reporter note:</strong> {selectedFlag.description}</p>
                )}
              </div>
              {loadingPreview && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading content preview…
                </div>
              )}
              {contentPreview && !loadingPreview && (
                <Card className="p-3 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Content preview</p>
                  <div className="flex gap-3">
                    {contentPreview.thumbnail_url && (
                      <img
                        src={contentPreview.thumbnail_url}
                        alt=""
                        className="w-20 h-20 object-cover rounded"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{contentPreview.title || 'Untitled'}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{contentPreview.caption}</p>
                      <p className="text-xs mt-1">Status: {contentPreview.status}</p>
                    </div>
                  </div>
                </Card>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Moderator notes (saved with action)</Label>
                <Textarea
                  placeholder="Add notes about your action..."
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  className="mt-1 min-h-[80px]"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleResolveFlag('dismissed')} disabled={resolvingFlag}>
              <X className="w-4 h-4 mr-1" /> Dismiss
            </Button>
            <Button variant="destructive" onClick={() => handleResolveFlag('content_removed')} disabled={resolvingFlag}>
              {resolvingFlag ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Flag className="w-4 h-4 mr-1" />}
              Remove Content
            </Button>
            <Button onClick={() => handleResolveFlag('warning_issued')} disabled={resolvingFlag}>
              <Check className="w-4 h-4 mr-1" /> Issue Warning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Review Dialog */}
      <Dialog
        open={!!selectedReport}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedReport(null);
            setShowBanFromReport(false);
            setBanReason('');
            setBanPermanent(true);
            setActionNote('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {showBanFromReport ? 'Ban reported user' : 'Review User Report'}
            </DialogTitle>
            <DialogDescription>
              {showBanFromReport
                ? 'Confirm ban. The report will be marked resolved as "user_banned".'
                : 'Take action on this reported user'}
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              {!showBanFromReport ? (
                <>
                  <div className="space-y-2">
                    <p><strong>Reported User:</strong> {selectedReport.reported_user_id}</p>
                    <p><strong>Reason:</strong> {selectedReport.reason}</p>
                    {selectedReport.description && (
                      <p><strong>Description:</strong> {selectedReport.description}</p>
                    )}
                  </div>
                  <Textarea
                    placeholder="Add notes about your action..."
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                  />
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Banning user: <strong>{selectedReport.reported_user_id}</strong>
                  </p>
                  <div className="space-y-2">
                    <Label>Ban reason</Label>
                    <Textarea
                      placeholder={selectedReport.reason || 'Reason for ban...'}
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="permanent"
                      checked={banPermanent}
                      onCheckedChange={(v) => setBanPermanent(!!v)}
                    />
                    <Label htmlFor="permanent" className="text-sm font-normal cursor-pointer">
                      Permanent ban
                    </Label>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter className="flex gap-2 flex-wrap">
            {showBanFromReport ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowBanFromReport(false)}
                  disabled={banning}
                >
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBanFromReport}
                  disabled={banning}
                >
                  {banning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
                  Confirm ban
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => handleResolveReport('dismissed')}>
                  <X className="w-4 h-4 mr-1" /> Dismiss
                </Button>
                <Button variant="destructive" onClick={() => setShowBanFromReport(true)}>
                  <Ban className="w-4 h-4 mr-1" /> Ban User
                </Button>
                <Button onClick={() => handleResolveReport('warning_issued')}>
                  <Check className="w-4 h-4 mr-1" /> Issue Warning
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appeal Review Dialog */}
      <Dialog open={!!selectedAppeal} onOpenChange={(open) => !open && setSelectedAppeal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Appeal</DialogTitle>
            <DialogDescription>
              Uphold = side with the user and reverse the moderation. Reject = keep the original decision.
            </DialogDescription>
          </DialogHeader>
          {selectedAppeal && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p><strong>Type:</strong> {selectedAppeal.appealable_type}</p>
                <p><strong>Appeal reason:</strong> {selectedAppeal.reason}</p>
                <p className="text-xs text-muted-foreground">
                  Submitted {formatDistanceToNow(new Date(selectedAppeal.created_at), { addSuffix: true })}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Review note (optional)</Label>
                <Textarea
                  placeholder="Note for the appeal decision..."
                  value={appealReviewNote}
                  onChange={(e) => setAppealReviewNote(e.target.value)}
                  className="mt-1 min-h-[60px]"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => { setSelectedAppeal(null); setAppealReviewNote(''); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => handleResolveAppeal('rejected')}>
              Reject appeal
            </Button>
            <Button onClick={() => handleResolveAppeal('upheld')}>
              <Check className="w-4 h-4 mr-1" /> Uphold appeal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContentModeration;
