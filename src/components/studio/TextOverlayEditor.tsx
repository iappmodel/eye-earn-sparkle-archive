import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Type, Pencil, Wand2, X, Eye, EyeOff, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TextDesigner, TextElement, TextAnimation } from './TextDesigner';
import { DrawingCanvas, DrawingPath } from './DrawingCanvas';
import { AITextGenerator } from './AITextGenerator';

interface TextOverlayEditorProps {
  mediaUrl?: string;
  mediaType?: 'video' | 'image';
  onSave?: (elements: TextElement[], drawings: DrawingPath[]) => void;
  className?: string;
}

export const TextOverlayEditor: React.FC<TextOverlayEditorProps> = ({
  mediaUrl,
  mediaType = 'image',
  onSave,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 400, height: 600 });
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [drawingPaths, setDrawingPaths] = useState<DrawingPath[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'text' | 'draw' | 'ai'>('text');
  const [showOverlays, setShowOverlays] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleAddTextElement = (element: TextElement) => {
    setTextElements(prev => [...prev, element]);
    setSelectedTextId(element.id);
  };

  const handleUpdateTextElement = (id: string, updates: Partial<TextElement>) => {
    setTextElements(prev => prev.map(el => 
      el.id === id ? { ...el, ...updates } : el
    ));
  };

  const handleDeleteTextElement = (id: string) => {
    setTextElements(prev => prev.filter(el => el.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
  };

  const handleDuplicateTextElement = (id: string) => {
    const element = textElements.find(el => el.id === id);
    if (!element) return;
    
    const newElement: TextElement = {
      ...element,
      id: `text-${Date.now()}`,
      x: element.x + 10,
      y: element.y + 10,
    };
    
    setTextElements(prev => [...prev, newElement]);
    setSelectedTextId(newElement.id);
  };

  const handleApplyAIStyle = (style: Partial<TextElement>) => {
    if (!selectedTextId) {
      // Create new element with style
      const element: TextElement = {
        id: `text-${Date.now()}`,
        text: 'New Text',
        x: 50,
        y: 50,
        fontSize: 32,
        fontFamily: style.fontFamily || 'Inter',
        color: style.color || '#ffffff',
        rotation: 0,
        opacity: 1,
        bold: style.bold || false,
        italic: style.italic || false,
        underline: false,
        textAlign: 'center',
        animation: style.animation || null,
        shadowColor: style.shadowColor || '#000000',
        shadowBlur: style.shadowBlur || 0,
        strokeColor: style.strokeColor || '#000000',
        strokeWidth: style.strokeWidth || 0,
        gradient: style.gradient || null,
      };
      handleAddTextElement(element);
    } else {
      handleUpdateTextElement(selectedTextId, style);
    }
  };

  // Handle text element dragging
  const handleTextMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    const element = textElements.find(el => el.id === elementId);
    if (!element) return;

    setSelectedTextId(elementId);
    setIsDragging(true);
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - (rect.left + (element.x / 100) * rect.width),
        y: e.clientY - (rect.top + (element.y / 100) * rect.height),
      });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !selectedTextId || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100;
    const y = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100;

    handleUpdateTextElement(selectedTextId, {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  }, [isDragging, selectedTextId, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Video playback
  const togglePlayback = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Get animation CSS
  const getAnimationStyle = (animation: TextAnimation | null): React.CSSProperties => {
    if (!animation) return {};

    const animationName = {
      fade: 'fadeIn',
      bounce: 'bounce',
      slide: 'slideInLeft',
      pulse: 'pulse',
      typewriter: 'typewriter',
      wave: 'wave',
      glow: 'glow',
      shake: 'shake',
      zoom: 'zoomIn',
      rotate: 'rotate360',
    }[animation.type];

    return {
      animation: `${animationName} ${animation.duration}s ${animation.loop ? 'infinite' : 'forwards'}`,
      animationDelay: `${animation.delay}s`,
    };
  };

  const handleSave = () => {
    onSave?.(textElements, drawingPaths);
  };

  return (
    <div className={cn("flex h-full", className)}>
      {/* Preview Area */}
      <div className="flex-1 relative bg-black/90 overflow-hidden">
        {/* Media Background */}
        <div 
          ref={containerRef}
          className="absolute inset-0 flex items-center justify-center"
          onClick={() => setSelectedTextId(null)}
        >
          {mediaUrl ? (
            mediaType === 'video' ? (
              <video
                ref={videoRef}
                src={mediaUrl}
                className="max-w-full max-h-full object-contain"
                loop
                muted
                playsInline
              />
            ) : (
              <img
                src={mediaUrl}
                alt="Media preview"
                className="max-w-full max-h-full object-contain"
              />
            )
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20" />
          )}

          {/* Text Overlays */}
          {showOverlays && textElements.map(element => (
            <div
              key={element.id}
              className={cn(
                "absolute cursor-move select-none transition-shadow",
                selectedTextId === element.id && "ring-2 ring-primary ring-offset-2 ring-offset-transparent"
              )}
              style={{
                left: `${element.x}%`,
                top: `${element.y}%`,
                transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
                opacity: element.opacity,
                ...getAnimationStyle(element.animation),
              }}
              onMouseDown={(e) => handleTextMouseDown(e, element.id)}
            >
              <span
                style={{
                  fontFamily: element.fontFamily,
                  fontSize: `${element.fontSize}px`,
                  color: element.gradient ? 'transparent' : element.color,
                  background: element.gradient 
                    ? `linear-gradient(135deg, ${element.gradient.from}, ${element.gradient.to})`
                    : 'none',
                  WebkitBackgroundClip: element.gradient ? 'text' : 'unset',
                  backgroundClip: element.gradient ? 'text' : 'unset',
                  fontWeight: element.bold ? 'bold' : 'normal',
                  fontStyle: element.italic ? 'italic' : 'normal',
                  textDecoration: element.underline ? 'underline' : 'none',
                  textAlign: element.textAlign,
                  textShadow: element.shadowBlur > 0 
                    ? `0 0 ${element.shadowBlur}px ${element.shadowColor}` 
                    : 'none',
                  WebkitTextStroke: element.strokeWidth > 0 
                    ? `${element.strokeWidth}px ${element.strokeColor}` 
                    : 'none',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {element.text}
              </span>
            </div>
          ))}

          {/* Drawing Overlay */}
          {showOverlays && activeTab === 'draw' && (
            <div className="absolute inset-0">
              <DrawingCanvas
                paths={drawingPaths}
                onPathsChange={setDrawingPaths}
                width={containerSize.width}
                height={containerSize.height}
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setShowOverlays(!showOverlays)}
            >
              {showOverlays ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
            {mediaType === 'video' && (
              <Button
                variant="secondary"
                size="icon"
                onClick={togglePlayback}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
            )}
          </div>
          
          <Button onClick={handleSave}>
            Save Overlays
          </Button>
        </div>
      </div>

      {/* Editor Panel */}
      <div className="w-80 border-l border-border bg-background/95 backdrop-blur-sm">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="h-full flex flex-col">
          <TabsList className="mx-3 mt-3">
            <TabsTrigger value="text" className="flex-1">
              <Type className="w-4 h-4 mr-1" />
              Text
            </TabsTrigger>
            <TabsTrigger value="draw" className="flex-1">
              <Pencil className="w-4 h-4 mr-1" />
              Draw
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex-1">
              <Wand2 className="w-4 h-4 mr-1" />
              AI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="flex-1 mt-0 p-0">
            <TextDesigner
              elements={textElements}
              selectedElementId={selectedTextId}
              onAddElement={handleAddTextElement}
              onUpdateElement={handleUpdateTextElement}
              onDeleteElement={handleDeleteTextElement}
              onSelectElement={setSelectedTextId}
              onDuplicateElement={handleDuplicateTextElement}
            />
          </TabsContent>

          <TabsContent value="draw" className="flex-1 mt-0 p-3">
            <div className="text-center text-sm text-muted-foreground">
              <Pencil className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Draw directly on the preview area</p>
              <p className="text-xs mt-1">Use the toolbar at the top of the canvas</p>
            </div>
          </TabsContent>

          <TabsContent value="ai" className="flex-1 mt-0 p-0">
            <AITextGenerator
              onApplyStyle={handleApplyAIStyle}
              selectedText={textElements.find(el => el.id === selectedTextId)?.text}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Animation Keyframes */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translate(-150%, -50%); }
          to { transform: translate(-50%, -50%); }
        }
        @keyframes wave {
          0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
          25% { transform: translate(-50%, -50%) rotate(-5deg); }
          75% { transform: translate(-50%, -50%) rotate(5deg); }
        }
        @keyframes glow {
          0%, 100% { filter: drop-shadow(0 0 5px currentColor); }
          50% { filter: drop-shadow(0 0 20px currentColor); }
        }
        @keyframes shake {
          0%, 100% { transform: translate(-50%, -50%); }
          10%, 30%, 50%, 70%, 90% { transform: translate(-52%, -50%); }
          20%, 40%, 60%, 80% { transform: translate(-48%, -50%); }
        }
        @keyframes zoomIn {
          from { transform: translate(-50%, -50%) scale(0); }
          to { transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes rotate360 {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes typewriter {
          from { width: 0; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default TextOverlayEditor;
