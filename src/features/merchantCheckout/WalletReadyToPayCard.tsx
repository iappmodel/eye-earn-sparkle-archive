import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QrCode, Link2, ArrowLeftRight, ShieldCheck } from 'lucide-react';

interface WalletReadyToPayCardProps {
  icoins: number;
  vicoins: number;
  onScanToPay: () => void;
  onPasteCheckoutLink: () => void;
}

export function WalletReadyToPayCard({
  icoins,
  vicoins,
  onScanToPay,
  onPasteCheckoutLink,
}: WalletReadyToPayCardProps) {
  return (
    <section className="neu-card rounded-3xl p-4 sm:p-5 space-y-4" aria-labelledby="ready-to-pay-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="ready-to-pay-title" className="font-semibold text-base">
              Ready to Pay
            </h2>
            <Badge variant="secondary" className="rounded-full">
              Merchant Checkout V1
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Fast in-store QR, online checkout links, and merchant requests in one checkout shell.
          </p>
        </div>
        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground mb-1">Available Icoins</p>
          <p className="font-semibold text-primary">{Math.max(0, Math.floor(icoins)).toLocaleString()} I</p>
          <p className="text-[11px] text-muted-foreground mt-1">Icoins (spendable money)</p>
        </div>
        <div className="rounded-2xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground mb-1">Vicoins</p>
          <p className="font-semibold">{Math.max(0, Math.floor(vicoins)).toLocaleString()} V</p>
          <p className="text-[11px] text-muted-foreground mt-1">Platform credits (auto-convert available)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button onClick={onScanToPay} className="justify-start gap-2 h-11 rounded-xl">
          <QrCode className="w-4 h-4" />
          Scan to Pay
        </Button>
        <Button variant="outline" onClick={onPasteCheckoutLink} className="justify-start gap-2 h-11 rounded-xl">
          <Link2 className="w-4 h-4" />
          Paste Link / Request
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="rounded-xl border border-border/60 px-3 py-2 flex items-center gap-2">
          <ArrowLeftRight className="w-3.5 h-3.5" />
          One-tap Vicoins to Icoins auto-convert (explicit review math)
        </div>
        <div className="rounded-xl border border-border/60 px-3 py-2">
          Post-pay tips recommended by default to protect checkout completion
        </div>
      </div>
    </section>
  );
}
