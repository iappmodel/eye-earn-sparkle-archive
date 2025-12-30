// Page Layout Editor - Multi-directional navigation design with per-page themes
import React, { useState, useRef } from 'react';
import { 
  Plus, X, RotateCcw, ChevronUp, ChevronDown, 
  ChevronLeft, ChevronRight, Palette, GripVertical,
  Users, Video, Compass, Gift, Heart, Star, Home,
  MessageCircle, Wallet, Settings, Check, Trash2, Play, Pause
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUICustomization, PageSlot, PageDirection } from '@/contexts/UICustomizationContext';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HSLColorPicker } from './HSLColorPicker';
import { TransitionPreview, MiniTransitionPreview } from './TransitionPreview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PageLayoutEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

// Available page content types
const pageContentTypes = [
  { id: 'main', label: 'Main Feed', icon: Home, color: '270 95% 65%' },
  { id: 'friends', label: 'Friends', icon: Users, color: '200 100% 50%' },
  { id: 'promotions', label: 'Promotions', icon: Video, color: '320 90% 60%' },
  { id: 'discovery', label: 'Discover', icon: Compass, color: '45 100% 55%' },
  { id: 'rewards', label: 'Rewards', icon: Gift, color: '150 80% 45%' },
  { id: 'favorites', label: 'Favorites', icon: Heart, color: '0 85% 55%' },
  { id: 'following', label: 'Following', icon: Star, color: '260 80% 60%' },
  { id: 'messages', label: 'Messages', icon: MessageCircle, color: '180 100% 40%' },
  { id: 'wallet', label: 'Wallet', icon: Wallet, color: '45 100% 55%' },
  { id: 'settings', label: 'Settings', icon: Settings, color: '220 60% 75%' },
];

// Theme presets for pages
const pageThemes = [
  { id: 'cyberpunk', name: 'Cyberpunk', colors: { primary: '270 95% 65%', accent: '320 90% 60%', glow: '270 95% 65%' } },
  { id: 'lunar', name: 'Lunar', colors: { primary: '220 60% 75%', accent: '240 40% 70%', glow: '220 60% 75%' } },
  { id: 'ocean', name: 'Ocean', colors: { primary: '200 100% 50%', accent: '180 100% 40%', glow: '200 100% 50%' } },
  { id: 'solar', name: 'Solar', colors: { primary: '45 100% 55%', accent: '30 100% 50%', glow: '45 100% 55%' } },
  { id: 'ember', name: 'Ember', colors: { primary: '15 100% 55%', accent: '0 85% 55%', glow: '15 100% 55%' } },
  { id: 'forest', name: 'Forest', colors: { primary: '150 80% 45%', accent: '120 60% 40%', glow: '150 80% 45%' } },
  { id: 'cosmic', name: 'Cosmic', colors: { primary: '260 80% 60%', accent: '220 90% 55%', glow: '260 80% 60%' } },
  { id: 'inherit', name: 'Default', colors: { primary: '', accent: '', glow: '' } },
];

export const PageLayoutEditor: React.FC<PageLayoutEditorProps> = ({
  isOpen,
  onClose,
}) => {
  const { 
    pageLayout, 
    addPage, 
    removePage, 
    updatePage, 
    reorderPages, 
    resetPageLayout 
  } = useUICustomization();
  
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [draggedPage, setDraggedPage] = useState<PageSlot | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [selectedTransitionType, setSelectedTransitionType] = useState<'slide' | 'fade' | 'zoom'>('slide');
  const dragDirection = useRef<PageDirection | null>(null);

  // Get pages by direction
  const getPagesByDirection = (direction: PageDirection) => {
    return pageLayout.pages
      .filter(p => p.direction === direction)
      .sort((a, b) => a.order - b.order);
  };

  // Get current center page
  const centerPage = pageLayout.pages.find(p => p.direction === 'center');

  // Handle add page
  const handleAddPage = (direction: PageDirection) => {
    const existingPages = getPagesByDirection(direction);
    const newOrder = existingPages.length;
    const defaultContent = direction === 'left' ? 'friends' : 
                          direction === 'right' ? 'promotions' : 
                          direction === 'up' ? 'favorites' : 'rewards';
    
    addPage({
      id: `page-${Date.now()}`,
      direction,
      order: newOrder,
      contentType: defaultContent,
      label: pageContentTypes.find(t => t.id === defaultContent)?.label || 'New Page',
      theme: 'inherit',
      customColors: undefined,
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, page: PageSlot) => {
    setDraggedPage(page);
    dragDirection.current = page.direction;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', page.id);
  };

  const handleDragOver = (e: React.DragEvent, index: number, direction: PageDirection) => {
    e.preventDefault();
    // Only allow dropping within same direction
    if (dragDirection.current === direction) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (draggedPage && dragOverIndex !== null && dragDirection.current) {
      const pagesInDirection = getPagesByDirection(dragDirection.current);
      const fromIndex = pagesInDirection.findIndex(p => p.id === draggedPage.id);
      if (fromIndex !== -1 && fromIndex !== dragOverIndex) {
        reorderPages(dragDirection.current, fromIndex, dragOverIndex);
      }
    }
    setDraggedPage(null);
    setDragOverIndex(null);
    dragDirection.current = null;
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // Render a page card
  const renderPageCard = (page: PageSlot, index: number, isCenter = false) => {
    const contentType = pageContentTypes.find(t => t.id === page.contentType);
    const Icon = contentType?.icon || Home;
    const theme = pageThemes.find(t => t.id === page.theme);
    const glowColor = page.customColors?.primary || theme?.colors.primary || contentType?.color || '270 95% 65%';
    const isDragging = draggedPage?.id === page.id;
    const isDragOver = dragOverIndex === index && dragDirection.current === page.direction;
    
    return (
      <div
        key={page.id}
        draggable={!isCenter}
        onDragStart={(e) => handleDragStart(e, page)}
        onDragOver={(e) => handleDragOver(e, index, page.direction)}
        onDragEnd={handleDragEnd}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative group rounded-2xl border transition-all duration-300',
          'bg-card/80 backdrop-blur-sm cursor-pointer',
          isCenter 
            ? 'w-24 h-40 border-primary shadow-[0_0_25px_hsl(var(--primary)/0.4)]' 
            : 'w-20 h-32 border-border/50 hover:border-primary/50',
          editingPage === page.id && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
          isDragging && 'opacity-50 scale-95',
          isDragOver && 'ring-2 ring-accent ring-offset-1 scale-105',
          !isCenter && 'cursor-grab active:cursor-grabbing'
        )}
        onClick={() => setEditingPage(page.id)}
        style={{
          boxShadow: isCenter ? undefined : `0 0 15px hsl(${glowColor} / 0.2)`
        }}
      >
        {/* Drag handle indicator for non-center pages */}
        {!isCenter && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-3 h-3 text-muted-foreground/50" />
          </div>
        )}

        {/* Gradient overlay */}
        <div 
          className="absolute inset-0 rounded-2xl opacity-30"
          style={{
            background: `linear-gradient(135deg, hsl(${glowColor}), transparent)`
          }}
        />
        
        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
          <div 
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center mb-1',
              isCenter ? 'w-10 h-10 mb-2' : ''
            )}
            style={{ 
              background: `linear-gradient(135deg, hsl(${glowColor}), hsl(${glowColor} / 0.5))` 
            }}
          >
            <Icon className={cn('text-white', isCenter ? 'w-5 h-5' : 'w-4 h-4')} />
          </div>
          <span className={cn(
            'text-center font-medium leading-tight',
            isCenter ? 'text-xs' : 'text-[10px]'
          )}>
            {page.label}
          </span>
          {/* Order indicator for multi-page directions */}
          {!isCenter && getPagesByDirection(page.direction).length > 1 && (
            <span className="absolute bottom-1 right-1 text-[8px] text-muted-foreground/70 font-mono">
              {index + 1}
            </span>
          )}
        </div>
        
        {/* Delete button (not for center) */}
        {!isCenter && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removePage(page.id);
            }}
            className={cn(
              'absolute -top-2 -right-2 w-5 h-5 rounded-full',
              'bg-destructive text-destructive-foreground',
              'flex items-center justify-center',
              'opacity-0 group-hover:opacity-100 transition-opacity',
              'hover:scale-110'
            )}
          >
            <X className="w-3 h-3" />
          </button>
        )}
        
        {/* Theme indicator */}
        {page.theme !== 'inherit' && (
          <div 
            className="absolute bottom-1 left-1 w-3 h-3 rounded-full border border-white/50"
            style={{ background: `hsl(${theme?.colors.primary || glowColor})` }}
          />
        )}
      </div>
    );
  };

  // Render add button
  const renderAddButton = (direction: PageDirection) => (
    <button
      onClick={() => handleAddPage(direction)}
      className={cn(
        'w-16 h-24 rounded-xl border-2 border-dashed border-muted-foreground/30',
        'flex items-center justify-center',
        'text-muted-foreground/50 hover:text-primary hover:border-primary/50',
        'transition-all duration-200 hover:bg-primary/5'
      )}
    >
      <Plus className="w-6 h-6" />
    </button>
  );

  // Render direction arrow
  const renderDirectionArrow = (direction: 'up' | 'down' | 'left' | 'right') => {
    const icons = {
      up: ChevronUp,
      down: ChevronDown,
      left: ChevronLeft,
      right: ChevronRight,
    };
    const Icon = icons[direction];
    return (
      <div className="flex items-center justify-center p-2">
        <div className="w-6 h-6 rounded-full bg-muted/30 flex items-center justify-center">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    );
  };

  // Render page stack for a direction
  const renderPageStack = (direction: PageDirection, reverse = false) => {
    const pages = getPagesByDirection(direction);
    const orderedPages = reverse ? [...pages].reverse() : pages;
    
    return (
      <div className={cn(
        'flex items-center gap-2',
        (direction === 'up' || direction === 'down') && 'flex-col'
      )}>
        {orderedPages.map((page, index) => renderPageCard(page, reverse ? pages.length - 1 - index : index))}
      </div>
    );
  };

  if (!isOpen) return null;

  const leftPages = getPagesByDirection('left');
  const rightPages = getPagesByDirection('right');
  const upPages = getPagesByDirection('up');
  const downPages = getPagesByDirection('down');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Page Layout
          </h3>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Design your navigation • Drag to reorder
          </p>
        </div>
        <button
          onClick={resetPageLayout}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Visual Cross Layout */}
      <div className="relative bg-gradient-to-b from-muted/30 to-transparent rounded-2xl p-4 border border-border/30">
        {/* Grid container */}
        <div className="flex flex-col items-center gap-2">
          {/* Up section */}
          <div className="flex flex-col items-center gap-2">
            {upPages.length > 0 && renderPageStack('up', true)}
            {renderAddButton('up')}
            {renderDirectionArrow('up')}
          </div>

          {/* Middle row: Left - Center - Right */}
          <div className="flex items-center gap-2">
            {/* Left section */}
            <div className="flex items-center gap-2">
              {renderAddButton('left')}
              {renderPageStack('left', true)}
              {renderDirectionArrow('left')}
            </div>

            {/* Center (Main page) */}
            <div className="relative">
              {centerPage && renderPageCard(centerPage, 0, true)}
              {/* Phone frame effect */}
              <div className="absolute inset-0 rounded-2xl border-2 border-foreground/10 pointer-events-none" />
            </div>

            {/* Right section */}
            <div className="flex items-center gap-2">
              {renderDirectionArrow('right')}
              {renderPageStack('right')}
              {renderAddButton('right')}
            </div>
          </div>

          {/* Down section */}
          <div className="flex flex-col items-center gap-2">
            {renderDirectionArrow('down')}
            {downPages.length > 0 && renderPageStack('down')}
            {renderAddButton('down')}
          </div>
        </div>
      </div>

      {/* Page Editor Panel */}
      {editingPage && (() => {
        const page = pageLayout.pages.find(p => p.id === editingPage);
        if (!page) return null;
        
        return (
          <div className="p-4 rounded-2xl bg-muted/20 border border-border/30 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                Edit Page
              </h4>
              <button
                onClick={() => setEditingPage(null)}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Type */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Content Type</label>
              <Select
                value={page.contentType}
                onValueChange={(value) => {
                  const newContent = pageContentTypes.find(t => t.id === value);
                  updatePage(page.id, { 
                    contentType: value,
                    label: newContent?.label || page.label
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageContentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <type.icon className="w-4 h-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Label */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Label</label>
              <input
                type="text"
                value={page.label}
                onChange={(e) => updatePage(page.id, { label: e.target.value })}
                className={cn(
                  'w-full px-3 py-2 rounded-lg',
                  'bg-background border border-border',
                  'text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
                )}
              />
            </div>

            {/* Page Theme with Tabs */}
            <Tabs defaultValue="presets" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-8">
                <TabsTrigger value="presets" className="text-xs">Presets</TabsTrigger>
                <TabsTrigger value="custom" className="text-xs">Custom HSL</TabsTrigger>
                <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
              </TabsList>
              
              {/* Theme Presets */}
              <TabsContent value="presets" className="space-y-2 mt-3">
                <div className="grid grid-cols-4 gap-2">
                  {pageThemes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => updatePage(page.id, { 
                        theme: theme.id,
                        customColors: theme.id !== 'inherit' ? theme.colors : undefined
                      })}
                      className={cn(
                        'relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                        page.theme === theme.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border/30 hover:border-border'
                      )}
                    >
                      <div 
                        className="w-6 h-6 rounded-full"
                        style={{
                          background: theme.id === 'inherit' 
                            ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))'
                            : `linear-gradient(135deg, hsl(${theme.colors.primary}), hsl(${theme.colors.accent}))`
                        }}
                      />
                      <span className="text-[10px] font-medium">{theme.name}</span>
                      {page.theme === theme.id && (
                        <Check className="w-3 h-3 text-primary absolute top-1 right-1" />
                      )}
                    </button>
                  ))}
                </div>
              </TabsContent>
              
              {/* Custom HSL Colors */}
              <TabsContent value="custom" className="space-y-4 mt-3">
                <HSLColorPicker
                  label="Primary Color"
                  value={page.customColors?.primary || pageThemes.find(t => t.id === page.theme)?.colors.primary || '270 95% 65%'}
                  onChange={(value) => updatePage(page.id, { 
                    theme: 'custom',
                    customColors: { 
                      ...page.customColors,
                      primary: value,
                      accent: page.customColors?.accent || '320 90% 60%',
                      glow: page.customColors?.glow || value,
                    }
                  })}
                />
                <HSLColorPicker
                  label="Accent Color"
                  value={page.customColors?.accent || pageThemes.find(t => t.id === page.theme)?.colors.accent || '320 90% 60%'}
                  onChange={(value) => updatePage(page.id, { 
                    theme: 'custom',
                    customColors: { 
                      ...page.customColors,
                      primary: page.customColors?.primary || '270 95% 65%',
                      accent: value,
                      glow: page.customColors?.glow || page.customColors?.primary || '270 95% 65%',
                    }
                  })}
                />
                <HSLColorPicker
                  label="Glow Color"
                  value={page.customColors?.glow || page.customColors?.primary || '270 95% 65%'}
                  onChange={(value) => updatePage(page.id, { 
                    theme: 'custom',
                    customColors: { 
                      ...page.customColors,
                      primary: page.customColors?.primary || '270 95% 65%',
                      accent: page.customColors?.accent || '320 90% 60%',
                      glow: value,
                    }
                  })}
                />
              </TabsContent>
              
              {/* Transition Preview */}
              <TabsContent value="preview" className="space-y-4 mt-3">
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground">Transition Style</label>
                  <div className="flex items-center justify-center gap-3">
                    {(['slide', 'fade', 'zoom'] as const).map((type) => (
                      <MiniTransitionPreview
                        key={type}
                        transitionType={type}
                        direction={page.direction}
                        isActive={selectedTransitionType === type}
                        onClick={() => setSelectedTransitionType(type)}
                        primaryColor={page.customColors?.primary || pageThemes.find(t => t.id === page.theme)?.colors.primary}
                      />
                    ))}
                  </div>
                </div>
                
                <TransitionPreview
                  direction={page.direction}
                  transitionType={selectedTransitionType}
                  isPlaying={isPreviewPlaying}
                  onPlayToggle={() => setIsPreviewPlaying(!isPreviewPlaying)}
                  primaryColor={page.customColors?.primary || pageThemes.find(t => t.id === page.theme)?.colors.primary}
                  accentColor={page.customColors?.accent || pageThemes.find(t => t.id === page.theme)?.colors.accent}
                />
              </TabsContent>
            </Tabs>

            {/* Delete Page (not center) */}
            {page.direction !== 'center' && (
              <button
                onClick={() => {
                  removePage(page.id);
                  setEditingPage(null);
                }}
                className={cn(
                  'w-full py-2 rounded-lg',
                  'bg-destructive/10 text-destructive border border-destructive/30',
                  'hover:bg-destructive/20 transition-colors',
                  'flex items-center justify-center gap-2 text-sm font-medium'
                )}
              >
                <Trash2 className="w-4 h-4" />
                Remove Page
              </button>
            )}
          </div>
        );
      })()}

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {(['up', 'down', 'left', 'right'] as const).map(dir => (
          <div key={dir} className="p-2 rounded-lg bg-muted/20">
            <div className="text-lg font-bold text-primary">
              {getPagesByDirection(dir).length}
            </div>
            <div className="text-[10px] text-muted-foreground capitalize">{dir}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PageLayoutEditor;
