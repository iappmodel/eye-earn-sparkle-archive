import React, { useState } from 'react';
import { Plus, Star, Trash2, Edit2, Volume2, VolumeX, Play, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { IMoji, IMojiStyle } from './types';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface IMojiGalleryProps {
  imojis: IMoji[];
  onSelect: (imoji: IMoji) => void;
  onEdit: (imoji: IMoji) => void;
  onDelete: (imojiId: string) => void;
  onToggleFavorite: (imojiId: string) => void;
  onCreateNew: () => void;
  selectedId?: string;
  compact?: boolean;
}

export const IMojiGallery: React.FC<IMojiGalleryProps> = ({
  imojis,
  onSelect,
  onEdit,
  onDelete,
  onToggleFavorite,
  onCreateNew,
  selectedId,
  compact = false
}) => {
  const [filter, setFilter] = useState<'all' | 'favorites' | IMojiStyle>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filteredImojis = imojis.filter(imoji => {
    if (filter === 'all') return true;
    if (filter === 'favorites') return imoji.isFavorite;
    return imoji.style === filter;
  });

  const favoriteImojis = imojis.filter(i => i.isFavorite);
  const recentImojis = [...imojis].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ).slice(0, 8);

  if (compact) {
    return (
      <div className="flex gap-2 overflow-x-auto py-2 px-1 scrollbar-hide">
        <button
          onClick={onCreateNew}
          className="shrink-0 w-12 h-12 rounded-xl border-2 border-dashed border-border flex items-center justify-center hover:border-primary transition-colors"
        >
          <Plus className="w-5 h-5 text-muted-foreground" />
        </button>
        
        {recentImojis.map((imoji) => (
          <button
            key={imoji.id}
            onClick={() => onSelect(imoji)}
            className={cn(
              "shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 transition-all",
              selectedId === imoji.id 
                ? "border-primary ring-2 ring-primary/30" 
                : "border-transparent hover:border-primary/50"
            )}
          >
            <img
              src={imoji.thumbnailUrl || imoji.generatedUrl}
              alt={imoji.name}
              className="w-full h-full object-cover"
            />
            {imoji.type === 'animated' && (
              <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-primary rounded-full flex items-center justify-center">
                <Play className="w-2 h-2 text-primary-foreground" />
              </div>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          variant={filter === 'favorites' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('favorites')}
          className="gap-1"
        >
          <Star className="w-4 h-4" />
          Favorites
        </Button>
      </div>

      {/* Favorites Section */}
      {filter === 'all' && favoriteImojis.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500" />
            Favorites
          </h4>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {favoriteImojis.map((imoji) => (
              <IMojiCard
                key={imoji.id}
                imoji={imoji}
                isSelected={selectedId === imoji.id}
                isHovered={hoveredId === imoji.id}
                onSelect={() => onSelect(imoji)}
                onEdit={() => onEdit(imoji)}
                onDelete={() => onDelete(imoji.id)}
                onToggleFavorite={() => onToggleFavorite(imoji.id)}
                onHover={setHoveredId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-4 gap-3">
        {/* Create New Button */}
        <button
          onClick={onCreateNew}
          className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all"
        >
          <Plus className="w-8 h-8 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Create</span>
        </button>

        {filteredImojis.map((imoji) => (
          <IMojiCard
            key={imoji.id}
            imoji={imoji}
            isSelected={selectedId === imoji.id}
            isHovered={hoveredId === imoji.id}
            onSelect={() => onSelect(imoji)}
            onEdit={() => onEdit(imoji)}
            onDelete={() => onDelete(imoji.id)}
            onToggleFavorite={() => onToggleFavorite(imoji.id)}
            onHover={setHoveredId}
          />
        ))}
      </div>

      {filteredImojis.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No iMojis found</p>
          <Button variant="link" onClick={onCreateNew}>
            Create your first iMoji
          </Button>
        </div>
      )}
    </div>
  );
};

interface IMojiCardProps {
  imoji: IMoji;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onHover: (id: string | null) => void;
}

const IMojiCard: React.FC<IMojiCardProps> = ({
  imoji,
  isSelected,
  isHovered,
  onSelect,
  onEdit,
  onDelete,
  onToggleFavorite,
  onHover
}) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <button
          onClick={onSelect}
          onMouseEnter={() => onHover(imoji.id)}
          onMouseLeave={() => onHover(null)}
          className={cn(
            "relative aspect-square rounded-xl overflow-hidden border-2 transition-all group",
            isSelected 
              ? "border-primary ring-2 ring-primary/30" 
              : "border-transparent hover:border-primary/50"
          )}
        >
          <img
            src={imoji.thumbnailUrl || imoji.generatedUrl}
            alt={imoji.name}
            className="w-full h-full object-cover"
          />
          
          {/* Indicators */}
          <div className="absolute top-1 right-1 flex gap-1">
            {imoji.isFavorite && (
              <div className="w-5 h-5 bg-yellow-500/80 rounded-full flex items-center justify-center">
                <Star className="w-3 h-3 text-white fill-white" />
              </div>
            )}
            {imoji.hasSound && (
              <div className="w-5 h-5 bg-primary/80 rounded-full flex items-center justify-center">
                <Volume2 className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          
          {imoji.type === 'animated' && (
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">
              GIF
            </div>
          )}
          
          {/* Hover overlay */}
          <div className={cn(
            "absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          )}>
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <Edit2 className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <Star className={cn("w-4 h-4", imoji.isFavorite ? "text-yellow-400 fill-yellow-400" : "text-white")} />
              </button>
            </div>
          </div>
        </button>
      </ContextMenuTrigger>
      
      <ContextMenuContent>
        <ContextMenuItem onClick={onSelect}>
          Use iMoji
        </ContextMenuItem>
        <ContextMenuItem onClick={onEdit}>
          <Edit2 className="w-4 h-4 mr-2" />
          Edit
        </ContextMenuItem>
        <ContextMenuItem onClick={onToggleFavorite}>
          <Star className="w-4 h-4 mr-2" />
          {imoji.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
        </ContextMenuItem>
        <ContextMenuItem>
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </ContextMenuItem>
        <ContextMenuItem className="text-destructive" onClick={onDelete}>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
