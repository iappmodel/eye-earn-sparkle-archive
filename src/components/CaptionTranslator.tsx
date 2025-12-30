import React, { useState } from 'react';
import { Languages, Loader2, Check, ChevronDown, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CaptionTranslatorProps {
  text: string;
  onTranslate: (translatedText: string, language: string) => void;
  className?: string;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
];

export const CaptionTranslator: React.FC<CaptionTranslatorProps> = ({
  text,
  onTranslate,
  className,
}) => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedLanguage, setTranslatedLanguage] = useState<string | null>(null);

  const handleTranslate = async (targetLanguage: string) => {
    if (!text.trim()) {
      toast.error('No text to translate');
      return;
    }

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-caption', {
        body: { text, targetLanguage }
      });

      if (error) throw error;

      if (data?.translatedText) {
        onTranslate(data.translatedText, targetLanguage);
        setTranslatedLanguage(targetLanguage);
        toast.success(`Translated to ${SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name}`);
      }
    } catch (error: any) {
      console.error('Translation error:', error);
      if (error.message?.includes('Rate limit')) {
        toast.error('Translation rate limit reached. Try again later.');
      } else {
        toast.error('Translation failed');
      }
    } finally {
      setIsTranslating(false);
    }
  };

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === translatedLanguage);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={className}
          disabled={isTranslating || !text.trim()}
        >
          {isTranslating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Translating...
            </>
          ) : translatedLanguage ? (
            <>
              <span className="mr-1">{currentLang?.flag}</span>
              {currentLang?.name}
              <ChevronDown className="w-3 h-3 ml-1" />
            </>
          ) : (
            <>
              <Languages className="w-4 h-4 mr-2" />
              Translate
              <ChevronDown className="w-3 h-3 ml-1" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Translate to
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleTranslate(lang.code)}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span>{lang.flag}</span>
              {lang.name}
            </span>
            {translatedLanguage === lang.code && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
