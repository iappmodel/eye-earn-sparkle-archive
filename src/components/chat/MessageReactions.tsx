import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Smile, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

interface MessageReactionsProps {
  reactions: Reaction[];
  onAddReaction: (emoji: string) => void;
  onRemoveReaction: (emoji: string) => void;
  className?: string;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏'];

export const MessageReactions: React.FC<MessageReactionsProps> = ({
  reactions,
  onAddReaction,
  onRemoveReaction,
  className,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleReactionClick = (emoji: string, userReacted: boolean) => {
    if (userReacted) {
      onRemoveReaction(emoji);
    } else {
      onAddReaction(emoji);
    }
  };

  return (
    <div className={cn('flex items-center gap-1 flex-wrap', className)}>
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => handleReactionClick(reaction.emoji, reaction.userReacted)}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors',
            reaction.userReacted
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
          )}
        >
          <span>{reaction.emoji}</span>
          <span>{reaction.count}</span>
        </button>
      ))}
      
      <Popover open={showPicker} onOpenChange={setShowPicker}>
        <PopoverTrigger asChild>
          <button className="w-6 h-6 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors">
            <Plus className="w-3 h-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="top" align="start">
          <div className="flex gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onAddReaction(emoji);
                  setShowPicker(false);
                }}
                className="w-8 h-8 rounded hover:bg-muted flex items-center justify-center text-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

// Quick reaction picker for long-press
export const QuickReactionPicker: React.FC<{
  onSelect: (emoji: string) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  return (
    <div className="flex items-center gap-1 bg-background/95 backdrop-blur-sm rounded-full px-2 py-1 shadow-lg border border-border animate-scale-in">
      {COMMON_EMOJIS.slice(0, 6).map((emoji) => (
        <button
          key={emoji}
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-lg transition-transform hover:scale-125"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};
