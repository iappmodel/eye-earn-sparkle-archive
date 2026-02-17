import React, { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Copy, Check, Download } from 'lucide-react';
import { toast } from 'sonner';

interface QRCodeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title?: string;
}

export const QRCodeSheet: React.FC<QRCodeSheetProps> = ({
  isOpen,
  onClose,
  url,
  title = 'QR Code',
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!url || !isOpen) return;
    setLoading(true);
    QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setDataUrl)
      .catch(() => toast.error('Failed to generate QR code'))
      .finally(() => setLoading(false));
  }, [url, isOpen]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [url]);

  const handleDownload = useCallback(() => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'qr-code.png';
    link.click();
    toast.success('QR code downloaded!');
  }, [dataUrl]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-center">{title}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col items-center py-4">
          {loading ? (
            <div className="w-[280px] h-[280px] rounded-2xl bg-muted animate-pulse" />
          ) : dataUrl ? (
            <div className="rounded-2xl bg-white p-3 shadow-inner">
              <img
                src={dataUrl}
                alt="QR Code"
                className="w-[280px] h-[280px]"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground truncate max-w-full mt-3 px-2" title={url}>
            {url}
          </p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!dataUrl}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
