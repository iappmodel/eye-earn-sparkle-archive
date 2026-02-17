import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import QRCode from 'qrcode';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import {
  X,
  Download,
  Share2,
  Copy,
  Check,
  Printer,
  ImagePlus,
  Loader2,
} from 'lucide-react';
import { NeuButton } from './NeuButton';
import { Button } from './ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/contexts/LocalizationContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const QR_SIZE_SMALL = 200;
const QR_SIZE_MEDIUM = 280;
const QR_SIZE_LARGE = 360;

const SIZE_OPTIONS = [
  { value: QR_SIZE_SMALL, labelKey: 'profile.qrCodeSizeSmall' as const },
  { value: QR_SIZE_MEDIUM, labelKey: 'profile.qrCodeSizeMedium' as const },
  { value: QR_SIZE_LARGE, labelKey: 'profile.qrCodeSizeLarge' as const },
] as const;

type QRSize = typeof QR_SIZE_SMALL | typeof QR_SIZE_MEDIUM | typeof QR_SIZE_LARGE;

interface ProfileQRCodeProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Get QR colors that work on current theme (dark vs light) */
function getQRColors(): { dark: string; light: string } {
  if (typeof document === 'undefined') {
    return { dark: '#0f172a', light: '#ffffff' };
  }
  const isDark =
    document.documentElement.classList.contains('dark') ||
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return isDark
    ? { dark: '#e2e8f0', light: '#1e293b' }
    : { dark: '#0f172a', light: '#ffffff' };
}

export const ProfileQRCode: React.FC<ProfileQRCodeProps> = ({
  isOpen,
  onClose,
}) => {
  const { profile, user } = useAuth();
  const { t } = useLocalization();
  const [copied, setCopied] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);
  const [size, setSize] = useState<QRSize>(QR_SIZE_MEDIUM);
  const [showLogo, setShowLogo] = useState(true);
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null);
  const [svgString, setSvgString] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const username = profile?.username || user?.email?.split('@')[0] || 'user';
  const profileUrl = useMemo(
    () => `${window.location.origin}/profile/${encodeURIComponent(username)}`,
    [username],
  );
  const displayName = profile?.display_name || username;
  const avatarUrl =
    profile?.avatar_url ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  const colors = useMemo(getQRColors, []);

  // Generate base QR (data URL PNG and SVG string)
  useEffect(() => {
    if (!profileUrl || !isOpen) return;
    setLoading(true);
    setError(null);
    const { dark, light } = colors;
    const opts = {
      width: QR_SIZE_LARGE,
      margin: 2,
      color: { dark, light },
      errorCorrectionLevel: showLogo ? 'H' : 'M',
    };
    Promise.all([
      QRCode.toDataURL(profileUrl, { ...opts, width: QR_SIZE_LARGE }),
      QRCode.toString(profileUrl, { type: 'svg', ...opts, width: QR_SIZE_LARGE }),
    ])
      .then(([dataUrl, svg]) => {
        setPngDataUrl(dataUrl);
        setSvgString(svg);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to generate QR');
        toast.error(t('errors.somethingWentWrong'));
      })
      .finally(() => setLoading(false));
  }, [profileUrl, isOpen, colors.dark, colors.light, showLogo, t]);

  // Draw QR on canvas with optional center logo (for export)
  useEffect(() => {
    if (!pngDataUrl || !canvasRef.current || !showLogo) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dim = QR_SIZE_LARGE;
    canvas.width = dim;
    canvas.height = dim;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, dim, dim);
      const logoSize = dim * 0.22;
      const x = (dim - logoSize) / 2;
      const y = (dim - logoSize) / 2;
      ctx.beginPath();
      ctx.arc(dim / 2, dim / 2, logoSize / 2 + 4, 0, Math.PI * 2);
      ctx.fillStyle = colors.light;
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(dim / 2, dim / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, x, y, logoSize, logoSize);
      ctx.restore();
      const avatarImg = new Image();
      avatarImg.crossOrigin = 'anonymous';
      avatarImg.onload = () => {
        ctx.beginPath();
        ctx.arc(dim / 2, dim / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatarImg, x, y, logoSize, logoSize);
      };
      avatarImg.onerror = () => {};
      avatarImg.src = avatarUrl;
    };
    img.onerror = () => {};
    img.src = pngDataUrl;
  }, [pngDataUrl, showLogo, avatarUrl, colors.light]);

  const displaySize = size;

  const getExportDataUrl = useCallback((): string | null => {
    if (showLogo && canvasRef.current) {
      try {
        return canvasRef.current.toDataURL('image/png');
      } catch {
        return pngDataUrl;
      }
    }
    return pngDataUrl;
  }, [showLogo, pngDataUrl]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success(t('profile.qrCodeLinkCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('common.retry'));
    }
  }, [profileUrl, t]);

  const copyImageToClipboard = useCallback(async () => {
    const url = getExportDataUrl();
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setImageCopied(true);
      toast.success(t('profile.qrCodeImageCopied'));
      setTimeout(() => setImageCopied(false), 2000);
    } catch {
      toast.error(t('profile.qrCodeCopyImageUnsupported'));
    }
  }, [getExportDataUrl, t]);

  const handleShare = useCallback(async () => {
    const qrImageUrl = getExportDataUrl();
    if (navigator.share) {
      try {
        const canShareFiles =
          navigator.canShare &&
          (() => {
            try {
              return navigator.canShare({ files: [new File([], 'qrcode.png')] });
            } catch {
              return false;
            }
          })();
        if (canShareFiles && qrImageUrl) {
          const res = await fetch(qrImageUrl);
          const blob = await res.blob();
          const file = new File([blob], `${username}-profile-qr.png`, {
            type: 'image/png',
          });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `${displayName}'s Profile`,
              text: t('profile.qrCodeShareText'),
              url: profileUrl,
              files: [file],
            });
            toast.success(t('common.share'));
            return;
          }
        }
        await navigator.share({
          title: `${displayName}'s Profile`,
          text: t('profile.qrCodeShareText'),
          url: profileUrl,
        });
        toast.success(t('common.share'));
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  }, [profileUrl, displayName, username, getExportDataUrl, t, handleCopyLink]);

  const downloadPng = useCallback(
    (pixels: number) => {
      const url = getExportDataUrl();
      if (!url) return;
      const link = document.createElement('a');
      link.href = url;
      link.download = `${username}-profile-qr-${pixels}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(t('profile.qrCodeDownloaded'));
    },
    [getExportDataUrl, username, t],
  );

  const handleDownloadPng = useCallback(() => {
    downloadPng(displaySize);
  }, [downloadPng, displaySize]);

  const handleDownloadSvg = useCallback(() => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${username}-profile-qr.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(t('profile.qrCodeDownloaded'));
  }, [svgString, username, t]);

  const handlePrint = useCallback(() => {
    const qrImageUrl = getExportDataUrl();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(t('profile.qrCodePrintBlocked'));
      return;
    }
    const printDoc = printWindow.document;
    printDoc.open();
    printDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${displayName} - Profile QR Code</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
            .card { text-align: center; }
            .card img { max-width: 320px; width: 100%; height: auto; border-radius: 12px; }
            .name { font-size: 1.25rem; font-weight: 600; margin: 12px 0 4px; }
            .handle { color: #64748b; font-size: 0.875rem; }
            .url { font-size: 0.75rem; color: #94a3b8; word-break: break-all; margin-top: 12px; }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="${qrImageUrl || ''}" alt="Profile QR Code" />
            <div class="name">${displayName}</div>
            <div class="handle">@${username}</div>
            <div class="url">${profileUrl}</div>
          </div>
        </body>
      </html>
    `);
    printDoc.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.afterprint = () => printWindow.close();
    }, 250);
  }, [displayName, username, profileUrl, getExportDataUrl, t]);

  if (!isOpen) return null;

  return (
    <SwipeDismissOverlay
      isOpen={isOpen}
      onClose={onClose}
      className="flex items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-sm flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold text-foreground">
            {t('profile.qrCodeTitle')}
          </h2>
          <NeuButton onClick={onClose} size="sm" aria-label={t('common.close')}>
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        {/* Card */}
        <div className="neu-card rounded-3xl p-6 mb-4 flex-1 overflow-auto">
          {/* User info */}
          <div className="flex flex-col items-center mb-4">
            <div
              className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-primary/20 shrink-0"
              aria-hidden
            >
              <img
                src={avatarUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="font-semibold text-foreground mt-2 truncate max-w-full text-center">
              {displayName}
            </h3>
            <p className="text-sm text-muted-foreground">@{username}</p>
          </div>

          {/* QR display */}
          <div className="flex flex-col items-center">
            {loading ? (
              <div
                className="flex items-center justify-center rounded-2xl bg-muted/50 border border-border"
                style={{ width: displaySize, height: displaySize }}
              >
                <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div
                className="flex items-center justify-center rounded-2xl bg-destructive/10 text-destructive text-sm p-4"
                style={{ minHeight: displaySize }}
              >
                {error}
              </div>
            ) : (
              <div
                className="rounded-2xl bg-white p-3 shadow-inner overflow-hidden"
                style={{ width: displaySize + 24, height: displaySize + 24 }}
              >
                {showLogo ? (
                  <canvas
                    ref={canvasRef}
                    width={QR_SIZE_LARGE}
                    height={QR_SIZE_LARGE}
                    className="w-full h-full"
                    style={{
                      width: displaySize,
                      height: displaySize,
                      imageRendering: 'pixelated',
                    }}
                    aria-label={t('profile.qrCodeTitle')}
                  />
                ) : (
                  <img
                    src={pngDataUrl || ''}
                    alt={t('profile.qrCodeTitle')}
                    className="w-full h-full object-contain"
                    style={{
                      width: displaySize,
                      height: displaySize,
                      imageRendering: 'pixelated',
                    }}
                  />
                )}
              </div>
            )}

            {/* Size selector */}
            {!loading && !error && (
              <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
                <span className="text-xs text-muted-foreground">
                  {t('profile.qrCodeSize')}:
                </span>
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSize(opt.value)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                      size === opt.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                    )}
                  >
                    {t(opt.labelKey)}
                  </button>
                ))}
              </div>
            )}

            {/* Logo toggle */}
            {!loading && !error && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLogo}
                  onChange={(e) => setShowLogo(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-xs text-muted-foreground">
                  {t('profile.qrCodeShowLogo')}
                </span>
              </label>
            )}
          </div>

          {/* Profile URL + Copy link */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50 mt-4">
            <p className="flex-1 text-sm text-muted-foreground truncate min-w-0">
              {profileUrl}
            </p>
            <button
              type="button"
              onClick={handleCopyLink}
              className={cn(
                'p-2 rounded-lg transition-colors shrink-0',
                copied ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'hover:bg-secondary',
              )}
              aria-label={t('profile.qrCodeCopyLink')}
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleDownloadPng}
            disabled={loading || !!error}
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{t('profile.qrCodeDownloadPng')}</span>
            <span className="sm:hidden">PNG</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleDownloadSvg}
            disabled={loading || !!error}
          >
            <ImagePlus className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{t('profile.qrCodeDownloadSvg')}</span>
            <span className="sm:hidden">SVG</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={copyImageToClipboard}
            disabled={loading || !!error}
            title={t('profile.qrCodeCopyImage')}
          >
            {imageCopied ? (
              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {imageCopied ? t('common.done') : t('profile.qrCodeCopyImage')}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handlePrint}
            disabled={loading || !!error}
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{t('profile.qrCodePrint')}</span>
            <span className="sm:hidden">{t('profile.qrCodePrint')}</span>
          </Button>
        </div>
        <Button
          className="gap-2 mt-2 w-full"
          onClick={handleShare}
          disabled={loading || !!error}
        >
          <Share2 className="w-4 h-4" />
          {t('common.share')}
        </Button>
      </div>
    </SwipeDismissOverlay>
  );
};
