import React, { useState } from 'react';
import { X, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FaceCapture } from './FaceCapture';
import { IMojiEditor } from './IMojiEditor';
import { IMoji } from './types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface IMojiCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (imoji: IMoji) => void;
  existingImoji?: IMoji;
}

export const IMojiCreator: React.FC<IMojiCreatorProps> = ({
  isOpen,
  onClose,
  onCreated,
  existingImoji
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'capture' | 'edit'>(existingImoji ? 'edit' : 'capture');
  const [faceImageUrl, setFaceImageUrl] = useState<string>(existingImoji?.baseImageUrl || '');
  const [faceSource, setFaceSource] = useState<'camera' | 'gallery'>('camera');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(existingImoji?.generatedUrl || null);

  const handleFaceCapture = (imageUrl: string, source: 'camera' | 'gallery') => {
    setFaceImageUrl(imageUrl);
    setFaceSource(source);
    setStep('edit');
  };

  const handleGenerate = async (prompt: string) => {
    if (!faceImageUrl) {
      toast.error('Please capture your face first');
      return;
    }

    setIsGenerating(true);
    toast.info('Creating your iMoji...', { description: 'This may take a moment' });

    try {
      const response = await supabase.functions.invoke('generate-imoji', {
        body: {
          faceImageUrl,
          prompt,
          userId: user?.id
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Generation failed');
      }

      const { generatedImageUrl, thumbnailUrl } = response.data;
      setGeneratedUrl(generatedImageUrl);
      toast.success('iMoji created!');
    } catch (error) {
      console.error('iMoji generation error:', error);
      toast.error('Failed to generate iMoji', {
        description: 'Please try again'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async (imojiData: Partial<IMoji>) => {
    if (!user) {
      toast.error('Please sign in to save iMojis');
      return;
    }

    try {
      const newImoji: IMoji = {
        id: existingImoji?.id || crypto.randomUUID(),
        userId: user.id,
        name: imojiData.name || 'My iMoji',
        baseImageUrl: faceImageUrl,
        generatedUrl: generatedUrl || imojiData.generatedUrl || '',
        thumbnailUrl: generatedUrl || imojiData.generatedUrl || '',
        style: imojiData.style || 'cartoon',
        tone: imojiData.tone || 'happy',
        type: imojiData.type || 'static',
        customPrompt: imojiData.customPrompt,
        hasSound: imojiData.hasSound || false,
        soundUrl: imojiData.soundUrl,
        clothing: imojiData.clothing,
        accessories: imojiData.accessories,
        characteristics: imojiData.characteristics,
        createdAt: existingImoji?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isFavorite: existingImoji?.isFavorite || false,
        sourceType: faceSource,
        sourceMediaId: imojiData.sourceMediaId
      };

      // Save to local storage for now (in production, save to Supabase)
      const existingImojis = JSON.parse(localStorage.getItem('user_imojis') || '[]');
      const updatedImojis = existingImoji
        ? existingImojis.map((i: IMoji) => i.id === existingImoji.id ? newImoji : i)
        : [...existingImojis, newImoji];
      
      localStorage.setItem('user_imojis', JSON.stringify(updatedImojis));
      
      onCreated(newImoji);
      toast.success('iMoji saved to gallery!');
      onClose();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save iMoji');
    }
  };

  const handleBack = () => {
    if (step === 'edit' && !existingImoji) {
      setStep('capture');
      setFaceImageUrl('');
    } else {
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[95vh] rounded-t-3xl p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={handleBack}>
                {step === 'capture' ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
              </Button>
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                {existingImoji ? 'Edit iMoji' : 'Create iMoji'}
              </SheetTitle>
              <div className="w-10" />
            </div>
          </SheetHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {step === 'capture' ? (
              <FaceCapture
                onCapture={handleFaceCapture}
                onCancel={onClose}
              />
            ) : (
              <IMojiEditor
                imoji={existingImoji}
                faceImageUrl={faceImageUrl}
                onSave={handleSave}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
              />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
