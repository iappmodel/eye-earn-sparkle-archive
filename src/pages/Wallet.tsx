import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Gift, CreditCard, TrendingUp, History, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { PaymentMethodManager } from '@/components/PaymentMethodManager';
import { PayoutHistory } from '@/components/PayoutHistory';
import { CoinGifting } from '@/components/CoinGifting';

interface WalletBalance {
  icoin: number;
  vicoin: number;
}

interface Transaction {
  id: string;
  type: 'earn' | 'spend' | 'transfer' | 'purchase';
  amount: number;
  coinType: 'icoin' | 'vicoin';
  description: string;
  createdAt: Date;
}

const Wallet = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [balance, setBalance] = useState<WalletBalance>({ icoin: 0, vicoin: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showGifting, setShowGifting] = useState(false);

  useEffect(() => {
    if (user) {
      loadWalletData();
    }
  }, [user]);

  const loadWalletData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Load balance
      const { data: profile } = await supabase
        .from('profiles')
        .select('icoin_balance, vicoin_balance')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setBalance({
          icoin: profile.icoin_balance || 0,
          vicoin: profile.vicoin_balance || 0,
        });
      }

      // Load transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (txData) {
        setTransactions(txData.map(tx => ({
          id: tx.id,
          type: tx.type as Transaction['type'],
          amount: tx.amount,
          coinType: tx.coin_type as 'icoin' | 'vicoin',
          description: tx.description || tx.type,
          createdAt: new Date(tx.created_at),
        })));
      }
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatBalance = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
    return amount.toLocaleString();
  };

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'earn': return <ArrowDownRight className="w-4 h-4 text-green-500" />;
      case 'spend': return <ArrowUpRight className="w-4 h-4 text-red-500" />;
      case 'transfer': return <Gift className="w-4 h-4 text-blue-500" />;
      case 'purchase': return <CreditCard className="w-4 h-4 text-purple-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Wallet</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate('/my-page')}>
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-70px)]">
        <div className="p-4 space-y-6">
          {/* Balance Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">i</span>
                  </div>
                  <span className="text-sm font-medium">iCoin</span>
                </div>
                <p className="text-2xl font-bold">{formatBalance(balance.icoin)}</p>
                <p className="text-xs text-muted-foreground mt-1">Earned rewards</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">V</span>
                  </div>
                  <span className="text-sm font-medium">ViCoin</span>
                </div>
                <p className="text-2xl font-bold">{formatBalance(balance.vicoin)}</p>
                <p className="text-xs text-muted-foreground mt-1">Purchased coins</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="flex-col h-auto py-4"
              onClick={() => setShowPurchase(true)}
            >
              <CreditCard className="w-5 h-5 mb-1.5" />
              <span className="text-xs">Buy</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col h-auto py-4"
              onClick={() => setShowGifting(true)}
            >
              <Gift className="w-5 h-5 mb-1.5" />
              <span className="text-xs">Gift</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col h-auto py-4"
              onClick={() => navigate('/earnings')}
            >
              <TrendingUp className="w-5 h-5 mb-1.5" />
              <span className="text-xs">Earnings</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col h-auto py-4"
              onClick={() => navigate('/my-page')}
            >
              <ArrowUpRight className="w-5 h-5 mb-1.5" />
              <span className="text-xs">Withdraw</span>
            </Button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="history" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="history" className="flex-1">
                <History className="w-4 h-4 mr-1.5" />
                History
              </TabsTrigger>
              <TabsTrigger value="payouts" className="flex-1">
                <ArrowUpRight className="w-4 h-4 mr-1.5" />
                Payouts
              </TabsTrigger>
              <TabsTrigger value="methods" className="flex-1">
                <CreditCard className="w-4 h-4 mr-1.5" />
                Methods
              </TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-4">
              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No transactions yet</p>
                  </div>
                ) : (
                  transactions.map(tx => (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium capitalize">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.createdAt.toLocaleDateString()}
                        </p>
                      </div>
                      <div className={cn(
                        "font-bold",
                        tx.type === 'earn' || tx.type === 'purchase' ? 'text-green-500' : 'text-red-500'
                      )}>
                        {tx.type === 'earn' || tx.type === 'purchase' ? '+' : '-'}
                        {tx.amount} {tx.coinType}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="payouts" className="mt-4">
              <PayoutHistory />
            </TabsContent>

            <TabsContent value="methods" className="mt-4">
              <PaymentMethodManager />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>

      {/* Purchase Sheet */}
      <Sheet open={showPurchase} onOpenChange={setShowPurchase}>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle>Buy Coins</SheetTitle>
          </SheetHeader>
          <div className="py-4">
            <p className="text-muted-foreground text-center">
              Coin purchase packages coming soon!
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Gifting Sheet */}
      <Sheet open={showGifting} onOpenChange={setShowGifting}>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle>Send Gift</SheetTitle>
          </SheetHeader>
          <div className="py-4">
            <CoinGifting vicoins={balance.vicoin} icoins={balance.icoin} onGiftSent={loadWalletData} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Wallet;
