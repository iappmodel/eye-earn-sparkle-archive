import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReadReceiptProps {
  status: 'sending' | 'sent' | 'delivered' | 'read';
  className?: string;
}

export const ReadReceipt: React.FC<ReadReceiptProps> = ({ status, className }) => {
  return (
    <span className={cn('inline-flex items-center', className)}>
      {status === 'sending' && (
        <span className="w-3 h-3 border border-current/50 border-t-transparent rounded-full animate-spin" />
      )}
      {status === 'sent' && (
        <Check className="w-3 h-3 text-muted-foreground" />
      )}
      {status === 'delivered' && (
        <CheckCheck className="w-3 h-3 text-muted-foreground" />
      )}
      {status === 'read' && (
        <CheckCheck className="w-3 h-3 text-primary" />
      )}
    </span>
  );
};
