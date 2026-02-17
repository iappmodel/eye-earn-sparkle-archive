import React, { useState, useCallback } from 'react';
import {
  Heart,
  Trash2,
  Navigation,
  Star,
  RefreshCw,
  Share2,
  ChevronDown,
  StickyNote,
  ExternalLink,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useFavoriteLocations, type FavoriteLocation, type FavoriteSortOption } from '@/hooks/useFavoriteLocations';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CategoryIcon } from './PromotionCategories';

const SORT_OPTIONS: { value: FavoriteSortOption; label: string }[] = [
  { value: 'date_added', label: 'Recently added' },
  { value: 'distance', label: 'Nearest first' },
  { value: 'reward_desc', label: 'Highest reward' },
  { value: 'expiring_soon', label: 'Expiring soon' },
];

interface FavoriteLocationsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (lat: number, lng: number, name: string) => void;
  userLocation?: { lat: number; lng: number } | null;
  onOpenPromotionDetails?: (promotionId: string) => void;
  /** Optional: pass to render as embedded list (e.g. in FavoritesPage) instead of sheet */
  embedded?: boolean;
}

export const FavoriteLocations: React.FC<FavoriteLocationsProps> = ({
  open,
  onOpenChange,
  onNavigate,
  userLocation,
  onOpenPromotionDetails,
  embedded = false,
}) => {
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<FavoriteSortOption>('date_added');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notesDialog, setNotesDialog] = useState<FavoriteLocation | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  const {
    favorites,
    isLoading,
    removeFavorite,
    updateNotes,
    refetch,
  } = useFavoriteLocations({
    userLat: userLocation?.lat,
    userLng: userLocation?.lng,
    sortBy,
    enabled: open || embedded,
  });

  const handleRemoveFavorite = useCallback(
    async (id: string) => {
      await removeFavorite(id);
    },
    [removeFavorite]
  );

  const handleNavigate = useCallback(
    (fav: FavoriteLocation) => {
      onNavigate(fav.latitude, fav.longitude, fav.businessName);
      if (!embedded) onOpenChange(false);
    },
    [onNavigate, onOpenChange, embedded]
  );

  const handleShare = useCallback(() => {
    if (favorites.length === 0) {
      toast.info('No favorites to share');
      return;
    }
    const text = favorites
      .map(
        (f) =>
          `${f.businessName}${f.address ? ` - ${f.address}` : ''}${f.rewardAmount ? ` (+${f.rewardAmount})` : ''}`
      )
      .join('\n');
    if (navigator.share) {
      navigator.share({
        title: 'My Favorite Locations',
        text,
      }).catch(() => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
      });
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    }
  }, [favorites]);

  const handleBulkRemove = useCallback(async () => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await removeFavorite(id);
    }
    setSelectedIds(new Set());
    setSelectMode(false);
    toast.success(`Removed ${selectedIds.size} favorite${selectedIds.size > 1 ? 's' : ''}`);
  }, [selectedIds, removeFavorite]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openNotesDialog = (fav: FavoriteLocation) => {
    setNotesDialog(fav);
    setNotesDraft(fav.notes ?? '');
  };

  const saveNotes = useCallback(async () => {
    if (!notesDialog) return;
    await updateNotes(notesDialog.id, notesDraft.trim() || null);
    setNotesDialog(null);
    setNotesDraft('');
  }, [notesDialog, notesDraft, updateNotes]);

  const content = (
    <>
      {/* Header bar with sort and actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              {SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Sort'}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {SORT_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-1">
          {favorites.length > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={handleShare} className="h-8 w-8 p-0">
                <Share2 className="w-4 h-4" />
              </Button>
              <Button
                variant={selectMode ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setSelectMode((p) => !p);
                  if (selectMode) setSelectedIds(new Set());
                }}
                className="h-8 w-8 p-0"
              >
                <CheckSquare className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 w-8 p-0">
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Bulk actions when selecting */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button variant="destructive" size="sm" onClick={handleBulkRemove}>
            <Trash2 className="w-4 h-4 mr-1" />
            Remove
          </Button>
        </div>
      )}

      <div className="space-y-3 overflow-y-auto pb-8">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-12">
            <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">No favorite locations yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Tap the heart icon on any promotion on the map to save it here
            </p>
          </div>
        ) : (
          favorites.map((fav) => (
            <div
              key={fav.id}
              className={cn(
                'p-4 rounded-xl border transition-colors',
                'bg-muted/30 border-border/50',
                selectMode && selectedIds.has(fav.id) && 'ring-2 ring-primary'
              )}
            >
              <div className="flex items-start gap-3">
                {selectMode ? (
                  <button
                    type="button"
                    onClick={() => toggleSelect(fav.id)}
                    className="mt-1 shrink-0"
                  >
                    {selectedIds.has(fav.id) ? (
                      <CheckSquare className="w-5 h-5 text-primary fill-primary" />
                    ) : (
                      <Square className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CategoryIcon category={fav.category ?? 'general'} size="sm" />
                  </div>
                )}
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => {
                    if (selectMode) {
                      toggleSelect(fav.id);
                    } else if (fav.promotionId && onOpenPromotionDetails) {
                      onOpenPromotionDetails(fav.promotionId);
                    } else {
                      handleNavigate(fav);
                    }
                  }}
                >
                  <h4 className="font-medium truncate">{fav.businessName}</h4>
                  {fav.address && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {fav.address}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {fav.category && (
                      <span className="inline-block px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                        {fav.category}
                      </span>
                    )}
                    {fav.rewardAmount != null && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium',
                          fav.rewardType === 'vicoin' && 'bg-violet-500/20 text-violet-400',
                          fav.rewardType === 'icoin' && 'bg-blue-500/20 text-blue-400',
                          fav.rewardType === 'both' && 'bg-gradient-to-r from-violet-500/20 to-blue-500/20 text-purple-300'
                        )}
                      >
                        +{fav.rewardAmount}
                      </span>
                    )}
                    {fav.distanceKm != null && (
                      <span className="text-xs text-muted-foreground">
                        {fav.distanceKm < 1
                          ? `${(fav.distanceKm * 1000).toFixed(0)} m`
                          : `${fav.distanceKm.toFixed(1)} km`}{' '}
                        away
                      </span>
                    )}
                  </div>
                  {fav.notes && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1 flex items-center gap-1">
                      <StickyNote className="w-3 h-3 shrink-0" />
                      {fav.notes}
                    </p>
                  )}
                </button>
                {!selectMode && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigate(fav);
                      }}
                      title="Navigate"
                    >
                      <Navigation className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        openNotesDialog(fav);
                      }}
                      title="Notes"
                    >
                      <StickyNote
                        className={cn('w-4 h-4', fav.notes && 'text-primary fill-primary/20')}
                      />
                    </Button>
                    {fav.promotionId && onOpenPromotionDetails && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPromotionDetails(fav.promotionId!);
                        }}
                        title="Details"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFavorite(fav.id);
                      }}
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Notes dialog */}
      <Dialog open={!!notesDialog} onOpenChange={(o) => !o && setNotesDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notes for {notesDialog?.businessName}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Add a personal note..."
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialog(null)}>
              Cancel
            </Button>
            <Button onClick={saveNotes}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary fill-primary" />
          Favorite Locations
        </h2>
        {content}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary fill-primary" />
            Favorite Locations
          </SheetTitle>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
};

/** Hook for components that only need toggle + isFavorite (e.g. map markers, promotion cards) */
export const useFavoriteLocation = () => {
  const { user } = useAuth();
  const { toggleFavorite, isFavorite } = useFavoriteLocations({ enabled: true });

  return { toggleFavorite, isFavorite };
};
