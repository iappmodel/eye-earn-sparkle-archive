// Layout History Hook - Undo/Redo functionality for layout changes
import { useState, useCallback, useRef, useEffect } from 'react';
import { PageLayout } from '@/contexts/UICustomizationContext';

interface HistoryState {
  layout: PageLayout;
  timestamp: number;
  action: string;
}

interface UseLayoutHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => PageLayout | null;
  redo: () => PageLayout | null;
  pushState: (layout: PageLayout, action: string) => void;
  clearHistory: () => void;
  historyLength: number;
  currentIndex: number;
  getHistory: () => HistoryState[];
}

const MAX_HISTORY_SIZE = 50;

export function useLayoutHistory(initialLayout: PageLayout): UseLayoutHistoryReturn {
  const [history, setHistory] = useState<HistoryState[]>([
    { layout: initialLayout, timestamp: Date.now(), action: 'Initial' }
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isUndoRedoAction = useRef(false);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const pushState = useCallback((layout: PageLayout, action: string) => {
    // Skip if this is triggered by an undo/redo action
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }

    setHistory(prev => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, currentIndex + 1);
      
      // Add new state
      const newState: HistoryState = {
        layout: JSON.parse(JSON.stringify(layout)), // Deep clone
        timestamp: Date.now(),
        action,
      };
      
      newHistory.push(newState);
      
      // Limit history size
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
        return newHistory;
      }
      
      return newHistory;
    });
    
    setCurrentIndex(prev => Math.min(prev + 1, MAX_HISTORY_SIZE - 1));
  }, [currentIndex]);

  const undo = useCallback((): PageLayout | null => {
    if (!canUndo) return null;
    
    isUndoRedoAction.current = true;
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    
    return JSON.parse(JSON.stringify(history[newIndex].layout));
  }, [canUndo, currentIndex, history]);

  const redo = useCallback((): PageLayout | null => {
    if (!canRedo) return null;
    
    isUndoRedoAction.current = true;
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    
    return JSON.parse(JSON.stringify(history[newIndex].layout));
  }, [canRedo, currentIndex, history]);

  const clearHistory = useCallback(() => {
    if (history[currentIndex]) {
      setHistory([history[currentIndex]]);
      setCurrentIndex(0);
    }
  }, [history, currentIndex]);

  const getHistory = useCallback(() => {
    return history;
  }, [history]);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    pushState,
    clearHistory,
    historyLength: history.length,
    currentIndex,
    getHistory,
  };
}

export default useLayoutHistory;
