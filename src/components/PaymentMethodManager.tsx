import React, { useState, useEffect } from 'react';
import { CreditCard, Building, Bitcoin, Plus, Trash2, Star, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PaymentMethod {
  id: string;
  method_type: string;
  is_default: boolean;
  nickname: string | null;
  details: {
    account_last4?: string;
    email?: string;
    wallet_address?: string;
    bank_name?: string;
  };
  verified: boolean;
  created_at: string;
}

export const PaymentMethodManager: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newMethod, setNewMethod] = useState({
    type: 'bank',
    nickname: '',
    bankName: '',
    accountLast4: '',
    paypalEmail: '',
    cryptoAddress: '',
  });

  useEffect(() => {
    if (user) {
      loadPaymentMethods();
    }
  }, [user]);

  const loadPaymentMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user?.id)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setMethods((data || []) as PaymentMethod[]);
    } catch (error) {
      console.error('Error loading payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMethod = async () => {
    if (!user) return;

    let details: Record<string, string> = {};
    
    if (newMethod.type === 'bank') {
      if (!newMethod.bankName || !newMethod.accountLast4) {
        toast({ title: 'Please fill in bank details', variant: 'destructive' });
        return;
      }
      details = { bank_name: newMethod.bankName, account_last4: newMethod.accountLast4 };
    } else if (newMethod.type === 'paypal') {
      if (!newMethod.paypalEmail) {
        toast({ title: 'Please enter PayPal email', variant: 'destructive' });
        return;
      }
      details = { email: newMethod.paypalEmail };
    } else if (newMethod.type === 'crypto') {
      if (!newMethod.cryptoAddress) {
        toast({ title: 'Please enter wallet address', variant: 'destructive' });
        return;
      }
      details = { wallet_address: newMethod.cryptoAddress };
    }

    try {
      const { error } = await supabase
        .from('payment_methods')
        .insert({
          user_id: user.id,
          method_type: newMethod.type,
          nickname: newMethod.nickname || null,
          details,
          is_default: methods.length === 0,
        });

      if (error) throw error;

      toast({ title: 'Payment method added' });
      setIsAdding(false);
      setNewMethod({ type: 'bank', nickname: '', bankName: '', accountLast4: '', paypalEmail: '', cryptoAddress: '' });
      loadPaymentMethods();
    } catch (error) {
      console.error('Error adding payment method:', error);
      toast({ title: 'Failed to add payment method', variant: 'destructive' });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      // Remove default from all
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('user_id', user?.id);

      // Set new default
      await supabase
        .from('payment_methods')
        .update({ is_default: true })
        .eq('id', id);

      toast({ title: 'Default payment method updated' });
      loadPaymentMethods();
    } catch (error) {
      console.error('Error setting default:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Payment method removed' });
      loadPaymentMethods();
    } catch (error) {
      console.error('Error deleting payment method:', error);
    }
  };

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'bank': return <Building className="w-5 h-5" />;
      case 'paypal': return <CreditCard className="w-5 h-5" />;
      case 'crypto': return <Bitcoin className="w-5 h-5" />;
      default: return <CreditCard className="w-5 h-5" />;
    }
  };

  const getMethodDisplay = (method: PaymentMethod) => {
    const details = method.details;
    switch (method.method_type) {
      case 'bank':
        return `${details.bank_name || 'Bank'} ****${details.account_last4 || ''}`;
      case 'paypal':
        return details.email || 'PayPal';
      case 'crypto':
        return `${(details.wallet_address || '').slice(0, 8)}...${(details.wallet_address || '').slice(-4)}`;
      default:
        return method.method_type;
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-3">
      {[1, 2].map(i => <div key={i} className="h-16 bg-muted rounded-xl" />)}
    </div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Payment Methods</h3>
        <Sheet open={isAdding} onOpenChange={setIsAdding}>
          <SheetTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="w-4 h-4" /> Add
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add Payment Method</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div>
                <Label>Method Type</Label>
                <Select value={newMethod.type} onValueChange={(v) => setNewMethod({ ...newMethod, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Account</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="crypto">Crypto Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Nickname (optional)</Label>
                <Input
                  placeholder="e.g., My Main Account"
                  value={newMethod.nickname}
                  onChange={(e) => setNewMethod({ ...newMethod, nickname: e.target.value })}
                />
              </div>

              {newMethod.type === 'bank' && (
                <>
                  <div>
                    <Label>Bank Name</Label>
                    <Input
                      placeholder="Bank of America"
                      value={newMethod.bankName}
                      onChange={(e) => setNewMethod({ ...newMethod, bankName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Last 4 Digits of Account</Label>
                    <Input
                      placeholder="1234"
                      maxLength={4}
                      value={newMethod.accountLast4}
                      onChange={(e) => setNewMethod({ ...newMethod, accountLast4: e.target.value })}
                    />
                  </div>
                </>
              )}

              {newMethod.type === 'paypal' && (
                <div>
                  <Label>PayPal Email</Label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={newMethod.paypalEmail}
                    onChange={(e) => setNewMethod({ ...newMethod, paypalEmail: e.target.value })}
                  />
                </div>
              )}

              {newMethod.type === 'crypto' && (
                <div>
                  <Label>Wallet Address</Label>
                  <Input
                    placeholder="0x..."
                    value={newMethod.cryptoAddress}
                    onChange={(e) => setNewMethod({ ...newMethod, cryptoAddress: e.target.value })}
                  />
                </div>
              )}

              <Button className="w-full" onClick={handleAddMethod}>
                Add Payment Method
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {methods.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No payment methods saved</p>
            <p className="text-sm">Add a method to receive payouts</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {methods.map((method) => (
            <Card key={method.id} className={method.is_default ? 'ring-2 ring-primary' : ''}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  {getMethodIcon(method.method_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {method.nickname || getMethodDisplay(method)}
                    </span>
                    {method.is_default && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                    {method.verified && (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {method.nickname ? getMethodDisplay(method) : method.method_type}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!method.is_default && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleSetDefault(method.id)}
                      title="Set as default"
                    >
                      <Star className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => handleDelete(method.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
