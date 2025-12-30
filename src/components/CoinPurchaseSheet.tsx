import React, { useState } from 'react';
import { Coins, Sparkles, Zap, Crown, Rocket, Gift, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useLocalization } from '@/contexts/LocalizationContext';

interface CoinPackage {
  id: string;
  coins: number;
  priceInCents: number;
  bonus: number;
  name: string;
  popular?: boolean;
  bestValue?: boolean;
  icon: React.ReactNode;
}

const COIN_PACKAGES: CoinPackage[] = [
  {
    id: 'small',
    coins: 100,
    priceInCents: 99,
    bonus: 0,
    name: 'Starter',
    icon: <Coins className="w-5 h-5" />,
  },
  {
    id: 'medium',
    coins: 500,
    priceInCents: 449,
    bonus: 50,
    name: 'Popular',
    popular: true,
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    id: 'large',
    coins: 1000,
    priceInCents: 799,
    bonus: 200,
    name: 'Value',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    id: 'xl',
    coins: 5000,
    priceInCents: 3499,
    bonus: 1500,
    name: 'Premium',
    bestValue: true,
    icon: <Crown className="w-5 h-5" />,
  },
  {
    id: 'mega',
    coins: 10000,
    priceInCents: 5999,
    bonus: 5000,
    name: 'Mega',
    icon: <Rocket className="w-5 h-5" />,
  },
];

interface CoinPurchaseSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CoinPurchaseSheet: React.FC<CoinPurchaseSheetProps> = ({
  isOpen,
  onClose,
}) => {
  const { formatCurrency } = useLocalization();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const handlePurchase = async (pkg: CoinPackage) => {
    setPurchasing(pkg.id);
    try {
      const { data, error } = await supabase.functions.invoke('purchase-coins', {
        body: { packageId: pkg.id },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: 'Redirecting to checkout',
          description: 'Complete your purchase in the new tab',
        });
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast({
        title: 'Purchase Failed',
        description: 'Unable to start checkout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPurchasing(null);
    }
  };

  const formatPrice = (cents: number) => {
    return formatCurrency(cents / 100);
  };

  const getDiscount = (pkg: CoinPackage) => {
    if (pkg.bonus === 0) return 0;
    const basePrice = (pkg.coins * 99) / 100; // Base price at $0.99 per 100
    const actualPrice = pkg.priceInCents / 100;
    return Math.round((1 - actualPrice / basePrice) * 100);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Gift className="w-6 h-6 text-icoin" />
            Buy iCoins
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3 overflow-y-auto max-h-[calc(85vh-100px)] pb-8">
          {COIN_PACKAGES.map((pkg) => {
            const discount = getDiscount(pkg);
            const totalCoins = pkg.coins + pkg.bonus;
            const isLoading = purchasing === pkg.id;

            return (
              <Card
                key={pkg.id}
                className={cn(
                  'neu-card relative overflow-hidden transition-all',
                  pkg.popular && 'border-primary/50 bg-primary/5',
                  pkg.bestValue && 'border-icoin/50 bg-icoin/5'
                )}
              >
                {pkg.popular && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-bl-xl">
                    Most Popular
                  </div>
                )}
                {pkg.bestValue && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-icoin text-background text-xs font-bold rounded-bl-xl">
                    Best Value
                  </div>
                )}

                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center',
                        pkg.bestValue 
                          ? 'bg-gradient-to-br from-icoin to-yellow-500 text-background'
                          : pkg.popular
                            ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                      )}>
                        {pkg.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-xl font-bold text-icoin">
                            {totalCoins.toLocaleString()}
                          </span>
                          <span className="text-sm text-muted-foreground">iCoins</span>
                        </div>
                        {pkg.bonus > 0 && (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs bg-icoin/20 text-icoin">
                              +{pkg.bonus} Bonus
                            </Badge>
                            {discount > 0 && (
                              <Badge variant="outline" className="text-xs text-green-500 border-green-500/50">
                                Save {discount}%
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={() => handlePurchase(pkg)}
                      disabled={isLoading}
                      className={cn(
                        'min-w-[80px]',
                        pkg.bestValue && 'bg-gradient-to-r from-icoin to-yellow-500 hover:opacity-90',
                        pkg.popular && 'bg-primary'
                      )}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        formatPrice(pkg.priceInCents)
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <p className="text-xs text-muted-foreground text-center mt-4 px-4">
            Purchases are processed securely via Stripe. iCoins are non-refundable 
            and can be used to send gifts, tips, and unlock premium features.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CoinPurchaseSheet;
