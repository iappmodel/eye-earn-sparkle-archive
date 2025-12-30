import React, { useState } from 'react';
import { 
  Move, RotateCcw, Smartphone, Monitor, 
  AlignLeft, AlignCenter, AlignRight, 
  ArrowUp, ArrowDown, Maximize2, Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUICustomization } from '@/contexts/UICustomizationContext';
import { NeuButton } from './NeuButton';
import { 
  Heart, MessageCircle, Share2, UserPlus, 
  Wallet, User, Settings 
} from 'lucide-react';

interface LayoutEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

const buttonIcons: Record<string, React.ReactNode> = {
  like: <Heart className="w-4 h-4" />,
  comment: <MessageCircle className="w-4 h-4" />,
  share: <Share2 className="w-4 h-4" />,
  follow: <UserPlus className="w-4 h-4" />,
  wallet: <Wallet className="w-4 h-4" />,
  profile: <User className="w-4 h-4" />,
  settings: <Settings className="w-4 h-4" />,
};

export const LayoutEditor: React.FC<LayoutEditorProps> = ({
  isOpen,
  onClose,
}) => {
  const { buttonLayout, reorderButtons, getVisibleButtons, resetLayout } = useUICustomization();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');

  const visibleButtons = getVisibleButtons();

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
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

  const moveButton = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex >= 0 && toIndex < visibleButtons.length) {
      reorderButtons(fromIndex, toIndex);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Layout Editor
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewMode('mobile')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              previewMode === 'mobile' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPreviewMode('desktop')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              previewMode === 'desktop' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            onClick={resetLayout}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live Preview */}
      <div className={cn(
        'relative rounded-2xl bg-gradient-to-b from-muted/50 to-background',
        'border border-border/50 overflow-hidden',
        previewMode === 'mobile' ? 'aspect-[9/16] max-w-[200px] mx-auto' : 'aspect-video'
      )}>
        {/* Mock content area */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-xs text-muted-foreground/50 text-center">
            <Move className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Preview
          </div>
        </div>

        {/* Button stack preview */}
        <div className={cn(
          'absolute z-10',
          previewMode === 'mobile' 
            ? 'right-2 top-1/2 -translate-y-1/2' 
            : 'right-4 top-1/2 -translate-y-1/2'
        )}>
          <div className="flex flex-col items-center gap-2">
            {visibleButtons.map((button, index) => (
              <div
                key={button.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'cursor-grab active:cursor-grabbing',
                  'transition-all duration-200',
                  draggedIndex === index && 'scale-110 opacity-70'
                )}
              >
                <div className={cn(
                  'rounded-full flex items-center justify-center',
                  'bg-card/80 backdrop-blur border border-border/50',
                  'shadow-lg',
                  button.size === 'sm' && 'w-6 h-6',
                  button.size === 'md' && 'w-8 h-8',
                  button.size === 'lg' && 'w-10 h-10'
                )}>
                  <span className={cn(
                    button.size === 'sm' && 'scale-50',
                    button.size === 'md' && 'scale-75',
                    button.size === 'lg' && 'scale-90'
                  )}>
                    {buttonIcons[button.action] || <Move className="w-4 h-4" />}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reorder controls */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Drag buttons in preview or use arrows to reorder
        </p>
        <div className="grid grid-cols-2 gap-2">
          {visibleButtons.map((button, index) => (
            <div
              key={button.id}
              className={cn(
                'flex items-center justify-between p-2 rounded-lg',
                'bg-muted/30 border border-border/30'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
                <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
                  {buttonIcons[button.action]}
                </div>
                <span className="text-xs font-medium capitalize">{button.action}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveButton(index, 'up')}
                  disabled={index === 0}
                  className={cn(
                    'p-1 rounded transition-colors',
                    index === 0 
                      ? 'text-muted-foreground/30 cursor-not-allowed' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => moveButton(index, 'down')}
                  disabled={index === visibleButtons.length - 1}
                  className={cn(
                    'p-1 rounded transition-colors',
                    index === visibleButtons.length - 1 
                      ? 'text-muted-foreground/30 cursor-not-allowed' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LayoutEditor;
