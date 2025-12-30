import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Pencil, Eraser, Circle, Square, Triangle, Star, 
  Undo2, Redo2, Trash2, Download, Palette, Move,
  MousePointer, Minus, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HSLColorPicker } from '@/components/HSLColorPicker';

export interface DrawingPath {
  id: string;
  type: 'freehand' | 'line' | 'circle' | 'rectangle' | 'triangle' | 'star' | 'arrow';
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  opacity: number;
  filled: boolean;
  animation: DrawingAnimation | null;
}

export interface DrawingAnimation {
  type: 'draw' | 'fade' | 'pulse' | 'bounce' | 'rotate' | 'scale';
  duration: number;
  delay: number;
  loop: boolean;
}

interface DrawingCanvasProps {
  paths: DrawingPath[];
  onPathsChange: (paths: DrawingPath[]) => void;
  width: number;
  height: number;
  className?: string;
}

type Tool = 'select' | 'freehand' | 'line' | 'circle' | 'rectangle' | 'triangle' | 'star' | 'arrow' | 'eraser';

const tools: { type: Tool; icon: React.ReactNode; label: string }[] = [
  { type: 'select', icon: <MousePointer className="w-4 h-4" />, label: 'Select' },
  { type: 'freehand', icon: <Pencil className="w-4 h-4" />, label: 'Draw' },
  { type: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line' },
  { type: 'arrow', icon: <ArrowRight className="w-4 h-4" />, label: 'Arrow' },
  { type: 'circle', icon: <Circle className="w-4 h-4" />, label: 'Circle' },
  { type: 'rectangle', icon: <Square className="w-4 h-4" />, label: 'Rectangle' },
  { type: 'triangle', icon: <Triangle className="w-4 h-4" />, label: 'Triangle' },
  { type: 'star', icon: <Star className="w-4 h-4" />, label: 'Star' },
  { type: 'eraser', icon: <Eraser className="w-4 h-4" />, label: 'Eraser' },
];

const colors = [
  '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#ff00ff', '#00ffff', '#ff8000', '#8000ff',
  '#ff0080', '#00ff80', '#0080ff', '#80ff00', '#ff8080'
];

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  paths,
  onPathsChange,
  width,
  height,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState<Tool>('freehand');
  const [strokeColor, setStrokeColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [opacity, setOpacity] = useState(1);
  const [filled, setFilled] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<DrawingPath[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);

  // Render paths to canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    [...paths, currentPath].filter(Boolean).forEach(path => {
      if (!path) return;
      
      ctx.save();
      ctx.strokeStyle = path.color;
      ctx.fillStyle = path.color;
      ctx.lineWidth = path.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = path.opacity;

      if (path.type === 'freehand' && path.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
      } else if (path.type === 'line' && path.points.length === 2) {
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        ctx.lineTo(path.points[1].x, path.points[1].y);
        ctx.stroke();
      } else if (path.type === 'arrow' && path.points.length === 2) {
        const [start, end] = path.points;
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLen = 15;

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (path.type === 'circle' && path.points.length === 2) {
        const [start, end] = path.points;
        const radius = Math.hypot(end.x - start.x, end.y - start.y);
        ctx.beginPath();
        ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
        if (path.filled) ctx.fill();
        ctx.stroke();
      } else if (path.type === 'rectangle' && path.points.length === 2) {
        const [start, end] = path.points;
        const w = end.x - start.x;
        const h = end.y - start.y;
        ctx.beginPath();
        ctx.rect(start.x, start.y, w, h);
        if (path.filled) ctx.fill();
        ctx.stroke();
      } else if (path.type === 'triangle' && path.points.length === 2) {
        const [start, end] = path.points;
        const size = Math.hypot(end.x - start.x, end.y - start.y);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y - size);
        ctx.lineTo(start.x - size * 0.866, start.y + size * 0.5);
        ctx.lineTo(start.x + size * 0.866, start.y + size * 0.5);
        ctx.closePath();
        if (path.filled) ctx.fill();
        ctx.stroke();
      } else if (path.type === 'star' && path.points.length === 2) {
        const [start, end] = path.points;
        const outerRadius = Math.hypot(end.x - start.x, end.y - start.y);
        const innerRadius = outerRadius * 0.4;
        const spikes = 5;
        
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (i * Math.PI) / spikes - Math.PI / 2;
          const x = start.x + radius * Math.cos(angle);
          const y = start.y + radius * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        if (path.filled) ctx.fill();
        ctx.stroke();
      }

      // Highlight selected
      if (path.id === selectedPathId) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
          Math.min(...path.points.map(p => p.x)) - 5,
          Math.min(...path.points.map(p => p.y)) - 5,
          Math.max(...path.points.map(p => p.x)) - Math.min(...path.points.map(p => p.x)) + 10,
          Math.max(...path.points.map(p => p.y)) - Math.min(...path.points.map(p => p.y)) + 10
        );
        ctx.setLineDash([]);
      }

      ctx.restore();
    });
  }, [paths, currentPath, width, height, selectedPathId]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const point = getCanvasPoint(e);
    
    if (activeTool === 'select') {
      // Find clicked path
      const clickedPath = paths.find(path => {
        const minX = Math.min(...path.points.map(p => p.x)) - 10;
        const maxX = Math.max(...path.points.map(p => p.x)) + 10;
        const minY = Math.min(...path.points.map(p => p.y)) - 10;
        const maxY = Math.max(...path.points.map(p => p.y)) + 10;
        return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
      });
      setSelectedPathId(clickedPath?.id || null);
      return;
    }

    if (activeTool === 'eraser') {
      // Find and remove path under cursor
      const newPaths = paths.filter(path => {
        return !path.points.some(p => Math.hypot(p.x - point.x, p.y - point.y) < 20);
      });
      if (newPaths.length !== paths.length) {
        onPathsChange(newPaths);
        addToHistory(newPaths);
      }
      return;
    }

    setIsDrawing(true);
    setStartPoint(point);
    
    const newPath: DrawingPath = {
      id: `path-${Date.now()}`,
      type: activeTool === 'freehand' ? 'freehand' : activeTool as DrawingPath['type'],
      points: [point],
      color: strokeColor,
      strokeWidth,
      opacity,
      filled,
      animation: null,
    };
    
    setCurrentPath(newPath);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentPath || !startPoint) return;
    
    const point = getCanvasPoint(e);

    if (activeTool === 'freehand') {
      setCurrentPath({
        ...currentPath,
        points: [...currentPath.points, point],
      });
    } else {
      setCurrentPath({
        ...currentPath,
        points: [startPoint, point],
      });
    }
  };

  const handleEnd = () => {
    if (!isDrawing || !currentPath) return;
    
    setIsDrawing(false);
    setStartPoint(null);
    
    const newPaths = [...paths, currentPath];
    onPathsChange(newPaths);
    addToHistory(newPaths);
    setCurrentPath(null);
  };

  const addToHistory = (newPaths: DrawingPath[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newPaths);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      onPathsChange(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      onPathsChange(history[historyIndex + 1]);
    }
  };

  const handleClear = () => {
    onPathsChange([]);
    addToHistory([]);
    setSelectedPathId(null);
  };

  const handleDeleteSelected = () => {
    if (!selectedPathId) return;
    const newPaths = paths.filter(p => p.id !== selectedPathId);
    onPathsChange(newPaths);
    addToHistory(newPaths);
    setSelectedPathId(null);
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-background/90 backdrop-blur-sm border-b border-border/50">
        <div className="flex gap-1">
          {tools.map(tool => (
            <Button
              key={tool.type}
              variant={activeTool === tool.type ? 'default' : 'ghost'}
              size="icon"
              className="w-8 h-8"
              onClick={() => setActiveTool(tool.type)}
              title={tool.label}
            >
              {tool.icon}
            </Button>
          ))}
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Color Selection */}
        <div className="flex gap-1">
          {colors.slice(0, 5).map(color => (
            <button
              key={color}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-transform",
                strokeColor === color ? "border-primary scale-110" : "border-transparent"
              )}
              style={{ backgroundColor: color }}
              onClick={() => setStrokeColor(color)}
            />
          ))}
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6"
            onClick={() => setShowColorPicker(true)}
          >
            <Palette className="w-4 h-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Stroke Width */}
        <div className="flex items-center gap-2 w-24">
          <Slider
            value={[strokeWidth]}
            onValueChange={([v]) => setStrokeWidth(v)}
            min={1}
            max={20}
            step={1}
          />
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Actions */}
        <Button variant="ghost" size="icon" className="w-8 h-8" onClick={handleUndo} disabled={historyIndex === 0}>
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="w-8 h-8" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
          <Redo2 className="w-4 h-4" />
        </Button>
        
        {selectedPathId && (
          <Button variant="destructive" size="icon" className="w-8 h-8" onClick={handleDeleteSelected}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        
        <Button variant="ghost" size="icon" className="w-8 h-8" onClick={handleClear}>
          <Trash2 className="w-4 h-4" />
        </Button>

        <Button
          variant={filled ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilled(!filled)}
        >
          {filled ? 'Filled' : 'Outline'}
        </Button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="cursor-crosshair touch-none"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />

      {/* Color Picker Modal */}
      {showColorPicker && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="space-y-3">
              <label className="text-sm text-muted-foreground">Select Color</label>
              <input
                type="color"
                className="w-full h-12 rounded cursor-pointer"
                defaultValue={strokeColor}
                onChange={(e) => {
                  setStrokeColor(e.target.value);
                  setShowColorPicker(false);
                }}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => setShowColorPicker(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrawingCanvas;
