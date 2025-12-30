import React, { useState } from 'react';
import { 
  Sparkles, Wand2, Volume2, VolumeX, Shirt, Glasses, 
  Palette, Send, Loader2, Undo2, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { IMoji, IMojiStyle, IMojiTone, IMojiType, IMOJI_STYLES, IMOJI_TONES } from './types';
import { StyleSelector } from './StyleSelector';
import { ToneSelector } from './ToneSelector';
import { toast } from 'sonner';

interface IMojiEditorProps {
  imoji?: IMoji;
  faceImageUrl: string;
  onSave: (imoji: Partial<IMoji>) => void;
  onGenerate: (prompt: string) => Promise<void>;
  isGenerating: boolean;
}

export const IMojiEditor: React.FC<IMojiEditorProps> = ({
  imoji,
  faceImageUrl,
  onSave,
  onGenerate,
  isGenerating
}) => {
  const [name, setName] = useState(imoji?.name || 'My iMoji');
  const [style, setStyle] = useState<IMojiStyle>(imoji?.style || 'cartoon');
  const [tone, setTone] = useState<IMojiTone>(imoji?.tone || 'happy');
  const [type, setType] = useState<IMojiType>(imoji?.type || 'static');
  const [customPrompt, setCustomPrompt] = useState(imoji?.customPrompt || '');
  const [clothing, setClothing] = useState(imoji?.clothing || '');
  const [accessories, setAccessories] = useState(imoji?.accessories || '');
  const [hasSound, setHasSound] = useState(imoji?.hasSound || false);
  const [soundPrompt, setSoundPrompt] = useState('');
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(imoji?.generatedUrl || null);
  const [activeTab, setActiveTab] = useState('style');

  const buildPrompt = () => {
    const styleInfo = IMOJI_STYLES.find(s => s.id === style);
    const toneInfo = IMOJI_TONES.find(t => t.id === tone);
    
    let prompt = `Create a ${styleInfo?.name.toLowerCase()} style emoji of a person with a ${toneInfo?.name.toLowerCase()} ${toneInfo?.emoji} expression`;
    
    if (clothing) {
      prompt += `, wearing ${clothing}`;
    }
    
    if (accessories) {
      prompt += `, with ${accessories}`;
    }
    
    if (customPrompt) {
      prompt += `. Additional details: ${customPrompt}`;
    }
    
    if (type === 'animated') {
      prompt += '. Make it animated like a GIF with subtle movement.';
    }
    
    return prompt;
  };

  const handleGenerate = async () => {
    const prompt = buildPrompt();
    try {
      await onGenerate(prompt);
    } catch (error) {
      console.error('Generation error:', error);
    }
  };

  const handleQuickEdit = (editPrompt: string) => {
    setCustomPrompt(prev => prev ? `${prev}. ${editPrompt}` : editPrompt);
    toast.info('Prompt updated', { description: 'Click Generate to apply changes' });
  };

  const quickEdits = [
    { label: 'Add Santa hat 🎅', prompt: 'wearing a Santa Claus hat' },
    { label: 'Add sunglasses 😎', prompt: 'wearing cool sunglasses' },
    { label: 'Add crown 👑', prompt: 'wearing a golden crown' },
    { label: 'Add party hat 🎉', prompt: 'wearing a colorful party hat' },
    { label: 'Add headphones 🎧', prompt: 'wearing stylish headphones' },
    { label: 'Add flower crown 🌸', prompt: 'wearing a beautiful flower crown' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Preview Area */}
      <div className="relative bg-muted/50 rounded-xl p-6 mb-4">
        <div className="flex items-center justify-center gap-4">
          {/* Original face */}
          <div className="text-center">
            <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-border">
              <img 
                src={faceImageUrl} 
                alt="Your face" 
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">Original</span>
          </div>
          
          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          
          {/* Generated preview */}
          <div className="text-center">
            <div className={cn(
              "w-24 h-24 rounded-xl overflow-hidden border-2 flex items-center justify-center",
              generatedPreview ? "border-primary" : "border-dashed border-border"
            )}>
              {isGenerating ? (
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              ) : generatedPreview ? (
                <img 
                  src={generatedPreview} 
                  alt="iMoji preview" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <Wand2 className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">iMoji</span>
          </div>
        </div>
        
        {/* Type selector */}
        <div className="flex justify-center gap-2 mt-4">
          {(['static', 'animated', 'fullscreen'] as IMojiType[]).map((t) => (
            <Button
              key={t}
              variant={type === t ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType(t)}
            >
              {t === 'static' && '🖼️ Static'}
              {t === 'animated' && '🎬 Animated'}
              {t === 'fullscreen' && '📺 Fullscreen'}
            </Button>
          ))}
        </div>
      </div>

      {/* Editor Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="style">Style</TabsTrigger>
          <TabsTrigger value="expression">Mood</TabsTrigger>
          <TabsTrigger value="customize">Customize</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
        </TabsList>

        <TabsContent value="style" className="mt-4 space-y-4">
          <StyleSelector selectedStyle={style} onSelectStyle={setStyle} />
        </TabsContent>

        <TabsContent value="expression" className="mt-4 space-y-4">
          <ToneSelector selectedTone={tone} onSelectTone={setTone} />
        </TabsContent>

        <TabsContent value="customize" className="mt-4 space-y-4">
          {/* Quick edits */}
          <div className="space-y-2">
            <Label>Quick Add</Label>
            <div className="flex flex-wrap gap-2">
              {quickEdits.map((edit) => (
                <Button
                  key={edit.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickEdit(edit.prompt)}
                >
                  {edit.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Clothing */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shirt className="w-4 h-4" />
              Clothing
            </Label>
            <Input
              value={clothing}
              onChange={(e) => setClothing(e.target.value)}
              placeholder="e.g., a red hoodie, business suit..."
            />
          </div>

          {/* Accessories */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Glasses className="w-4 h-4" />
              Accessories
            </Label>
            <Input
              value={accessories}
              onChange={(e) => setAccessories(e.target.value)}
              placeholder="e.g., glasses, earrings, hat..."
            />
          </div>

          {/* Custom prompt */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Custom Description
            </Label>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe any additional details... e.g., 'Santa Claus with sunglasses on a beach'"
              rows={3}
            />
          </div>
        </TabsContent>

        <TabsContent value="audio" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              {hasSound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              Add Sound
            </Label>
            <Switch checked={hasSound} onCheckedChange={setHasSound} />
          </div>

          {hasSound && (
            <>
              <div className="space-y-2">
                <Label>Sound Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm">🎤 My Voice</Button>
                  <Button variant="outline" size="sm">🎵 Sound Effect</Button>
                  <Button variant="outline" size="sm">🗣️ AI Voice</Button>
                  <Button variant="outline" size="sm">📚 Library</Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>What should it say?</Label>
                <Textarea
                  value={soundPrompt}
                  onChange={(e) => setSoundPrompt(e.target.value)}
                  placeholder="Type what the iMoji should say or describe the sound..."
                  rows={2}
                />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Name input */}
      <div className="mt-4 space-y-2">
        <Label>iMoji Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Give your iMoji a name"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mt-4">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => {
            setStyle('cartoon');
            setTone('happy');
            setType('static');
            setCustomPrompt('');
            setClothing('');
            setAccessories('');
          }}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
        
        <Button 
          className="flex-1" 
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate
            </>
          )}
        </Button>
      </div>

      {generatedPreview && (
        <Button 
          className="w-full mt-2" 
          variant="default"
          onClick={() => onSave({
            name,
            style,
            tone,
            type,
            customPrompt,
            clothing,
            accessories,
            hasSound,
            generatedUrl: generatedPreview,
            baseImageUrl: faceImageUrl
          })}
        >
          <Send className="w-4 h-4 mr-2" />
          Save to Gallery
        </Button>
      )}
    </div>
  );
};
