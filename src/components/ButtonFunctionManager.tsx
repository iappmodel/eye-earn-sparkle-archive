import React from 'react';
import { 
  Heart, MessageCircle, Share2, UserPlus, Wallet, User, Settings,
  Coins, Bookmark, Flag, VolumeX, X, Eye, EyeOff, GripVertical,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUICustomization, ButtonAction, ButtonPosition } from '@/contexts/UICustomizationContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface ButtonFunctionManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Available actions with their icons and labels
const actionOptions: { value: ButtonAction; label: string; icon: React.ReactNode }[] = [
  { value: 'like', label: 'Like', icon: <Heart className="w-4 h-4" /> },
  { value: 'comment', label: 'Comment', icon: <MessageCircle className="w-4 h-4" /> },
  { value: 'share', label: 'Share', icon: <Share2 className="w-4 h-4" /> },
  { value: 'follow', label: 'Follow', icon: <UserPlus className="w-4 h-4" /> },
  { value: 'wallet', label: 'Wallet', icon: <Wallet className="w-4 h-4" /> },
  { value: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { value: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  { value: 'tip', label: 'Tip Creator', icon: <Coins className="w-4 h-4" /> },
  { value: 'save', label: 'Save', icon: <Bookmark className="w-4 h-4" /> },
  { value: 'report', label: 'Report', icon: <Flag className="w-4 h-4" /> },
  { value: 'mute', label: 'Mute', icon: <VolumeX className="w-4 h-4" /> },
  { value: 'none', label: 'Disabled', icon: <X className="w-4 h-4" /> },
];

const sizeOptions = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
];

const getActionIcon = (action: ButtonAction) => {
  const option = actionOptions.find(o => o.value === action);
  return option?.icon || <X className="w-4 h-4" />;
};

const getActionLabel = (action: ButtonAction) => {
  const option = actionOptions.find(o => o.value === action);
  return option?.label || 'None';
};

export const ButtonFunctionManager: React.FC<ButtonFunctionManagerProps> = ({
  isOpen,
  onClose,
}) => {
  const { 
    buttonLayout, 
    toggleButtonVisibility, 
    setButtonAction, 
    setButtonSize,
    reorderButtons,
    resetLayout 
  } = useUICustomization();

  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      reorderButtons(draggedIndex, index);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (!isOpen) return null;

  const sortedButtons = [...buttonLayout].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Button Functions
        </h3>
        <button
          onClick={resetLayout}
          className="text-xs text-primary hover:underline"
        >
          Reset to Default
        </button>
      </div>

      <div className="space-y-2">
        {sortedButtons.map((button, index) => (
          <div
            key={button.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl',
              'bg-muted/30 border border-border/30',
              'transition-all duration-200',
              draggedIndex === index && 'opacity-50 scale-95',
              !button.visible && 'opacity-60'
            )}
          >
            {/* Drag handle */}
            <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
              <GripVertical className="w-4 h-4" />
            </div>

            {/* Action icon */}
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              button.visible ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            )}>
              {getActionIcon(button.action)}
            </div>

            {/* Action selector */}
            <div className="flex-1">
              <Select
                value={button.action}
                onValueChange={(value) => setButtonAction(button.id, value as ButtonAction)}
              >
                <SelectTrigger className="h-8 text-sm bg-transparent border-0 p-0 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {actionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        {option.icon}
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Size selector */}
            <Select
              value={button.size}
              onValueChange={(value) => setButtonSize(button.id, value as 'sm' | 'md' | 'lg')}
            >
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Visibility toggle */}
            <button
              onClick={() => toggleButtonVisibility(button.id)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                button.visible 
                  ? 'text-primary hover:bg-primary/10' 
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {button.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Drag to reorder • Click eye to show/hide
      </p>
    </div>
  );
};

export default ButtonFunctionManager;
