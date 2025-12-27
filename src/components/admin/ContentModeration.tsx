import React, { useState } from 'react';
import { useAdmin, ContentFlag, UserReport } from '@/hooks/useAdmin';
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
import { 
  Flag, 
  AlertTriangle, 
  Check, 
  X, 
  Eye,
  Clock,
  CheckCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ContentModeration: React.FC = () => {
  const { contentFlags, userReports, resolveFlag, resolveReport } = useAdmin();
  const [selectedFlag, setSelectedFlag] = useState<ContentFlag | null>(null);
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [actionNote, setActionNote] = useState('');

  const pendingFlags = contentFlags.filter(f => f.status === 'pending');
  const resolvedFlags = contentFlags.filter(f => f.status === 'resolved');
  const pendingReports = userReports.filter(r => r.status === 'pending');
  const resolvedReports = userReports.filter(r => r.status === 'resolved');

  const handleResolveFlag = async (action: string) => {
    if (!selectedFlag) return;
    await resolveFlag(selectedFlag.id, action + (actionNote ? `: ${actionNote}` : ''));
    setSelectedFlag(null);
    setActionNote('');
  };

  const handleResolveReport = async (action: string) => {
    if (!selectedReport) return;
    await resolveReport(selectedReport.id, action + (actionNote ? `: ${actionNote}` : ''));
    setSelectedReport(null);
    setActionNote('');
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

  return (
    <div className="space-y-4">
      <Tabs defaultValue="flags" className="space-y-4">
        <TabsList>
          <TabsTrigger value="flags" className="flex items-center gap-2">
            <Flag className="w-4 h-4" />
            Content Flags ({pendingFlags.length})
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            User Reports ({pendingReports.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flags" className="space-y-4">
          {/* Pending Flags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-warning" />
                Pending Flags ({pendingFlags.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingFlags.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No pending flags</p>
              ) : (
                <div className="space-y-3">
                  {pendingFlags.map((flag) => (
                    <div 
                      key={flag.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{flag.content_type}</Badge>
                          <span className="font-medium">{flag.content_id}</span>
                        </div>
                        <p className="text-sm text-destructive font-medium">{flag.reason}</p>
                        {flag.description && (
                          <p className="text-sm text-muted-foreground">{flag.description}</p>
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

          {/* Resolved Flags */}
          {resolvedFlags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  Resolved ({resolvedFlags.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {resolvedFlags.slice(0, 5).map((flag) => (
                    <div 
                      key={flag.id} 
                      className="flex items-center justify-between p-3 border rounded-lg opacity-60"
                    >
                      <div>
                        <span className="text-sm">{flag.content_id} - {flag.reason}</span>
                        <p className="text-xs text-muted-foreground">
                          Action: {flag.action_taken}
                        </p>
                      </div>
                      {getStatusBadge(flag.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          {/* Pending Reports */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-warning" />
                Pending Reports ({pendingReports.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingReports.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No pending reports</p>
              ) : (
                <div className="space-y-3">
                  {pendingReports.map((report) => (
                    <div 
                      key={report.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">User: {report.reported_user_id.slice(0, 8)}...</p>
                        <p className="text-sm text-destructive font-medium">{report.reason}</p>
                        {report.description && (
                          <p className="text-sm text-muted-foreground">{report.description}</p>
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

          {/* Resolved Reports */}
          {resolvedReports.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  Resolved ({resolvedReports.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {resolvedReports.slice(0, 5).map((report) => (
                    <div 
                      key={report.id} 
                      className="flex items-center justify-between p-3 border rounded-lg opacity-60"
                    >
                      <div>
                        <span className="text-sm">User {report.reported_user_id.slice(0, 8)}... - {report.reason}</span>
                        <p className="text-xs text-muted-foreground">
                          Action: {report.action_taken}
                        </p>
                      </div>
                      {getStatusBadge(report.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Flag Review Dialog */}
      <Dialog open={!!selectedFlag} onOpenChange={() => setSelectedFlag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Content Flag</DialogTitle>
            <DialogDescription>
              Take action on this flagged content
            </DialogDescription>
          </DialogHeader>
          {selectedFlag && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p><strong>Content:</strong> {selectedFlag.content_type} - {selectedFlag.content_id}</p>
                <p><strong>Reason:</strong> {selectedFlag.reason}</p>
                {selectedFlag.description && (
                  <p><strong>Description:</strong> {selectedFlag.description}</p>
                )}
              </div>
              <Textarea
                placeholder="Add notes about your action..."
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
              />
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => handleResolveFlag('dismissed')}>
              <X className="w-4 h-4 mr-1" /> Dismiss
            </Button>
            <Button variant="destructive" onClick={() => handleResolveFlag('content_removed')}>
              <Flag className="w-4 h-4 mr-1" /> Remove Content
            </Button>
            <Button onClick={() => handleResolveFlag('warning_issued')}>
              <Check className="w-4 h-4 mr-1" /> Issue Warning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Review Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review User Report</DialogTitle>
            <DialogDescription>
              Take action on this reported user
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
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
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => handleResolveReport('dismissed')}>
              <X className="w-4 h-4 mr-1" /> Dismiss
            </Button>
            <Button variant="destructive" onClick={() => handleResolveReport('user_banned')}>
              <AlertTriangle className="w-4 h-4 mr-1" /> Ban User
            </Button>
            <Button onClick={() => handleResolveReport('warning_issued')}>
              <Check className="w-4 h-4 mr-1" /> Issue Warning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContentModeration;
