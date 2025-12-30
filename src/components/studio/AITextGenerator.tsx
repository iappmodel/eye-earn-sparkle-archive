import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wand2, Loader2, Sparkles, Copy, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TextElement } from './TextDesigner';

interface AITextGeneratorProps {
  onApplyStyle: (style: Partial<TextElement>) => void;
  selectedText?: string;
}

interface GeneratedStyle {
  fontFamily: string;
  color: string;
  gradient?: { from: string; to: string };
  shadowBlur: number;
  shadowColor: string;
  strokeWidth: number;
  strokeColor: string;
  bold: boolean;
  italic: boolean;
  animation?: {
    type: 'fade' | 'bounce' | 'slide' | 'pulse' | 'typewriter' | 'wave' | 'glow' | 'shake' | 'zoom' | 'rotate';
    duration: number;
    loop: boolean;
  };
  description: string;
}

const presetPrompts = [
  { label: '🔥 Fire & Bold', prompt: 'fiery, burning, bold red and orange gradient, glowing edges' },
  { label: '❄️ Ice & Frost', prompt: 'frozen, icy blue, crystal clear, subtle shimmer, cold metallic' },
  { label: '🌈 Rainbow Pop', prompt: 'colorful rainbow gradient, playful, bouncy animation, fun' },
  { label: '✨ Elegant Gold', prompt: 'luxury gold, elegant serif font, subtle glow, sophisticated' },
  { label: '🎮 Retro Gaming', prompt: 'pixel art style, neon green on black, glitchy, 80s arcade' },
  { label: '🌸 Soft Pastel', prompt: 'soft pastel pink and lavender, gentle, romantic, cursive' },
  { label: '⚡ Electric Neon', prompt: 'bright neon colors, electric glow, pulsing animation, cyberpunk' },
  { label: '🌿 Nature Organic', prompt: 'earthy green, natural texture, organic flowing, calm' },
];

export const AITextGenerator: React.FC<AITextGeneratorProps> = ({
  onApplyStyle,
  selectedText,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStyles, setGeneratedStyles] = useState<GeneratedStyle[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const generateStyles = async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt.trim()) {
      toast.error('Please enter a description for your text style');
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-text-style', {
        body: { 
          prompt: finalPrompt,
          text: selectedText || 'Sample Text'
        }
      });

      if (error) throw error;

      if (data?.styles) {
        setGeneratedStyles(data.styles);
      }
    } catch (error) {
      console.error('Error generating styles:', error);
      toast.error('Failed to generate styles. Please try again.');
      
      // Fallback to mock styles for demo
      setGeneratedStyles([
        {
          fontFamily: 'Bebas Neue',
          color: '#ff6b35',
          gradient: { from: '#ff6b35', to: '#f7931e' },
          shadowBlur: 10,
          shadowColor: '#ff0000',
          strokeWidth: 2,
          strokeColor: '#000000',
          bold: true,
          italic: false,
          animation: { type: 'glow', duration: 1.5, loop: true },
          description: 'Bold and fiery with glowing edges'
        },
        {
          fontFamily: 'Montserrat',
          color: '#ffffff',
          gradient: { from: '#667eea', to: '#764ba2' },
          shadowBlur: 20,
          shadowColor: '#764ba2',
          strokeWidth: 0,
          strokeColor: '#000000',
          bold: false,
          italic: false,
          animation: { type: 'pulse', duration: 2, loop: true },
          description: 'Elegant purple gradient with soft glow'
        },
        {
          fontFamily: 'Press Start 2P',
          color: '#00ff00',
          shadowBlur: 5,
          shadowColor: '#00ff00',
          strokeWidth: 1,
          strokeColor: '#003300',
          bold: false,
          italic: false,
          animation: { type: 'shake', duration: 0.5, loop: true },
          description: 'Retro gaming style with glitch effect'
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyStyle = (style: GeneratedStyle) => {
    const textStyle: Partial<TextElement> = {
      fontFamily: style.fontFamily,
      color: style.color,
      gradient: style.gradient || null,
      shadowBlur: style.shadowBlur,
      shadowColor: style.shadowColor,
      strokeWidth: style.strokeWidth,
      strokeColor: style.strokeColor,
      bold: style.bold,
      italic: style.italic,
      animation: style.animation ? {
        ...style.animation,
        delay: 0
      } : null,
    };
    
    onApplyStyle(textStyle);
    toast.success('Style applied!');
  };

  const handleCopyStyle = (style: GeneratedStyle, index: number) => {
    navigator.clipboard.writeText(JSON.stringify(style, null, 2));
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-background/95 backdrop-blur-sm rounded-lg border border-border/50">
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <Wand2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">AI Text Style Generator</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Describe how you want your text to look, and AI will generate unique styles for you
        </p>
      </div>

      <div className="p-3 space-y-3">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your desired text style... (e.g., 'glowing neon blue with electric animation')"
          className="min-h-[80px]"
        />

        <Button
          onClick={() => generateStyles()}
          disabled={isGenerating || !prompt.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Styles
            </>
          )}
        </Button>

        {/* Preset Prompts */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Quick Presets</label>
          <div className="flex flex-wrap gap-1">
            {presetPrompts.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setPrompt(preset.prompt);
                  generateStyles(preset.prompt);
                }}
                disabled={isGenerating}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Generated Styles */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {generatedStyles.map((style, index) => (
            <div
              key={index}
              className="p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-card transition-colors"
            >
              {/* Style Preview */}
              <div 
                className="py-4 px-3 mb-3 rounded bg-black/50 flex items-center justify-center overflow-hidden"
                style={{
                  minHeight: '60px',
                }}
              >
                <span
                  style={{
                    fontFamily: style.fontFamily,
                    fontSize: '24px',
                    color: style.gradient ? 'transparent' : style.color,
                    background: style.gradient 
                      ? `linear-gradient(135deg, ${style.gradient.from}, ${style.gradient.to})`
                      : 'none',
                    WebkitBackgroundClip: style.gradient ? 'text' : 'unset',
                    backgroundClip: style.gradient ? 'text' : 'unset',
                    fontWeight: style.bold ? 'bold' : 'normal',
                    fontStyle: style.italic ? 'italic' : 'normal',
                    textShadow: style.shadowBlur > 0 
                      ? `0 0 ${style.shadowBlur}px ${style.shadowColor}` 
                      : 'none',
                    WebkitTextStroke: style.strokeWidth > 0 
                      ? `${style.strokeWidth}px ${style.strokeColor}` 
                      : 'none',
                  }}
                  className={cn(
                    style.animation?.type === 'pulse' && 'animate-pulse',
                    style.animation?.type === 'bounce' && 'animate-bounce',
                  )}
                >
                  {selectedText || 'Sample Text'}
                </span>
              </div>

              {/* Style Description */}
              <p className="text-sm text-muted-foreground mb-3">
                {style.description}
              </p>

              {/* Style Details */}
              <div className="flex flex-wrap gap-1 mb-3">
                <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
                  {style.fontFamily}
                </span>
                {style.animation && (
                  <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {style.animation.type}
                  </span>
                )}
                {style.gradient && (
                  <span className="text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground">
                    gradient
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleApplyStyle(style)}
                >
                  Apply Style
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => handleCopyStyle(style, index)}
                >
                  {copiedIndex === index ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}

          {generatedStyles.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => generateStyles()}
              disabled={isGenerating}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate More
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default AITextGenerator;
