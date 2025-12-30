import React, { useMemo } from 'react';
import { X, Download, Share2, Copy, Check } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { Button } from './ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProfileQRCodeProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileQRCode: React.FC<ProfileQRCodeProps> = ({
  isOpen,
  onClose,
}) => {
  const { profile, user } = useAuth();
  const [copied, setCopied] = React.useState(false);

  const username = profile?.username || user?.email?.split('@')[0] || 'user';
  const profileUrl = `${window.location.origin}/profile/${username}`;

  // Generate QR code using a simple SVG-based approach
  const qrCodeUrl = useMemo(() => {
    // Using QR Server API for simplicity
    const encoded = encodeURIComponent(profileUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encoded}&bgcolor=transparent&color=currentColor&format=svg`;
  }, [profileUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success('Profile link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.display_name || username}'s Profile`,
          text: `Check out my profile!`,
          url: profileUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  const handleDownload = async () => {
    try {
      // Create a canvas and draw the QR code
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${username}-qr-code.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('QR code downloaded!');
    } catch {
      toast.error('Failed to download QR code');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg animate-slide-up flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-xl font-bold">Profile QR Code</h1>
          <NeuButton onClick={onClose} size="sm">
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        {/* QR Code Card */}
        <div className="neu-card rounded-3xl p-8 mb-6">
          {/* User Info */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-primary/20 mb-3">
              <img 
                src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
                alt={profile?.display_name || username}
                className="w-full h-full object-cover"
              />
            </div>
            <h2 className="font-semibold text-foreground">{profile?.display_name || username}</h2>
            <p className="text-sm text-muted-foreground">@{username}</p>
          </div>

          {/* QR Code */}
          <div className="bg-white rounded-2xl p-4 mb-6">
            <img 
              src={qrCodeUrl}
              alt="Profile QR Code"
              className="w-full aspect-square"
              style={{ filter: 'invert(0)' }}
            />
          </div>

          {/* Profile URL */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50">
            <p className="flex-1 text-sm text-muted-foreground truncate">{profileUrl}</p>
            <button
              onClick={handleCopy}
              className={cn(
                "p-2 rounded-lg transition-colors",
                copied ? "bg-green-500/20 text-green-500" : "hover:bg-secondary"
              )}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={handleDownload}
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
          <Button 
            className="gap-2"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        </div>
      </div>
    </div>
  );
};
