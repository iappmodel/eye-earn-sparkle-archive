import React, { useCallback, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Copy, 
  MessageCircle, 
  Mail, 
  Twitter, 
  Facebook, 
  Linkedin,
  Send,
  Check,
  QrCode,
  MoreHorizontal,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  url?: string;
  description?: string;
}

interface ShareOption {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  action: (url: string, title: string) => void;
}

export const ShareSheet: React.FC<ShareSheetProps> = ({
  isOpen,
  onClose,
  title = 'Check out this content!',
  url = window.location.href,
  description = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  }, [url]);

  const shareOptions: ShareOption[] = [
    {
      id: 'messages',
      name: 'Messages',
      icon: <MessageCircle className="w-6 h-6" />,
      color: 'bg-green-500',
      action: (url, title) => {
        // SMS sharing on mobile
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
          window.open(`sms:?body=${encodeURIComponent(`${title} ${url}`)}`);
        } else {
          handleCopyLink();
        }
      },
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: <Send className="w-6 h-6" />,
      color: 'bg-[#25D366]',
      action: (url, title) => {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`);
      },
    },
    {
      id: 'twitter',
      name: 'Twitter/X',
      icon: <Twitter className="w-6 h-6" />,
      color: 'bg-black dark:bg-white dark:text-black',
      action: (url, title) => {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`);
      },
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: <Facebook className="w-6 h-6" />,
      color: 'bg-[#1877F2]',
      action: (url) => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
      },
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: <Linkedin className="w-6 h-6" />,
      color: 'bg-[#0A66C2]',
      action: (url, title) => {
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`);
      },
    },
    {
      id: 'email',
      name: 'Email',
      icon: <Mail className="w-6 h-6" />,
      color: 'bg-gray-600',
      action: (url, title) => {
        window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${description}\n\n${url}`)}`);
      },
    },
  ];

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url,
        });
        toast.success('Shared successfully!');
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          toast.error('Failed to share');
        }
      }
    } else {
      handleCopyLink();
    }
  }, [title, description, url, handleCopyLink]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="pb-4">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-2" />
          <SheetTitle className="text-center">Share</SheetTitle>
        </SheetHeader>

        {/* Share options grid */}
        <div className="grid grid-cols-4 gap-4 py-6">
          {shareOptions.map(option => (
            <button
              key={option.id}
              onClick={() => option.action(url, title)}
              className="flex flex-col items-center gap-2"
            >
              <div className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center text-white",
                option.color
              )}>
                {option.icon}
              </div>
              <span className="text-xs text-muted-foreground">{option.name}</span>
            </button>
          ))}
          
          {/* More options */}
          <button
            onClick={handleNativeShare}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <MoreHorizontal className="w-6 h-6" />
            </div>
            <span className="text-xs text-muted-foreground">More</span>
          </button>
          
          {/* QR Code */}
          <button
            onClick={() => toast.info('QR Code generator coming soon!')}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>
            <span className="text-xs text-muted-foreground">QR Code</span>
          </button>
        </div>

        {/* Copy link section */}
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl">
          <Input
            value={url}
            readOnly
            className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-sm truncate"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCopyLink}
            className="flex-shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </>
            )}
          </Button>
        </div>

        {/* Save to device (for media) */}
        <Button
          variant="outline"
          className="w-full mt-4"
          onClick={() => toast.info('Download feature coming soon!')}
        >
          <Download className="w-4 h-4 mr-2" />
          Save to device
        </Button>
      </SheetContent>
    </Sheet>
  );
};

export default ShareSheet;
