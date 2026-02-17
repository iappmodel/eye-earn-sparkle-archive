import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Bookmark,
  X,
  Search,
  LayoutGrid,
  List,
  ChevronDown,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Route,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SavedVideo } from '@/hooks/useSavedVideos';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { CommentsPanel } from '@/components/CommentsPanel';
import { ShareSheet } from '@/components/ShareSheet';
import { toast } from 'sonner';
import SavedVideoPlayer from '@/components/saved-gallery/SavedVideoPlayer';
import SavedVideoCard from '@/components/saved-gallery/SavedVideoCard';

export type SortOption = 'newest' | 'oldest' | 'title' | 'creator';

interface SavedVideosGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  savedVideos: SavedVideo[];
  onUnsave: (contentId: string) => void;
  onAddToRoute?: (video: SavedVideo) => void;
  /** Bulk unsave (for multi-select) */
  onUnsaveMany?: (contentIds: string[]) => void;
  /** Sync state */
  syncing?: boolean;
  /** Manual refresh from server */
  onRefresh?: () => Promise<void>;
  /** Export as JSON string */
  exportAsJson?: () => string;
  /** Import from JSON; returns { imported, skipped, errors } */
  importFromJson?: (json: string) => { imported: number; skipped: number; errors: string[] };
  /** When true, render without full-screen overlay and without header (for embedding inside BookmarksScreen) */
  embedded?: boolean;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'creator', label: 'By creator' },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export const SavedVideosGallery: React.FC<SavedVideosGalleryProps> = ({
  isOpen,
  onClose,
  savedVideos,
  onUnsave,
  onAddToRoute,
  onUnsaveMany,
  syncing = false,
  onRefresh,
  exportAsJson,
  importFromJson,
  embedded = false,
}) => {
  const { light, medium } = useHapticFeedback();
  const [filter, setFilter] = useState<'all' | 'promos' | 'posts'>('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [commentsContentId, setCommentsContentId] = useState<string | null>(null);
  const [commentsContentType, setCommentsContentType] = useState<'user_content' | 'promotion'>('user_content');
  const [shareVideo, setShareVideo] = useState<SavedVideo | null>(null);
  const [importInputKey, setImportInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(searchQuery.trim().toLowerCase(), 300);

  const filtered = useMemo(() => {
    let list = savedVideos.filter((v) => {
      if (filter === 'promos') return v.type === 'promo';
      if (filter === 'posts') return v.type !== 'promo';
      return true;
    });
    if (debouncedSearch) {
      const q = debouncedSearch;
      list = list.filter(
        (v) =>
          v.title?.toLowerCase().includes(q) ||
          v.creator?.displayName?.toLowerCase().includes(q) ||
          v.creator?.username?.toLowerCase().includes(q),
      );
    }
    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case 'newest':
          return b.savedAt - a.savedAt;
        case 'oldest':
          return a.savedAt - b.savedAt;
        case 'title':
          return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
        case 'creator':
          return (a.creator?.displayName || a.creator?.username || '').localeCompare(
            b.creator?.displayName || b.creator?.username || '',
            undefined,
            { sensitivity: 'base' },
          );
        default:
          return 0;
      }
    });
    return sorted;
  }, [savedVideos, filter, debouncedSearch, sort]);

  const activeVideo = activeVideoIndex !== null ? filtered[activeVideoIndex] ?? null : null;

  const handlePlay = useCallback(
    (video: SavedVideo) => {
      if (selectionMode) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(video.contentId)) next.delete(video.contentId);
          else next.add(video.contentId);
          return next;
        });
        return;
      }
      const idx = filtered.findIndex((v) => v.id === video.id);
      if (idx >= 0) setActiveVideoIndex(idx);
    },
    [filtered, selectionMode],
  );

  const handleToggleSelect = useCallback((contentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(contentId)) next.delete(contentId);
      else next.add(contentId);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleRemoveSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (onUnsaveMany) {
      medium();
      onUnsaveMany(ids);
      toast.success(`Removed ${ids.length} from saved`);
    } else {
      ids.forEach((id) => onUnsave(id));
      toast.success(`Removed ${ids.length} from saved`);
    }
    exitSelectionMode();
  }, [selectedIds, onUnsaveMany, onUnsave, exitSelectionMode, medium]);

  const handleAddSelectedToRoute = useCallback(() => {
    if (!onAddToRoute || selectedIds.size === 0) return;
    const promos = filtered.filter((v) => selectedIds.has(v.contentId) && v.type === 'promo' && v.requiresPhysicalAction);
    promos.forEach((v) => onAddToRoute!(v));
    medium();
    toast.success(promos.length ? `Added ${promos.length} to route` : 'Only promos with visits can be added to route');
    exitSelectionMode();
  }, [selectedIds, filtered, onAddToRoute, exitSelectionMode, medium]);

  const handleToggleLike = useCallback((contentId: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(contentId)) next.delete(contentId);
      else next.add(contentId);
      return next;
    });
  }, []);

  const handleUnsaveFromPlayer = useCallback(
    (contentId: string) => {
      onUnsave(contentId);
      if (filtered.length <= 1) {
        setActiveVideoIndex(null);
      } else if (activeVideoIndex !== null && activeVideoIndex >= filtered.length - 1) {
        setActiveVideoIndex(Math.max(0, filtered.length - 2));
      }
    },
    [onUnsave, filtered.length, activeVideoIndex],
  );

  const handlePlayerNavigate = useCallback((index: number) => {
    setActiveVideoIndex(index);
  }, []);

  const handleExport = useCallback(() => {
    if (!exportAsJson) return;
    const json = exportAsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saved-videos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export downloaded');
    setShowMoreMenu(false);
  }, [exportAsJson]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !importFromJson) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const result = importFromJson(text);
        if (result.errors.length) toast.error(result.errors[0] || 'Import failed');
        else toast.success(`Imported ${result.imported}, skipped ${result.skipped} existing`);
        setImportInputKey((k) => k + 1);
      };
      reader.readAsText(file);
      setShowMoreMenu(false);
    },
    [importFromJson],
  );

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    light();
    await onRefresh();
    toast.success('Saved list updated');
    setShowMoreMenu(false);
  }, [onRefresh, light]);

  const isEmpty = savedVideos.length === 0;
  const noResults = !isEmpty && filtered.length === 0;

  if (!isOpen) return null;

  const wrapperClass = embedded
    ? 'flex-1 min-h-0 flex flex-col overflow-hidden'
    : 'fixed inset-0 z-50 bg-background flex flex-col animate-fade-in';

  return (
    <>
      <div className={wrapperClass}>
        {/* Header – hidden when embedded (parent shows its own header with tabs) */}
        {!embedded && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Bookmark className="w-5 h-5 text-primary fill-primary shrink-0" />
            <h2 className="text-lg font-semibold text-foreground truncate">Saved</h2>
            <span className="text-sm text-muted-foreground shrink-0">({savedVideos.length})</span>
            {syncing && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Syncing…
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {selectionMode ? (
              <>
                <span className="text-sm text-muted-foreground mr-1">{selectedIds.size} selected</span>
                <button
                  onClick={exitSelectionMode}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-muted/50 text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveSelected}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-destructive/20 text-destructive"
                >
                  <Trash2 className="w-4 h-4 inline mr-1" />
                  Remove
                </button>
                {onAddToRoute && (
                  <button
                    onClick={handleAddSelectedToRoute}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground"
                  >
                    <Route className="w-4 h-4 inline mr-1" />
                    Add to route
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => { light(); setSelectionMode(true); }}
                  className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center"
                  title="Select multiple"
                >
                  <Check className="w-5 h-5 text-foreground" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => { light(); setShowMoreMenu((v) => !v); setShowSortMenu(false); }}
                    className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center"
                    title="More"
                  >
                    <ChevronDown className="w-5 h-5 text-foreground" />
                  </button>
                  {showMoreMenu && (
                    <>
                      <div className="fixed inset-0 z-0" onClick={() => setShowMoreMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 py-1 rounded-xl bg-popover border border-border shadow-lg z-10 min-w-[180px]">
                        {onRefresh && (
                          <button
                            onClick={handleRefresh}
                            disabled={syncing}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50"
                          >
                            <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
                            Refresh from cloud
                          </button>
                        )}
                        {exportAsJson && (
                          <button
                            onClick={handleExport}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50"
                          >
                            <Download className="w-4 h-4" />
                            Export backup
                          </button>
                        )}
                        {importFromJson && (
                          <>
                            <input
                              key={importInputKey}
                              ref={fileInputRef}
                              type="file"
                              accept=".json,application/json"
                              className="hidden"
                              onChange={handleImport}
                            />
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50"
                            >
                              <Upload className="w-4 h-4" />
                              Import backup
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-foreground" />
                </button>
              </>
            )}
          </div>
        </div>
        )}

        {/* Search */}
        <div className="px-4 py-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by title or creator…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* Filter tabs + Sort + View mode */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 shrink-0">
          {(['all', 'promos', 'posts'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { light(); setFilter(f); }}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted',
              )}
            >
              {f === 'all' ? 'All' : f === 'promos' ? 'Promos' : 'Posts'}
            </button>
          ))}
          <div className="relative ml-auto flex items-center gap-1">
            <button
              onClick={() => { light(); setShowSortMenu((v) => !v); setShowMoreMenu(false); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-muted/50 text-muted-foreground hover:bg-muted"
            >
              {SORT_OPTIONS.find((o) => o.value === sort)?.label ?? sort}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-0" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-1 py-1 rounded-xl bg-popover border border-border shadow-lg z-10 min-w-[160px]">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { light(); setSort(opt.value); setShowSortMenu(false); }}
                      className={cn(
                        'w-full px-3 py-2 text-sm text-left',
                        sort === opt.value ? 'bg-primary/20 text-primary font-medium' : 'text-foreground hover:bg-muted/50',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              onClick={() => { light(); setViewMode((v) => (v === 'grid' ? 'list' : 'grid')); }}
              className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center"
              title={viewMode === 'grid' ? 'List view' : 'Grid view'}
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Grid / List */}
        <div className="flex-1 overflow-y-auto px-2 pb-20 min-h-0">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Bookmark className="w-14 h-14 mb-4 opacity-30" />
              <p className="text-base font-medium text-foreground">No saved videos yet</p>
              <p className="text-sm mt-1">Tap the bookmark on any video to save it here</p>
              <p className="text-xs mt-3 text-muted-foreground">Saved items sync across devices when you’re signed in</p>
            </div>
          ) : noResults ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Search className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium text-foreground">No results</p>
              <p className="text-xs mt-1">Try a different search or filter</p>
              <button
                onClick={() => { setSearchQuery(''); setFilter('all'); }}
                className="mt-4 px-4 py-2 rounded-xl bg-muted text-sm font-medium"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div
              className={cn(
                viewMode === 'grid' ? 'grid grid-cols-3 gap-1' : 'flex flex-col gap-2',
              )}
            >
              {filtered.map((video) => (
                <SavedVideoCard
                  key={video.id}
                  video={video}
                  viewMode={viewMode}
                  onPlay={handlePlay}
                  onUnsave={onUnsave}
                  onAddToRoute={onAddToRoute}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(video.contentId)}
                  onToggleSelect={() => handleToggleSelect(video.contentId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full-screen player */}
      {activeVideo && activeVideoIndex !== null && (
        <SavedVideoPlayer
          video={activeVideo}
          filteredVideos={filtered}
          currentIndex={activeVideoIndex}
          likedIds={likedIds}
          onBack={() => setActiveVideoIndex(null)}
          onToggleLike={handleToggleLike}
          onComment={(id, contentType) => {
            setCommentsContentId(id);
            setCommentsContentType(contentType ?? 'user_content');
          }}
          onShare={(v) => setShareVideo(v)}
          onUnsave={handleUnsaveFromPlayer}
          onAddToRoute={onAddToRoute}
          onNavigate={handlePlayerNavigate}
        />
      )}

      <CommentsPanel
        isOpen={!!commentsContentId}
        onClose={() => setCommentsContentId(null)}
        contentId={commentsContentId || ''}
        contentType={commentsContentType}
      />

      <ShareSheet
        isOpen={!!shareVideo}
        onClose={() => setShareVideo(null)}
        contentId={shareVideo?.contentId ?? undefined}
        title={shareVideo?.title || 'Check out this content!'}
        mediaUrl={shareVideo ? (shareVideo.type === 'image' ? shareVideo.src : (shareVideo.videoSrc ?? shareVideo.src)) : undefined}
        mediaType={shareVideo?.type === 'image' ? 'image' : 'video'}
      />
    </>
  );
};

export default SavedVideosGallery;
