import React from 'react';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  users: { id: string; username: string | null }[];
  className?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ users, className }) => {
  if (users.length === 0) return null;

  const getTypingText = () => {
    if (users.length === 1) {
      return `${users[0].username || 'Someone'} is typing`;
    } else if (users.length === 2) {
      return `${users[0].username || 'Someone'} and ${users[1].username || 'someone'} are typing`;
    } else {
      return `${users.length} people are typing`;
    }
  };

  return (
    <div className={cn('flex items-center gap-2 px-4 py-2', className)}>
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-xs text-muted-foreground">{getTypingText()}</span>
    </div>
  );
};
