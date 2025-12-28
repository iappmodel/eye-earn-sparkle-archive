import React, { useState } from 'react';
import { Copy, Share2, Users, Coins, Loader2, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReferral } from '@/hooks/useReferral';
import { NeuButton } from './NeuButton';
import { Input } from '@/components/ui/input';
import { useLocalization } from '@/contexts/LocalizationContext';

interface ReferralPanelProps {
  showApplyCode?: boolean;
}

export const ReferralPanel: React.FC<ReferralPanelProps> = ({ 
  showApplyCode = true 
}) => {
  const { 
    referralCode, 
    totalReferrals, 
    totalEarnings, 
    isLoading,
    copyReferralLink,
    shareReferralLink,
    applyReferralCode,
  } = useReferral();
  const { formatCurrency } = useLocalization();
  const [applyCode, setApplyCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const handleApplyCode = async () => {
    if (!applyCode.trim()) return;
    setIsApplying(true);
    const success = await applyReferralCode(applyCode.trim());
    if (success) {
      setApplyCode('');
    }
    setIsApplying(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Your Referral Code */}
      <div className="neu-card rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold">Your Referral Code</h3>
        </div>
        
        {referralCode && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 neu-inset rounded-xl px-4 py-3 text-center">
                <span className="font-mono text-xl font-bold tracking-wider gradient-text">
                  {referralCode.code}
                </span>
              </div>
              <NeuButton size="sm" onClick={copyReferralLink}>
                <Copy className="w-4 h-4" />
              </NeuButton>
              <NeuButton size="sm" onClick={shareReferralLink}>
                <Share2 className="w-4 h-4" />
              </NeuButton>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Share your code and earn 10% of your friends' earnings for 90 days!
            </p>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="neu-inset rounded-xl p-4 text-center">
          <Users className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalReferrals}</p>
          <p className="text-xs text-muted-foreground">Friends Invited</p>
        </div>
        <div className="neu-inset rounded-xl p-4 text-center">
          <Coins className="w-5 h-5 text-icoin mx-auto mb-1" />
          <p className="text-2xl font-bold gradient-text-gold">
            {formatCurrency(totalEarnings)}
          </p>
          <p className="text-xs text-muted-foreground">Earned</p>
        </div>
      </div>

      {/* Apply Code */}
      {showApplyCode && (
        <div className="neu-card rounded-2xl p-4">
          <h3 className="font-display font-bold mb-3">Have a Referral Code?</h3>
          <div className="flex gap-2">
            <Input
              value={applyCode}
              onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="flex-1 font-mono uppercase tracking-wider"
              maxLength={8}
            />
            <NeuButton 
              onClick={handleApplyCode} 
              disabled={!applyCode.trim() || isApplying}
            >
              {isApplying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Apply'
              )}
            </NeuButton>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
        <h4 className="font-bold text-sm mb-2">How Referrals Work</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Share your unique code with friends</li>
          <li>• They sign up using your code</li>
          <li>• Earn 10% of their rewards for 90 days</li>
          <li>• No limit on referrals!</li>
        </ul>
      </div>
    </div>
  );
};

export default ReferralPanel;
