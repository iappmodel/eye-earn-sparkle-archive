import React from 'react';
import { 
  Sliders, 
  MessageSquare, 
  Mic, 
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NeuButton } from './NeuButton';

interface AIButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

// Customize Feed
export const CustomizeFeedButton: React.FC<AIButtonProps> = ({ 
  onClick, 
  disabled, 
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'neu-button rounded-2xl px-5 py-3 flex items-center gap-3 transition-all hover:scale-[1.02]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Sliders className="w-5 h-5 text-primary" />
      <span className="text-sm font-medium">Customize Feed</span>
    </button>
  );
};

// AI Feedback Buttons
export const AIFeedbackButtons: React.FC<{
  onLike?: () => void;
  onDislike?: () => void;
  liked?: boolean;
  disliked?: boolean;
  className?: string;
}> = ({ onLike, onDislike, liked, disliked, className }) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={onLike}
        className={cn(
          'p-2 rounded-xl transition-all',
          liked ? 'bg-primary/20 text-primary' : 'neu-button text-muted-foreground hover:text-primary'
        )}
      >
        <ThumbsUp className="w-4 h-4" />
      </button>
      <button
        onClick={onDislike}
        className={cn(
          'p-2 rounded-xl transition-all',
          disliked ? 'bg-destructive/20 text-destructive' : 'neu-button text-muted-foreground hover:text-destructive'
        )}
      >
        <ThumbsDown className="w-4 h-4" />
      </button>
    </div>
  );
};

// Voice Input Button
export const VoiceInputButton: React.FC<AIButtonProps & { 
  isListening?: boolean 
}> = ({ onClick, disabled, isListening = false, className }) => {
  return (
    <NeuButton
      onClick={onClick}
      className={cn(
        'relative',
        isListening && 'animate-pulse',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      variant={isListening ? 'accent' : 'default'}
    >
      <Mic className={cn(
        'w-5 h-5',
        isListening && 'text-primary'
      )} />
      {isListening && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full animate-ping" />
      )}
    </NeuButton>
  );
};

// Smart Suggestion Button
export const SmartSuggestionButton: React.FC<AIButtonProps & {
  suggestion: string;
  onAccept?: () => void;
  onReject?: () => void;
}> = ({ suggestion, onAccept, onReject, className }) => {
  return (
    <div className={cn(
      'neu-card rounded-2xl p-3 flex items-center gap-3 animate-float-in',
      className
    )}>
      <Sparkles className="w-5 h-5 text-primary shrink-0" />
      <p className="text-sm flex-1 text-muted-foreground">{suggestion}</p>
      <div className="flex items-center gap-1">
        <button
          onClick={onAccept}
          className="p-2 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
        >
          <ThumbsUp className="w-4 h-4" />
        </button>
        <button
          onClick={onReject}
          className="p-2 rounded-xl hover:bg-secondary transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

// AI Assistant Chat Button
export const AIAssistantButton: React.FC<AIButtonProps & {
  hasNewMessages?: boolean;
}> = ({ onClick, disabled, hasNewMessages = false, className }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative neu-button rounded-full w-14 h-14 flex items-center justify-center transition-all hover:scale-105',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <MessageSquare className="w-6 h-6 text-primary" />
      {hasNewMessages && (
        <span className="absolute top-0 right-0 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
          <span className="w-2 h-2 bg-primary-foreground rounded-full" />
        </span>
      )}
    </button>
  );
};
