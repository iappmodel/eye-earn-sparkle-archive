import React, { useState, useEffect } from 'react';
import { Sparkles, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { IMojiGallery } from './IMojiGallery';
import { IMojiCreator } from './IMojiCreator';
import { IMoji, IMOJI_STYLES, IMOJI_TONES } from './types';
import { cn } from '@/lib/utils';

interface IMojiPickerProps {
  onSelect: (imoji: IMoji) => void;
  triggerClassName?: string;
  compact?: boolean;

  /** Control the sheet open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the internal trigger button (useful when opening from another UI). */
  showTrigger?: boolean;
}

export const IMojiPicker: React.FC<IMojiPickerProps> = ({
  onSelect,
  triggerClassName,
  compact = false,
  open,
  onOpenChange,
  showTrigger = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [imojis, setImojis] = useState<IMoji[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('my-imojis');
  const [editingImoji, setEditingImoji] = useState<IMoji | undefined>();

  const isControlled = open !== undefined;
  const actualOpen = isControlled ? open : isOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setIsOpen;

  // Load iMojis from local storage
  useEffect(() => {
    const stored = localStorage.getItem('user_imojis');
    if (stored) {
      setImojis(JSON.parse(stored));
    }
  }, [actualOpen]);

  const handleSelect = (imoji: IMoji) => {
    onSelect(imoji);
    setOpen(false);
  };

  const handleEdit = (imoji: IMoji) => {
    setEditingImoji(imoji);
    setShowCreator(true);
  };

  const handleDelete = (imojiId: string) => {
    const updated = imojis.filter(i => i.id !== imojiId);
    setImojis(updated);
    localStorage.setItem('user_imojis', JSON.stringify(updated));
  };

  const handleToggleFavorite = (imojiId: string) => {
    const updated = imojis.map(i => 
      i.id === imojiId ? { ...i, isFavorite: !i.isFavorite } : i
    );
    setImojis(updated);
    localStorage.setItem('user_imojis', JSON.stringify(updated));
  };

  const handleCreated = (newImoji: IMoji) => {
    const existing = imojis.find(i => i.id === newImoji.id);
    const updated = existing
      ? imojis.map(i => i.id === newImoji.id ? newImoji : i)
      : [...imojis, newImoji];
    setImojis(updated);
    setShowCreator(false);
    setEditingImoji(undefined);
  };

  const filteredImojis = searchQuery
    ? imojis.filter(i => 
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.style.includes(searchQuery.toLowerCase()) ||
        i.tone.includes(searchQuery.toLowerCase())
      )
    : imojis;

  // Standard emojis as fallback
  const standardEmojis = ['😀', '😂', '🥰', '😎', '🤔', '😢', '😡', '🥳', '😴', '🤯', '🙄', '😏', '🤗', '😬', '🤭', '😇'];

  return (
    <>
      <Sheet open={actualOpen} onOpenChange={setOpen}>
        {showTrigger && (
          <SheetTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("relative", triggerClassName)}
            >
              <Sparkles className="w-5 h-5" />
              {imojis.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-[10px] text-primary-foreground rounded-full flex items-center justify-center">
                  {imojis.length}
                </span>
              )}
            </Button>
          </SheetTrigger>
        )}
        
        <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              iMoji
            </SheetTitle>
          </SheetHeader>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search iMojis..."
              className="pl-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="my-imojis">My iMojis</TabsTrigger>
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="standard">Standard</TabsTrigger>
            </TabsList>

            <TabsContent value="my-imojis" className="mt-4">
              <IMojiGallery
                imojis={filteredImojis}
                onSelect={handleSelect}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleFavorite={handleToggleFavorite}
                onCreateNew={() => setShowCreator(true)}
              />
            </TabsContent>

            <TabsContent value="recent" className="mt-4">
              {imojis.length > 0 ? (
                <IMojiGallery
                  imojis={[...imojis].sort((a, b) => 
                    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                  ).slice(0, 12)}
                  onSelect={handleSelect}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleFavorite={handleToggleFavorite}
                  onCreateNew={() => setShowCreator(true)}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No recent iMojis</p>
                  <Button variant="link" onClick={() => setShowCreator(true)}>
                    Create your first iMoji
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="standard" className="mt-4">
              <div className="grid grid-cols-8 gap-2">
                {standardEmojis.map((emoji, index) => (
                  <button
                    key={index}
                    className="aspect-square text-2xl flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    onClick={() => {
                      // For standard emojis, create a simple IMoji object
                      const standardImoji: IMoji = {
                        id: `standard-${emoji}`,
                        userId: '',
                        name: emoji,
                        baseImageUrl: '',
                        generatedUrl: '',
                        thumbnailUrl: '',
                        style: 'memoji',
                        tone: 'neutral',
                        type: 'static',
                        hasSound: false,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        isFavorite: false,
                        sourceType: 'gallery'
                      };
                      onSelect(standardImoji);
                      setOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-muted/50 rounded-xl text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  Want personalized emojis with your face?
                </p>
                <Button onClick={() => setShowCreator(true)} className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  Create iMoji
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Creator Modal */}
      <IMojiCreator
        isOpen={showCreator}
        onClose={() => {
          setShowCreator(false);
          setEditingImoji(undefined);
        }}
        onCreated={handleCreated}
        existingImoji={editingImoji}
      />
    </>
  );
};
