import React from 'react';
import { CheckCircle2, Star, BadgeCheck, Crown, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type BadgeType = 'verified' | 'creator' | 'business' | 'admin' | 'moderator';

interface VerificationBadgeProps {
  type: BadgeType;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

const badgeConfig: Record<BadgeType, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
}> = {
  verified: {
    icon: CheckCircle2,
    label: 'Verified Identity',
    color: 'text-primary',
    bgColor: 'bg-primary/20',
  },
  creator: {
    icon: Star,
    label: 'Verified Creator',
    color: 'text-icoin',
    bgColor: 'bg-icoin/20',
  },
  business: {
    icon: Building2,
    label: 'Verified Business',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/20',
  },
  admin: {
    icon: Crown,
    label: 'Administrator',
    color: 'text-red-500',
    bgColor: 'bg-red-500/20',
  },
  moderator: {
    icon: BadgeCheck,
    label: 'Moderator',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
  },
};

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  type,
  size = 'md',
  showTooltip = true,
  className,
}) => {
  const config = badgeConfig[type];
  const Icon = config.icon;

  const badge = (
    <span className={cn('inline-flex items-center', className)}>
      <Icon className={cn(sizeClasses[size], config.color, 'fill-current')} />
    </span>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="text-xs font-medium">{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Role Badge - displays the user's role as a pill
interface RoleBadgeProps {
  role: 'user' | 'creator' | 'moderator' | 'admin';
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className }) => {
  const roleConfig: Record<string, { label: string; className: string }> = {
    user: { label: 'User', className: 'bg-muted text-muted-foreground' },
    creator: { label: 'Creator', className: 'bg-icoin/20 text-icoin' },
    moderator: { label: 'Moderator', className: 'bg-green-500/20 text-green-500' },
    admin: { label: 'Admin', className: 'bg-red-500/20 text-red-500' },
  };

  const config = roleConfig[role] || roleConfig.user;

  return (
    <span className={cn(
      'text-xs font-medium px-2 py-0.5 rounded-full',
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
};

// KYC Status Badge
interface KycStatusBadgeProps {
  status: 'pending' | 'submitted' | 'verified' | 'rejected';
  className?: string;
}

export const KycStatusBadge: React.FC<KycStatusBadgeProps> = ({ status, className }) => {
  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: 'Not Verified', className: 'bg-muted text-muted-foreground' },
    submitted: { label: 'Under Review', className: 'bg-icoin/20 text-icoin' },
    verified: { label: 'Verified', className: 'bg-primary/20 text-primary' },
    rejected: { label: 'Rejected', className: 'bg-destructive/20 text-destructive' },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={cn(
      'text-xs font-medium px-2 py-0.5 rounded-full',
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
};
