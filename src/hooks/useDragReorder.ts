import { useState, useCallback, useRef } from 'react';

interface DragState {
  draggingIndex: number | null;
  hoverIndex: number | null;
  startY: number;
  currentY: number;
}

export function useDragReorder(itemCount: number, onReorder: (from: number, to: number) => void) {
  const [dragState, setDragState] = useState<DragState>({
    draggingIndex: null,
    hoverIndex: null,
    startY: 0,
    currentY: 0,
  });
  const itemHeightRef = useRef(64); // approximate height of a stop card

  const handleDragStart = useCallback((index: number, clientY: number) => {
    setDragState({
      draggingIndex: index,
      hoverIndex: index,
      startY: clientY,
      currentY: clientY,
    });
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    setDragState(prev => {
      if (prev.draggingIndex === null) return prev;
      const delta = clientY - prev.startY;
      const indexOffset = Math.round(delta / itemHeightRef.current);
      const newHover = Math.max(0, Math.min(itemCount - 1, prev.draggingIndex + indexOffset));
      return { ...prev, currentY: clientY, hoverIndex: newHover };
    });
  }, [itemCount]);

  const handleDragEnd = useCallback(() => {
    setDragState(prev => {
      if (prev.draggingIndex !== null && prev.hoverIndex !== null && prev.draggingIndex !== prev.hoverIndex) {
        onReorder(prev.draggingIndex, prev.hoverIndex);
      }
      return { draggingIndex: null, hoverIndex: null, startY: 0, currentY: 0 };
    });
  }, [onReorder]);

  const getDragHandlers = useCallback((index: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      handleDragStart(index, e.clientY);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (dragState.draggingIndex !== null) {
        handleDragMove(e.clientY);
      }
    },
    onPointerUp: () => handleDragEnd(),
    onPointerCancel: () => handleDragEnd(),
  }), [dragState.draggingIndex, handleDragStart, handleDragMove, handleDragEnd]);

  const getItemStyle = useCallback((index: number): React.CSSProperties => {
    if (dragState.draggingIndex === null) return {};
    
    if (index === dragState.draggingIndex) {
      const offset = dragState.currentY - dragState.startY;
      return {
        transform: `translateY(${offset}px) scale(1.02)`,
        zIndex: 50,
        opacity: 0.9,
        transition: 'none',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      };
    }

    // Shift items to make room
    const { draggingIndex, hoverIndex } = dragState;
    if (hoverIndex === null) return {};

    if (draggingIndex < hoverIndex) {
      // Dragging down: items between drag & hover shift up
      if (index > draggingIndex && index <= hoverIndex) {
        return { transform: `translateY(-${itemHeightRef.current}px)`, transition: 'transform 200ms ease' };
      }
    } else {
      // Dragging up: items between hover & drag shift down
      if (index >= hoverIndex && index < draggingIndex) {
        return { transform: `translateY(${itemHeightRef.current}px)`, transition: 'transform 200ms ease' };
      }
    }

    return { transition: 'transform 200ms ease' };
  }, [dragState]);

  return {
    isDragging: dragState.draggingIndex !== null,
    draggingIndex: dragState.draggingIndex,
    hoverIndex: dragState.hoverIndex,
    getDragHandlers,
    getItemStyle,
  };
}
