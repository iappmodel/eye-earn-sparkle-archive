// Layout Templates - Predefined navigation patterns
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useUICustomization, PageLayout, PageSlot } from '@/contexts/UICustomizationContext';
import { 
  Smartphone, Grid3X3, Layers, Compass, 
  ArrowRightLeft, ArrowUpDown, Check, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  layout: PageLayout;
  colors: {
    primary: string;
    accent: string;
  };
}

// Predefined templates
const templates: LayoutTemplate[] = [
  {
    id: 'tiktok',
    name: 'TikTok Style',
    description: 'Vertical swipe between feeds',
    icon: Smartphone,
    colors: { primary: '0 0% 0%', accent: '350 80% 55%' },
    layout: {
      pages: [
        { id: 'main', direction: 'center', order: 0, contentType: 'main', label: 'For You', theme: 'inherit' },
        { id: 'following', direction: 'left', order: 0, contentType: 'following', label: 'Following', theme: 'cosmic' },
        { id: 'discover', direction: 'right', order: 0, contentType: 'discovery', label: 'Discover', theme: 'ember' },
      ],
      enableMultiDirection: true,
    },
  },
  {
    id: 'instagram',
    name: 'Instagram Style',
    description: 'Horizontal stories & vertical feed',
    icon: Grid3X3,
    colors: { primary: '330 80% 55%', accent: '45 100% 55%' },
    layout: {
      pages: [
        { id: 'main', direction: 'center', order: 0, contentType: 'main', label: 'Home', theme: 'inherit' },
        { id: 'camera', direction: 'left', order: 0, contentType: 'promotions', label: 'Create', theme: 'solar' },
        { id: 'messages', direction: 'right', order: 0, contentType: 'messages', label: 'Messages', theme: 'ocean' },
        { id: 'explore', direction: 'up', order: 0, contentType: 'discovery', label: 'Explore', theme: 'cosmic' },
      ],
      enableMultiDirection: true,
    },
  },
  {
    id: 'snapchat',
    name: 'Snapchat Style',
    description: 'Camera-centric with swipe navigation',
    icon: Layers,
    colors: { primary: '55 100% 50%', accent: '200 100% 50%' },
    layout: {
      pages: [
        { id: 'main', direction: 'center', order: 0, contentType: 'main', label: 'Camera', theme: 'solar' },
        { id: 'chat', direction: 'left', order: 0, contentType: 'messages', label: 'Chat', theme: 'ocean' },
        { id: 'stories', direction: 'right', order: 0, contentType: 'friends', label: 'Stories', theme: 'cosmic' },
        { id: 'discover', direction: 'right', order: 1, contentType: 'discovery', label: 'Discover', theme: 'ember' },
        { id: 'map', direction: 'down', order: 0, contentType: 'discovery', label: 'Map', theme: 'forest' },
      ],
      enableMultiDirection: true,
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple left-right navigation',
    icon: ArrowRightLeft,
    colors: { primary: '220 10% 50%', accent: '220 10% 70%' },
    layout: {
      pages: [
        { id: 'main', direction: 'center', order: 0, contentType: 'main', label: 'Feed', theme: 'lunar' },
        { id: 'profile', direction: 'left', order: 0, contentType: 'wallet', label: 'Profile', theme: 'lunar' },
        { id: 'explore', direction: 'right', order: 0, contentType: 'discovery', label: 'Explore', theme: 'lunar' },
      ],
      enableMultiDirection: true,
    },
  },
  {
    id: 'hub',
    name: 'Hub Style',
    description: 'Central hub with all directions',
    icon: Compass,
    colors: { primary: '270 95% 65%', accent: '320 90% 60%' },
    layout: {
      pages: [
        { id: 'main', direction: 'center', order: 0, contentType: 'main', label: 'Hub', theme: 'cyberpunk' },
        { id: 'friends', direction: 'left', order: 0, contentType: 'friends', label: 'Friends', theme: 'ocean' },
        { id: 'promotions', direction: 'right', order: 0, contentType: 'promotions', label: 'Promos', theme: 'ember' },
        { id: 'rewards', direction: 'up', order: 0, contentType: 'rewards', label: 'Rewards', theme: 'forest' },
        { id: 'wallet', direction: 'down', order: 0, contentType: 'wallet', label: 'Wallet', theme: 'solar' },
      ],
      enableMultiDirection: true,
    },
  },
  {
    id: 'vertical',
    name: 'Vertical Stack',
    description: 'Up and down navigation only',
    icon: ArrowUpDown,
    colors: { primary: '150 80% 45%', accent: '180 100% 40%' },
    layout: {
      pages: [
        { id: 'main', direction: 'center', order: 0, contentType: 'main', label: 'Main', theme: 'forest' },
        { id: 'explore', direction: 'up', order: 0, contentType: 'discovery', label: 'Explore', theme: 'ocean' },
        { id: 'favorites', direction: 'up', order: 1, contentType: 'favorites', label: 'Favorites', theme: 'ember' },
        { id: 'profile', direction: 'down', order: 0, contentType: 'wallet', label: 'Profile', theme: 'cosmic' },
      ],
      enableMultiDirection: true,
    },
  },
];

interface LayoutTemplatesProps {
  onApply?: () => void;
}

export const LayoutTemplates: React.FC<LayoutTemplatesProps> = ({ onApply }) => {
  const { pageLayout, importLayout, exportLayout } = useUICustomization();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const handleApplyTemplate = (template: LayoutTemplate) => {
    setIsApplying(true);
    setSelectedTemplate(template.id);
    
    // Create import data in the expected format
    const importData = JSON.stringify({
      version: '1.0',
      pageLayout: template.layout,
      exportedAt: new Date().toISOString(),
    });
    
    setTimeout(() => {
      const success = importLayout(importData);
      if (success) {
        toast.success(`Applied ${template.name} template`);
        onApply?.();
      } else {
        toast.error('Failed to apply template');
      }
      setIsApplying(false);
    }, 300);
  };

  // Check if current layout matches a template
  const getCurrentTemplate = (): string | null => {
    for (const template of templates) {
      const templatePageIds = template.layout.pages.map(p => p.contentType).sort();
      const currentPageIds = pageLayout.pages.map(p => p.contentType).sort();
      if (JSON.stringify(templatePageIds) === JSON.stringify(currentPageIds)) {
        return template.id;
      }
    }
    return null;
  };

  const currentTemplate = getCurrentTemplate();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold">Layout Templates</h4>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {templates.map((template) => {
          const Icon = template.icon;
          const isCurrentTemplate = currentTemplate === template.id;
          const isSelected = selectedTemplate === template.id;
          
          return (
            <button
              key={template.id}
              onClick={() => handleApplyTemplate(template)}
              disabled={isApplying}
              className={cn(
                'relative p-3 rounded-xl border transition-all duration-300',
                'flex flex-col items-start gap-2 text-left',
                'hover:scale-[1.02] active:scale-[0.98]',
                isCurrentTemplate
                  ? 'border-primary bg-primary/10 shadow-[0_0_15px_hsl(var(--primary)/0.2)]'
                  : 'border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card/80',
                isApplying && isSelected && 'animate-pulse'
              )}
            >
              {/* Template icon and colors preview */}
              <div className="flex items-center justify-between w-full">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, hsl(${template.colors.primary}), hsl(${template.colors.accent}))`
                  }}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
                
                {isCurrentTemplate && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </div>
              
              {/* Template info */}
              <div>
                <h5 className="font-medium text-sm">{template.name}</h5>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  {template.description}
                </p>
              </div>
              
              {/* Mini layout preview */}
              <div className="w-full mt-1 flex justify-center">
                <div className="relative w-10 h-10">
                  {/* Center */}
                  <div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-4 rounded-sm border border-foreground/20"
                    style={{ background: `hsl(${template.colors.primary} / 0.3)` }}
                  />
                  {/* Direction indicators */}
                  {template.layout.pages.filter(p => p.direction !== 'center').map((page, i) => {
                    const positions = {
                      up: 'top-0 left-1/2 -translate-x-1/2',
                      down: 'bottom-0 left-1/2 -translate-x-1/2',
                      left: 'left-0 top-1/2 -translate-y-1/2',
                      right: 'right-0 top-1/2 -translate-y-1/2',
                    };
                    return (
                      <div
                        key={page.id}
                        className={cn(
                          'absolute w-2 h-3 rounded-[2px]',
                          positions[page.direction as keyof typeof positions]
                        )}
                        style={{ 
                          background: `hsl(${template.colors.accent} / ${0.3 + i * 0.1})`,
                          opacity: 0.5 + i * 0.1
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      <p className="text-[10px] text-muted-foreground/70 text-center">
        Select a template to instantly apply a navigation layout
      </p>
    </div>
  );
};

export default LayoutTemplates;
