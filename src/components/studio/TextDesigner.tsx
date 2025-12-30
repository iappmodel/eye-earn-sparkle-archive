import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Type, Palette, Sparkles, Move, RotateCw, 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Wand2, Play, Pause, Trash2, Copy, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HSLColorPicker } from '@/components/HSLColorPicker';

export interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  rotation: number;
  opacity: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textAlign: 'left' | 'center' | 'right';
  animation: TextAnimation | null;
  shadowColor: string;
  shadowBlur: number;
  strokeColor: string;
  strokeWidth: number;
  gradient: { from: string; to: string } | null;
}

export interface TextAnimation {
  type: 'fade' | 'bounce' | 'slide' | 'pulse' | 'typewriter' | 'wave' | 'glow' | 'shake' | 'zoom' | 'rotate';
  duration: number;
  delay: number;
  loop: boolean;
}

interface TextDesignerProps {
  elements: TextElement[];
  selectedElementId: string | null;
  onAddElement: (element: TextElement) => void;
  onUpdateElement: (id: string, updates: Partial<TextElement>) => void;
  onDeleteElement: (id: string) => void;
  onSelectElement: (id: string | null) => void;
  onDuplicateElement: (id: string) => void;
}

const fontFamilies = [
  'Inter', 'Roboto', 'Playfair Display', 'Montserrat', 'Oswald',
  'Bebas Neue', 'Pacifico', 'Lobster', 'Dancing Script', 'Permanent Marker',
  'Anton', 'Righteous', 'Bangers', 'Fredoka One', 'Press Start 2P'
];

const animations: { type: TextAnimation['type']; label: string; icon: string }[] = [
  { type: 'fade', label: 'Fade In', icon: '✨' },
  { type: 'bounce', label: 'Bounce', icon: '⬆️' },
  { type: 'slide', label: 'Slide In', icon: '➡️' },
  { type: 'pulse', label: 'Pulse', icon: '💓' },
  { type: 'typewriter', label: 'Typewriter', icon: '⌨️' },
  { type: 'wave', label: 'Wave', icon: '🌊' },
  { type: 'glow', label: 'Glow', icon: '💡' },
  { type: 'shake', label: 'Shake', icon: '📳' },
  { type: 'zoom', label: 'Zoom', icon: '🔍' },
  { type: 'rotate', label: 'Rotate', icon: '🔄' },
];

export const TextDesigner: React.FC<TextDesignerProps> = ({
  elements,
  selectedElementId,
  onAddElement,
  onUpdateElement,
  onDeleteElement,
  onSelectElement,
  onDuplicateElement,
}) => {
  const [newText, setNewText] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerType, setColorPickerType] = useState<'text' | 'shadow' | 'stroke' | 'gradient-from' | 'gradient-to'>('text');

  const selectedElement = elements.find(el => el.id === selectedElementId);

  const handleAddText = () => {
    if (!newText.trim()) return;
    
    const element: TextElement = {
      id: `text-${Date.now()}`,
      text: newText,
      x: 50,
      y: 50,
      fontSize: 32,
      fontFamily: 'Inter',
      color: '#ffffff',
      rotation: 0,
      opacity: 1,
      bold: false,
      italic: false,
      underline: false,
      textAlign: 'center',
      animation: null,
      shadowColor: '#000000',
      shadowBlur: 0,
      strokeColor: '#000000',
      strokeWidth: 0,
      gradient: null,
    };
    
    onAddElement(element);
    setNewText('');
  };

  const handleColorSelect = (color: string) => {
    if (!selectedElement) return;
    
    switch (colorPickerType) {
      case 'text':
        onUpdateElement(selectedElement.id, { color, gradient: null });
        break;
      case 'shadow':
        onUpdateElement(selectedElement.id, { shadowColor: color });
        break;
      case 'stroke':
        onUpdateElement(selectedElement.id, { strokeColor: color });
        break;
      case 'gradient-from':
        onUpdateElement(selectedElement.id, { 
          gradient: { from: color, to: selectedElement.gradient?.to || '#ffffff' } 
        });
        break;
      case 'gradient-to':
        onUpdateElement(selectedElement.id, { 
          gradient: { from: selectedElement.gradient?.from || '#ffffff', to: color } 
        });
        break;
    }
    setShowColorPicker(false);
  };

  const openColorPicker = (type: typeof colorPickerType) => {
    setColorPickerType(type);
    setShowColorPicker(true);
  };

  return (
    <div className="flex flex-col h-full bg-background/95 backdrop-blur-sm rounded-lg border border-border/50">
      <div className="p-3 border-b border-border/50">
        <div className="flex gap-2">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Enter text..."
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleAddText()}
          />
          <Button onClick={handleAddText} size="sm">
            <Type className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {selectedElement ? (
        <Tabs defaultValue="style" className="flex-1 flex flex-col">
          <TabsList className="mx-3 mt-2">
            <TabsTrigger value="style" className="flex-1">Style</TabsTrigger>
            <TabsTrigger value="effects" className="flex-1">Effects</TabsTrigger>
            <TabsTrigger value="animate" className="flex-1">Animate</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 p-3">
            <TabsContent value="style" className="mt-0 space-y-4">
              {/* Text Content */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Text</label>
                <Input
                  value={selectedElement.text}
                  onChange={(e) => onUpdateElement(selectedElement.id, { text: e.target.value })}
                />
              </div>

              {/* Font Family */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Font</label>
                <ScrollArea className="h-24">
                  <div className="flex flex-wrap gap-1">
                    {fontFamilies.map(font => (
                      <Button
                        key={font}
                        variant={selectedElement.fontFamily === font ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs"
                        style={{ fontFamily: font }}
                        onClick={() => onUpdateElement(selectedElement.id, { fontFamily: font })}
                      >
                        {font}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Font Size */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Size: {selectedElement.fontSize}px
                </label>
                <Slider
                  value={[selectedElement.fontSize]}
                  onValueChange={([v]) => onUpdateElement(selectedElement.id, { fontSize: v })}
                  min={8}
                  max={200}
                  step={1}
                />
              </div>

              {/* Text Formatting */}
              <div className="flex gap-2">
                <Button
                  variant={selectedElement.bold ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => onUpdateElement(selectedElement.id, { bold: !selectedElement.bold })}
                >
                  <Bold className="w-4 h-4" />
                </Button>
                <Button
                  variant={selectedElement.italic ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => onUpdateElement(selectedElement.id, { italic: !selectedElement.italic })}
                >
                  <Italic className="w-4 h-4" />
                </Button>
                <Button
                  variant={selectedElement.underline ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => onUpdateElement(selectedElement.id, { underline: !selectedElement.underline })}
                >
                  <Underline className="w-4 h-4" />
                </Button>
                <div className="w-px bg-border mx-1" />
                <Button
                  variant={selectedElement.textAlign === 'left' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => onUpdateElement(selectedElement.id, { textAlign: 'left' })}
                >
                  <AlignLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant={selectedElement.textAlign === 'center' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => onUpdateElement(selectedElement.id, { textAlign: 'center' })}
                >
                  <AlignCenter className="w-4 h-4" />
                </Button>
                <Button
                  variant={selectedElement.textAlign === 'right' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => onUpdateElement(selectedElement.id, { textAlign: 'right' })}
                >
                  <AlignRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Color */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Color</label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 justify-start"
                    onClick={() => openColorPicker('text')}
                  >
                    <div 
                      className="w-4 h-4 rounded mr-2 border"
                      style={{ backgroundColor: selectedElement.color }}
                    />
                    Solid Color
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => openColorPicker('gradient-from')}
                  >
                    <Palette className="w-4 h-4 mr-1" />
                    Gradient
                  </Button>
                </div>
              </div>

              {/* Rotation */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Rotation: {selectedElement.rotation}°
                </label>
                <Slider
                  value={[selectedElement.rotation]}
                  onValueChange={([v]) => onUpdateElement(selectedElement.id, { rotation: v })}
                  min={-180}
                  max={180}
                  step={1}
                />
              </div>

              {/* Opacity */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Opacity: {Math.round(selectedElement.opacity * 100)}%
                </label>
                <Slider
                  value={[selectedElement.opacity * 100]}
                  onValueChange={([v]) => onUpdateElement(selectedElement.id, { opacity: v / 100 })}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </TabsContent>

            <TabsContent value="effects" className="mt-0 space-y-4">
              {/* Shadow */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Shadow Blur: {selectedElement.shadowBlur}px
                </label>
                <Slider
                  value={[selectedElement.shadowBlur]}
                  onValueChange={([v]) => onUpdateElement(selectedElement.id, { shadowBlur: v })}
                  min={0}
                  max={50}
                  step={1}
                />
                {selectedElement.shadowBlur > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => openColorPicker('shadow')}
                  >
                    <div 
                      className="w-4 h-4 rounded mr-2 border"
                      style={{ backgroundColor: selectedElement.shadowColor }}
                    />
                    Shadow Color
                  </Button>
                )}
              </div>

              {/* Stroke */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Stroke Width: {selectedElement.strokeWidth}px
                </label>
                <Slider
                  value={[selectedElement.strokeWidth]}
                  onValueChange={([v]) => onUpdateElement(selectedElement.id, { strokeWidth: v })}
                  min={0}
                  max={10}
                  step={0.5}
                />
                {selectedElement.strokeWidth > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => openColorPicker('stroke')}
                  >
                    <div 
                      className="w-4 h-4 rounded mr-2 border"
                      style={{ backgroundColor: selectedElement.strokeColor }}
                    />
                    Stroke Color
                  </Button>
                )}
              </div>

              {/* Gradient */}
              {selectedElement.gradient && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Gradient Colors</label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openColorPicker('gradient-from')}
                    >
                      <div 
                        className="w-4 h-4 rounded mr-2 border"
                        style={{ backgroundColor: selectedElement.gradient.from }}
                      />
                      From
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openColorPicker('gradient-to')}
                    >
                      <div 
                        className="w-4 h-4 rounded mr-2 border"
                        style={{ backgroundColor: selectedElement.gradient.to }}
                      />
                      To
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onUpdateElement(selectedElement.id, { gradient: null })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="animate" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {animations.map(anim => (
                  <Button
                    key={anim.type}
                    variant={selectedElement.animation?.type === anim.type ? 'default' : 'outline'}
                    size="sm"
                    className="justify-start"
                    onClick={() => onUpdateElement(selectedElement.id, { 
                      animation: selectedElement.animation?.type === anim.type 
                        ? null 
                        : { type: anim.type, duration: 1, delay: 0, loop: false }
                    })}
                  >
                    <span className="mr-2">{anim.icon}</span>
                    {anim.label}
                  </Button>
                ))}
              </div>

              {selectedElement.animation && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Duration: {selectedElement.animation.duration}s
                    </label>
                    <Slider
                      value={[selectedElement.animation.duration]}
                      onValueChange={([v]) => onUpdateElement(selectedElement.id, { 
                        animation: { ...selectedElement.animation!, duration: v }
                      })}
                      min={0.1}
                      max={5}
                      step={0.1}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Delay: {selectedElement.animation.delay}s
                    </label>
                    <Slider
                      value={[selectedElement.animation.delay]}
                      onValueChange={([v]) => onUpdateElement(selectedElement.id, { 
                        animation: { ...selectedElement.animation!, delay: v }
                      })}
                      min={0}
                      max={5}
                      step={0.1}
                    />
                  </div>

                  <Button
                    variant={selectedElement.animation.loop ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onUpdateElement(selectedElement.id, { 
                      animation: { ...selectedElement.animation!, loop: !selectedElement.animation!.loop }
                    })}
                  >
                    {selectedElement.animation.loop ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                    {selectedElement.animation.loop ? 'Loop On' : 'Loop Off'}
                  </Button>
                </>
              )}
            </TabsContent>
          </ScrollArea>

          {/* Element Actions */}
          <div className="p-3 border-t border-border/50 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onDuplicateElement(selectedElement.id)}
            >
              <Copy className="w-4 h-4 mr-1" />
              Duplicate
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={() => onDeleteElement(selectedElement.id)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        </Tabs>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <Layers className="w-12 h-12 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Add text above or select an existing element to edit
          </p>

          {/* Elements List */}
          {elements.length > 0 && (
            <div className="w-full mt-4">
              <label className="text-xs text-muted-foreground mb-2 block">Elements</label>
              <div className="space-y-1">
                {elements.map(el => (
                  <Button
                    key={el.id}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start truncate"
                    onClick={() => onSelectElement(el.id)}
                  >
                    <Type className="w-4 h-4 mr-2 shrink-0" />
                    <span className="truncate">{el.text}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Color Picker Modal */}
      {showColorPicker && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="space-y-3">
              <label className="text-sm text-muted-foreground">Select Color</label>
              <input
                type="color"
                className="w-full h-12 rounded cursor-pointer"
                defaultValue={
                  colorPickerType === 'text' ? selectedElement?.color || '#ffffff' :
                  colorPickerType === 'shadow' ? selectedElement?.shadowColor || '#000000' :
                  colorPickerType === 'stroke' ? selectedElement?.strokeColor || '#000000' :
                  colorPickerType === 'gradient-from' ? selectedElement?.gradient?.from || '#ffffff' :
                  selectedElement?.gradient?.to || '#ffffff'
                }
                onChange={(e) => handleColorSelect(e.target.value)}
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

export default TextDesigner;
