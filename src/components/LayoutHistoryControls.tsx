// Layout History Controls - Undo/Redo UI for layout changes
import React from 'react';
import { cn } from '@/lib/utils';
import { Undo2, Redo2, History, Trash2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface HistoryEntry {
  action: string;
  timestamp: number;
}

interface LayoutHistoryControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearHistory: () => void;
  historyLength: number;
  currentIndex: number;
  history?: HistoryEntry[];
}

export const LayoutHistoryControls: React.FC<LayoutHistoryControlsProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearHistory,
  historyLength,
  currentIndex,
  history = [],
}) => {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* Undo button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={cn(
                'p-2 rounded-lg transition-all duration-200',
                'hover:bg-muted active:scale-95',
                canUndo 
                  ? 'text-foreground hover:text-primary' 
                  : 'text-muted-foreground/40 cursor-not-allowed'
              )}
            >
              <Undo2 className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p>Undo (Ctrl+Z)</p>
          </TooltipContent>
        </Tooltip>

        {/* Redo button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={cn(
                'p-2 rounded-lg transition-all duration-200',
                'hover:bg-muted active:scale-95',
                canRedo 
                  ? 'text-foreground hover:text-primary' 
                  : 'text-muted-foreground/40 cursor-not-allowed'
              )}
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p>Redo (Ctrl+Y)</p>
          </TooltipContent>
        </Tooltip>

        {/* History popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'p-2 rounded-lg transition-all duration-200',
                'hover:bg-muted hover:text-primary active:scale-95',
                'text-muted-foreground relative'
              )}
            >
              <History className="w-4 h-4" />
              {historyLength > 1 && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary text-[8px] text-primary-foreground flex items-center justify-center font-bold">
                  {historyLength > 9 ? '9+' : historyLength}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent 
            align="end" 
            className="w-64 p-3"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Edit History</h4>
                <button
                  onClick={onClearHistory}
                  disabled={historyLength <= 1}
                  className={cn(
                    'p-1 rounded hover:bg-muted transition-colors',
                    historyLength <= 1 && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
              
              {/* Progress indicator */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Position {currentIndex + 1} of {historyLength}</span>
                  <span>{canUndo ? `${currentIndex} undo${currentIndex !== 1 ? 's' : ''} available` : 'At beginning'}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / historyLength) * 100}%` }}
                  />
                </div>
              </div>
              
              {/* History list */}
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {history.slice().reverse().map((entry, reversedIndex) => {
                  const actualIndex = history.length - 1 - reversedIndex;
                  const isCurrent = actualIndex === currentIndex;
                  const isPast = actualIndex < currentIndex;
                  const isFuture = actualIndex > currentIndex;
                  
                  return (
                    <div
                      key={reversedIndex}
                      className={cn(
                        'flex items-center justify-between py-1.5 px-2 rounded-lg text-xs transition-colors',
                        isCurrent && 'bg-primary/10 border border-primary/30',
                        isPast && 'opacity-60',
                        isFuture && 'opacity-40'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            isCurrent ? 'bg-primary' : isPast ? 'bg-muted-foreground/50' : 'bg-muted-foreground/30'
                          )}
                        />
                        <span className={cn(
                          'font-medium',
                          isCurrent && 'text-primary'
                        )}>
                          {entry.action}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(entry.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              <p className="text-[10px] text-muted-foreground/70 text-center">
                Changes are tracked automatically
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </TooltipProvider>
  );
};

export default LayoutHistoryControls;
