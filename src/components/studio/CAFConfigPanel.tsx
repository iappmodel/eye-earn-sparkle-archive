import React, { useState } from 'react';
import { 
  Lock, Unlock, Coins, UserPlus, MessageSquare, Share2, Heart, 
  Bell, Zap, ChevronRight, Check, AlertCircle, Users, Gift,
  Eye, EyeOff, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { BlurSegment, CAFConfig } from './MediaBlurEditor';

export type CAFType = 'payment' | 'follow' | 'comment' | 'share' | 'like' | 'subscribe' | 'custom';

interface CAFOption {
  type: CAFType;
  icon: React.ReactNode;
  name: string;
  description: string;
  defaultButtonText: string;
  requiresAmount?: boolean;
  requiresCustomText?: boolean;
}

const cafOptions: CAFOption[] = [
  { 
    type: 'payment', 
    icon: <Coins className="w-5 h-5" />, 
    name: 'Payment', 
    description: 'Require viCoin payment to unlock',
    defaultButtonText: 'Unlock for {amount} viCoins',
    requiresAmount: true,
  },
  { 
    type: 'follow', 
    icon: <UserPlus className="w-5 h-5" />, 
    name: 'Follow', 
    description: 'User must follow you to unlock',
    defaultButtonText: 'Follow to Unlock',
  },
  { 
    type: 'comment', 
    icon: <MessageSquare className="w-5 h-5" />, 
    name: 'Comment', 
    description: 'Require a comment to unlock',
    defaultButtonText: 'Comment to Unlock',
  },
  { 
    type: 'share', 
    icon: <Share2 className="w-5 h-5" />, 
    name: 'Share', 
    description: 'User must share to unlock',
    defaultButtonText: 'Share to Unlock',
  },
  { 
    type: 'like', 
    icon: <Heart className="w-5 h-5" />, 
    name: 'Like', 
    description: 'Require a like to unlock',
    defaultButtonText: 'Like to Unlock',
  },
  { 
    type: 'subscribe', 
    icon: <Bell className="w-5 h-5" />, 
    name: 'Subscribe', 
    description: 'Must be a subscriber',
    defaultButtonText: 'Subscribe to Unlock',
  },
  { 
    type: 'custom', 
    icon: <Zap className="w-5 h-5" />, 
    name: 'Custom', 
    description: 'Define your own unlock condition',
    defaultButtonText: 'Complete Action',
    requiresCustomText: true,
  },
];

interface AutoShowProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  enabled: boolean;
}

interface CAFConfigPanelProps {
  segment: BlurSegment | null;
  onUpdateSegment: (updates: Partial<BlurSegment>) => void;
  autoShowProfiles: AutoShowProfile[];
  onAutoShowProfilesChange: (profiles: AutoShowProfile[]) => void;
}

export const CAFConfigPanel: React.FC<CAFConfigPanelProps> = ({
  segment,
  onUpdateSegment,
  autoShowProfiles,
  onAutoShowProfilesChange,
}) => {
  const [activeTab, setActiveTab] = useState<'caf' | 'autoshow'>('caf');
  const [selectedCAFType, setSelectedCAFType] = useState<CAFType>(
    segment?.cafConfig?.type || 'payment'
  );
  const [paymentAmount, setPaymentAmount] = useState(
    segment?.cafConfig?.amount || 10
  );
  const [customButtonText, setCustomButtonText] = useState(
    segment?.cafConfig?.buttonText || ''
  );
  const [cafDescription, setCafDescription] = useState(
    segment?.cafConfig?.description || ''
  );
  const [customAction, setCustomAction] = useState(
    segment?.cafConfig?.customAction || ''
  );

  if (!segment) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Lock className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Select a blur segment</p>
        <p className="text-sm">Configure Call-for-Action after selecting a segment</p>
      </div>
    );
  }

  const selectedOption = cafOptions.find(o => o.type === selectedCAFType);

  const handleEnableCAF = (enabled: boolean) => {
    if (enabled) {
      const config: CAFConfig = {
        type: selectedCAFType,
        amount: selectedCAFType === 'payment' ? paymentAmount : undefined,
        customAction: selectedCAFType === 'custom' ? customAction : undefined,
        buttonText: customButtonText || selectedOption?.defaultButtonText.replace('{amount}', String(paymentAmount)) || 'Unlock',
        description: cafDescription || `Complete this action to unlock hidden content`,
      };
      onUpdateSegment({ cafEnabled: true, cafConfig: config });
    } else {
      onUpdateSegment({ cafEnabled: false, cafConfig: undefined });
    }
  };

  const handleSaveCAFConfig = () => {
    const config: CAFConfig = {
      type: selectedCAFType,
      amount: selectedCAFType === 'payment' ? paymentAmount : undefined,
      customAction: selectedCAFType === 'custom' ? customAction : undefined,
      buttonText: customButtonText || selectedOption?.defaultButtonText.replace('{amount}', String(paymentAmount)) || 'Unlock',
      description: cafDescription || `Complete this action to unlock hidden content`,
    };
    onUpdateSegment({ cafConfig: config });
  };

  const toggleAutoShowProfile = (profileId: string) => {
    onAutoShowProfilesChange(
      autoShowProfiles.map(p => 
        p.id === profileId ? { ...p, enabled: !p.enabled } : p
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Lock className="w-5 h-5 text-amber-400" />
          Call-for-Action (CAF)
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Enable CAF</span>
          <Switch
            checked={segment.cafEnabled}
            onCheckedChange={handleEnableCAF}
          />
        </div>
      </div>

      {segment.cafEnabled && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="caf">CAF Settings</TabsTrigger>
            <TabsTrigger value="autoshow">Auto-Unlock</TabsTrigger>
          </TabsList>

          <TabsContent value="caf" className="space-y-4 mt-4">
            {/* CAF Type Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Unlock Condition</label>
              <div className="grid grid-cols-2 gap-2">
                {cafOptions.map((option) => (
                  <button
                    key={option.type}
                    onClick={() => setSelectedCAFType(option.type)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg transition-all text-left',
                      'border-2',
                      selectedCAFType === option.type
                        ? 'border-primary bg-primary/10'
                        : 'border-transparent bg-muted/50 hover:bg-muted/80'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      selectedCAFType === option.type
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted-foreground/20 text-muted-foreground'
                    )}>
                      {option.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{option.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {option.description}
                      </p>
                    </div>
                    {selectedCAFType === option.type && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment amount */}
            {selectedCAFType === 'payment' && (
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  viCoin Amount: {paymentAmount}
                </label>
                <Slider
                  value={[paymentAmount]}
                  onValueChange={([v]) => setPaymentAmount(v)}
                  min={1}
                  max={1000}
                  step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1</span>
                  <span>100</span>
                  <span>500</span>
                  <span>1000</span>
                </div>
              </div>
            )}

            {/* Custom action */}
            {selectedCAFType === 'custom' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Custom Action Description</label>
                <Textarea
                  value={customAction}
                  onChange={(e) => setCustomAction(e.target.value)}
                  placeholder="Describe what the user needs to do..."
                  className="min-h-[80px]"
                />
              </div>
            )}

            {/* Button text */}
            <div>
              <label className="text-sm font-medium mb-2 block">Button Text</label>
              <Input
                value={customButtonText}
                onChange={(e) => setCustomButtonText(e.target.value)}
                placeholder={selectedOption?.defaultButtonText.replace('{amount}', String(paymentAmount))}
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium mb-2 block">Description (shown to viewers)</label>
              <Textarea
                value={cafDescription}
                onChange={(e) => setCafDescription(e.target.value)}
                placeholder="This content is locked. Complete the action to unlock..."
                className="min-h-[60px]"
              />
            </div>

            {/* Preview */}
            <div className="p-4 rounded-xl bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground mb-3">Preview:</p>
              <div className="relative">
                <div className="h-32 rounded-lg bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center backdrop-blur-sm">
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-amber-400/20 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-amber-400" />
                    </div>
                    <p className="text-sm font-medium px-4">
                      {cafDescription || 'This content is locked'}
                    </p>
                    <Button size="sm" className="gap-2">
                      {selectedOption?.icon}
                      {customButtonText || selectedOption?.defaultButtonText.replace('{amount}', String(paymentAmount))}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={handleSaveCAFConfig} className="w-full">
              Save CAF Configuration
            </Button>
          </TabsContent>

          <TabsContent value="autoshow" className="space-y-4 mt-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-start gap-3">
                <Eye className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Auto-Unlock for Specific Creators</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enable automatic content unlock for creators you trust without requiring CAF confirmation.
                  </p>
                </div>
              </div>
            </div>

            {autoShowProfiles.length > 0 ? (
              <div className="space-y-2">
                {autoShowProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg transition-all',
                      profile.enabled ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      {profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{profile.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{profile.username}</p>
                    </div>
                    <Switch
                      checked={profile.enabled}
                      onCheckedChange={() => toggleAutoShowProfile(profile.id)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No profiles added</p>
                <p className="text-sm">Follow creators to add them to auto-unlock list</p>
              </div>
            )}

            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-500">
                Auto-unlock will automatically complete CAF requirements without confirmation. 
                This may result in automatic payments or actions.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {!segment.cafEnabled && (
        <div className="p-4 rounded-lg bg-muted/50 text-center">
          <Unlock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Enable CAF to require viewers to complete an action before viewing this content
          </p>
        </div>
      )}
    </div>
  );
};

export default CAFConfigPanel;
