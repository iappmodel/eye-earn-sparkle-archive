import React from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Crown, MessageCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface TimedInteractionSettingsProps {
  showTimedInteractions: boolean;
  showContributorBadges: boolean;
  onToggleInteractions: (enabled: boolean) => void;
  onToggleBadges: (enabled: boolean) => void;
}

export const TimedInteractionSettings: React.FC<TimedInteractionSettingsProps> = ({
  showTimedInteractions,
  showContributorBadges,
  onToggleInteractions,
  onToggleBadges,
}) => {
  return (
    <Card className="bg-background/80 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Eye className="w-5 h-5 text-primary" />
          Interaction Display
        </CardTitle>
        <CardDescription>
          Control how interactions appear on videos you watch
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Timed Interactions Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="space-y-0.5">
              <Label htmlFor="timed-interactions" className="text-base font-medium">
                Timed Interactions
              </Label>
              <p className="text-sm text-muted-foreground">
                Show comments, likes, and rewards at their timestamp
              </p>
            </div>
          </div>
          <Switch
            id="timed-interactions"
            checked={showTimedInteractions}
            onCheckedChange={onToggleInteractions}
          />
        </motion.div>

        <Separator />

        {/* Contributor Badges Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Crown className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="space-y-0.5">
              <Label htmlFor="contributor-badges" className="text-base font-medium">
                Contributor Badges
              </Label>
              <p className="text-sm text-muted-foreground">
                Display top contributors as floating badges on videos
              </p>
            </div>
          </div>
          <Switch
            id="contributor-badges"
            checked={showContributorBadges}
            onCheckedChange={onToggleBadges}
          />
        </motion.div>

        {/* Preview */}
        <Separator />
        
        <div className="space-y-3">
          <Label className="text-sm text-muted-foreground">Preview</Label>
          <div className="relative bg-muted/50 rounded-lg aspect-video overflow-hidden">
            {/* Mock video background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20" />
            
            {/* Mock contributor badges */}
            {showContributorBadges && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute top-2 right-2 flex flex-col gap-1"
              >
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/80 text-black text-[10px]">
                  <Crown className="w-2.5 h-2.5" />
                  <span>@user1</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-400/80 text-black text-[10px]">
                  <span>@user2</span>
                </div>
              </motion.div>
            )}

            {/* Mock timed interactions */}
            {showTimedInteractions && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute left-2 top-1/2 -translate-y-1/2 space-y-1"
              >
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-[10px]">
                  <MessageCircle className="w-2.5 h-2.5 text-blue-400" />
                  <span className="text-blue-300">Amazing!</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-[10px]">
                  <span className="text-red-400">❤️ +5</span>
                </div>
              </motion.div>
            )}

            {/* Mock progress bar with density */}
            {showTimedInteractions && (
              <div className="absolute bottom-3 left-2 right-2 h-0.5 bg-white/20 rounded">
                <div className="absolute w-1 h-1 rounded-full bg-primary -top-0.5 left-[20%]" />
                <div className="absolute w-1 h-1 rounded-full bg-yellow-400 -top-0.5 left-[45%]" />
                <div className="absolute w-1 h-1 rounded-full bg-primary -top-0.5 left-[70%]" />
              </div>
            )}

            {/* Off state */}
            {!showTimedInteractions && !showContributorBadges && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <EyeOff className="w-4 h-4" />
                  <span>Overlays hidden</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TimedInteractionSettings;
