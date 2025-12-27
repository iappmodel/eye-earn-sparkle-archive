import React from 'react';
import { 
  Pencil, 
  Shield, 
  DollarSign, 
  UserPlus, 
  Settings, 
  LogOut,
  Bell,
  HelpCircle,
  FileText,
  Bug,
  Globe,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

// Menu Item Button - Reusable list item style
export const MenuButton: React.FC<ProfileButtonProps & {
  icon: React.ReactNode;
  label: string;
  description?: string;
  badge?: string | number;
  variant?: 'default' | 'danger' | 'premium';
}> = ({ 
  onClick, 
  disabled, 
  icon, 
  label, 
  description,
  badge,
  variant = 'default',
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-4 p-4 rounded-2xl transition-all',
        variant === 'danger' 
          ? 'neu-button hover:bg-destructive/10 text-destructive' 
          : variant === 'premium'
          ? 'bg-gradient-to-r from-icoin/10 to-primary/10 border border-icoin/20'
          : 'neu-button hover:scale-[1.01]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <span className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center',
        variant === 'danger' ? 'bg-destructive/10' : 'neu-inset'
      )}>
        {icon}
      </span>
      <div className="flex-1 text-left">
        <span className={cn(
          'font-medium block',
          variant === 'danger' && 'text-destructive'
        )}>
          {label}
        </span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>
      {badge && (
        <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </button>
  );
};

// Edit Profile
export const EditProfileButton: React.FC<ProfileButtonProps> = (props) => (
  <MenuButton
    {...props}
    icon={<Pencil className="w-5 h-5 text-foreground" />}
    label="Edit Profile"
    description="Update your name, photo, and bio"
  />
);

// KYC Verification
export const KYCVerificationButton: React.FC<ProfileButtonProps & { 
  status?: 'pending' | 'submitted' | 'verified' | 'rejected' 
}> = ({ status = 'pending', ...props }) => (
  <MenuButton
    {...props}
    icon={<Shield className={cn(
      'w-5 h-5',
      status === 'verified' ? 'text-primary' : 
      status === 'submitted' ? 'text-icoin' : 'text-muted-foreground'
    )} />}
    label="KYC Verification"
    description={
      status === 'verified' ? 'Account verified' :
      status === 'submitted' ? 'Under review' :
      status === 'rejected' ? 'Verification failed' :
      'Required for withdrawals'
    }
    badge={status === 'pending' ? 'Required' : undefined}
  />
);

// See Earnings
export const SeeEarningsButton: React.FC<ProfileButtonProps & { 
  todayEarnings?: number 
}> = ({ todayEarnings, ...props }) => (
  <MenuButton
    {...props}
    icon={<DollarSign className="w-5 h-5 text-primary" />}
    label="See Earnings"
    description="Daily, weekly, and monthly stats"
    badge={todayEarnings ? `+${todayEarnings} today` : undefined}
  />
);

// Invite Friends
export const InviteFriendsButton: React.FC<ProfileButtonProps & { 
  bonus?: number 
}> = ({ bonus, ...props }) => (
  <MenuButton
    {...props}
    icon={<UserPlus className="w-5 h-5 text-icoin" />}
    label="Invite Friends"
    description={bonus ? `Earn ${bonus} Vicoins per invite` : 'Share your referral link'}
    variant="premium"
  />
);

// Settings
export const SettingsButton: React.FC<ProfileButtonProps> = (props) => (
  <MenuButton
    {...props}
    icon={<Settings className="w-5 h-5 text-foreground" />}
    label="Settings"
    description="Language, notifications, privacy"
  />
);

// Notifications
export const NotificationsButton: React.FC<ProfileButtonProps & { 
  unreadCount?: number 
}> = ({ unreadCount, ...props }) => (
  <MenuButton
    {...props}
    icon={<Bell className="w-5 h-5 text-foreground" />}
    label="Notifications"
    badge={unreadCount && unreadCount > 0 ? unreadCount : undefined}
  />
);

// Help Center
export const HelpCenterButton: React.FC<ProfileButtonProps> = (props) => (
  <MenuButton
    {...props}
    icon={<HelpCircle className="w-5 h-5 text-foreground" />}
    label="Help Center"
    description="FAQ and support"
  />
);

// Terms & Privacy
export const LegalButton: React.FC<ProfileButtonProps> = (props) => (
  <MenuButton
    {...props}
    icon={<FileText className="w-5 h-5 text-muted-foreground" />}
    label="Terms & Privacy"
  />
);

// Report Bug
export const ReportBugButton: React.FC<ProfileButtonProps> = (props) => (
  <MenuButton
    {...props}
    icon={<Bug className="w-5 h-5 text-muted-foreground" />}
    label="Report a Bug"
  />
);

// Language
export const LanguageButton: React.FC<ProfileButtonProps & { 
  currentLanguage?: string 
}> = ({ currentLanguage = 'English', ...props }) => (
  <MenuButton
    {...props}
    icon={<Globe className="w-5 h-5 text-foreground" />}
    label="Language"
    description={currentLanguage}
  />
);

// Log Out
export const LogOutButton: React.FC<ProfileButtonProps> = (props) => (
  <MenuButton
    {...props}
    icon={<LogOut className="w-5 h-5 text-destructive" />}
    label="Log Out"
    variant="danger"
  />
);
