import React, { useState, useEffect } from 'react';
import { Gift, Search, Send, User, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface CoinGift {
  id: string;
  sender_id: string;
  recipient_id: string;
  amount: number;
  coin_type: string;
  message: string | null;
  status: string;
  created_at: string;
  sender_profile?: { username: string; display_name: string; avatar_url: string };
  recipient_profile?: { username: string; display_name: string; avatar_url: string };
}

interface UserProfile {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
}

interface CoinGiftingProps {
  vicoins: number;
  icoins: number;
  onGiftSent?: () => void;
}

export const CoinGifting: React.FC<CoinGiftingProps> = ({ vicoins, icoins, onGiftSent }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [gifts, setGifts] = useState<CoinGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGifting, setIsGifting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [giftAmount, setGiftAmount] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [giftCoinType, setGiftCoinType] = useState<'vicoin' | 'icoin'>('vicoin');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user) {
      loadGiftHistory();
    }
  }, [user]);

  const loadGiftHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('coin_gifts')
        .select('*')
        .or(`sender_id.eq.${user?.id},recipient_id.eq.${user?.id}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Load profile info for each gift
      const giftsWithProfiles = await Promise.all((data || []).map(async (gift) => {
        const [senderData, recipientData] = await Promise.all([
          supabase.from('profiles').select('username, display_name, avatar_url').eq('user_id', gift.sender_id).single(),
          supabase.from('profiles').select('username, display_name, avatar_url').eq('user_id', gift.recipient_id).single(),
        ]);
        return {
          ...gift,
          sender_profile: senderData.data,
          recipient_profile: recipientData.data,
        } as CoinGift;
      }));

      setGifts(giftsWithProfiles);
    } catch (error) {
      console.error('Error loading gift history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url')
        .neq('user_id', user?.id)
        .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults((data || []) as UserProfile[]);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleSendGift = async () => {
    if (!selectedUser || !giftAmount || parseInt(giftAmount) <= 0) {
      toast({ title: 'Please select a user and enter amount', variant: 'destructive' });
      return;
    }

    const amount = parseInt(giftAmount);
    const balance = giftCoinType === 'vicoin' ? vicoins : icoins;

    if (amount > balance) {
      toast({ title: 'Insufficient balance', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      // Deduct from sender's balance
      const balanceField = giftCoinType === 'vicoin' ? 'vicoin_balance' : 'icoin_balance';
      
      const { error: deductError } = await supabase
        .from('profiles')
        .update({ [balanceField]: balance - amount })
        .eq('user_id', user?.id);

      if (deductError) throw deductError;

      // Add to recipient's balance
      const { data: recipientProfile, error: recipientFetchError } = await supabase
        .from('profiles')
        .select(balanceField)
        .eq('user_id', selectedUser.user_id)
        .single();

      if (recipientFetchError) throw recipientFetchError;

      const currentRecipientBalance = (recipientProfile as any)[balanceField] || 0;
      
      const { error: addError } = await supabase
        .from('profiles')
        .update({ [balanceField]: currentRecipientBalance + amount })
        .eq('user_id', selectedUser.user_id);

      if (addError) throw addError;

      // Record the gift
      const { error: giftError } = await supabase
        .from('coin_gifts')
        .insert({
          sender_id: user?.id,
          recipient_id: selectedUser.user_id,
          amount,
          coin_type: giftCoinType,
          message: giftMessage || null,
        });

      if (giftError) throw giftError;

      // Create transaction records
      await supabase.from('transactions').insert([
        {
          user_id: user?.id,
          type: 'gift_sent',
          coin_type: giftCoinType,
          amount: -amount,
          description: `Gift to @${selectedUser.username}`,
        },
        {
          user_id: selectedUser.user_id,
          type: 'gift_received',
          coin_type: giftCoinType,
          amount,
          description: `Gift from @${user?.email?.split('@')[0] || 'user'}`,
        },
      ]);

      toast({ title: `Gift sent to @${selectedUser.username}!` });
      setIsGifting(false);
      setSelectedUser(null);
      setGiftAmount('');
      setGiftMessage('');
      setSearchQuery('');
      setSearchResults([]);
      loadGiftHistory();
      onGiftSent?.();
    } catch (error) {
      console.error('Error sending gift:', error);
      toast({ title: 'Failed to send gift', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const sentGifts = gifts.filter(g => g.sender_id === user?.id);
  const receivedGifts = gifts.filter(g => g.recipient_id === user?.id);

  if (loading) {
    return <div className="h-40 bg-muted rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Coin Gifting</h3>
        </div>
        <Sheet open={isGifting} onOpenChange={setIsGifting}>
          <SheetTrigger asChild>
            <Button size="sm" className="gap-2">
              <Send className="w-4 h-4" /> Send Gift
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Send Coins as Gift</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              {!selectedUser ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search by username..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch}>
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      {searchResults.map((profile) => (
                        <Card
                          key={profile.user_id}
                          className="cursor-pointer hover:bg-accent transition-colors"
                          onClick={() => setSelectedUser(profile)}
                        >
                          <CardContent className="p-3 flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={profile.avatar_url} />
                              <AvatarFallback>
                                <User className="w-5 h-5" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{profile.display_name || profile.username}</p>
                              <p className="text-sm text-muted-foreground">@{profile.username}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Card className="bg-accent/50">
                    <CardContent className="p-3 flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={selectedUser.avatar_url} />
                        <AvatarFallback>
                          <User className="w-5 h-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{selectedUser.display_name || selectedUser.username}</p>
                        <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                        Change
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="flex gap-2">
                    <Button
                      variant={giftCoinType === 'vicoin' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setGiftCoinType('vicoin')}
                    >
                      Vicoin ({vicoins})
                    </Button>
                    <Button
                      variant={giftCoinType === 'icoin' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setGiftCoinType('icoin')}
                    >
                      Icoin ({icoins})
                    </Button>
                  </div>

                  <div>
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={giftAmount}
                      onChange={(e) => setGiftAmount(e.target.value)}
                      min={1}
                      max={giftCoinType === 'vicoin' ? vicoins : icoins}
                    />
                  </div>

                  <div>
                    <Textarea
                      placeholder="Add a message (optional)"
                      value={giftMessage}
                      onChange={(e) => setGiftMessage(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <Button className="w-full" onClick={handleSendGift} disabled={sending}>
                    {sending ? 'Sending...' : 'Send Gift'}
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Tabs defaultValue="received">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="received" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Received
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-2">
            <ArrowRight className="w-4 h-4" /> Sent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-2 mt-4">
          {receivedGifts.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No gifts received yet</p>
          ) : (
            receivedGifts.map((gift) => (
              <Card key={gift.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={gift.sender_profile?.avatar_url} />
                    <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-green-500">
                      +{gift.amount} {gift.coin_type === 'vicoin' ? 'V' : 'I'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      From @{gift.sender_profile?.username || 'user'}
                    </p>
                    {gift.message && (
                      <p className="text-sm italic mt-1">"{gift.message}"</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(gift.created_at), 'MMM d')}
                  </span>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-2 mt-4">
          {sentGifts.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No gifts sent yet</p>
          ) : (
            sentGifts.map((gift) => (
              <Card key={gift.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={gift.recipient_profile?.avatar_url} />
                    <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-muted-foreground">
                      -{gift.amount} {gift.coin_type === 'vicoin' ? 'V' : 'I'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      To @{gift.recipient_profile?.username || 'user'}
                    </p>
                    {gift.message && (
                      <p className="text-sm italic mt-1">"{gift.message}"</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(gift.created_at), 'MMM d')}
                  </span>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
