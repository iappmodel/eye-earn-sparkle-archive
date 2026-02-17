import React, { useState, useCallback } from 'react';
import {
  Bookmark,
  X,
  Heart,
  MapPin,
  Route,
  Trash2,
  Map,
  ChevronRight,
  Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { SavedVideo } from '@/hooks/useSavedVideos';
import type { RouteStop } from '@/hooks/usePromoRoute';
import { SavedVideosGallery } from '@/components/SavedVideosGallery';
import { toast } from 'sonner';

export type BookmarksTab = 'saved' | 'watch-later' | 'liked';

interface BookmarksScreenProps {
  isOpen: boolean;
  onClose: () => void;
  /** Saved videos (watch later from feed) */
  savedVideos: SavedVideo[];
  onUnsave: (contentId: string) => void;
  onUnsaveMany?: (contentIds: string[]) => void;
  onAddToRoute?: (video: SavedVideo) => void;
  savedSyncing?: boolean;
  onSavedRefresh?: () => Promise<void>;
  exportSavedAsJson?: () => string;
  importSavedFromJson?: (json: string) => { imported: number; skipped: number; errors: string[] };
  /** Promo "watch later" list (for route building) */
  watchLater: RouteStop[];
  onRemoveFromWatchLater: (promotionId: string) => void;
  onBuildRouteFromWatchLater: () => void;
  onOpenMap?: () => void;
  /** Liked content count */
  likedCount: number;
  onOpenFeed?: () => void;
}

const TAB_CONFIG: { id: BookmarksTab; label: string; icon: React.ReactNode }[] = [
  { id: 'saved', label: 'Saved', icon: <Bookmark className="w-4 h-4" /> },
  { id: 'watch-later', label: 'Watch Later', icon: <MapPin className="w-4 h-4" /> },
  { id: 'liked', label: 'Liked', icon: <Heart className="w-4 h-4" /> },
];

export const BookmarksScreen: React.FC<BookmarksScreenProps> = ({
  isOpen,
  onClose,
  savedVideos,
  onUnsave,
  onUnsaveMany,
  onAddToRoute,
  savedSyncing = false,
  onSavedRefresh,
  exportSavedAsJson,
  importSavedFromJson,
  watchLater,
  onRemoveFromWatchLater,
  onBuildRouteFromWatchLater,
  onOpenMap,
  likedCount,
  onOpenFeed,
}) => {
  const { light } = useHapticFeedback();
  const [activeTab, setActiveTab] = useState<BookmarksTab>('saved');

  const getTabCount = useCallback(
    (tab: BookmarksTab) => {
      switch (tab) {
        case 'saved':
          return savedVideos.length;
        case 'watch-later':
          return watchLater.length;
        case 'liked':
          return likedCount;
        default:
          return 0;
      }
    },
    [savedVideos.length, watchLater.length, likedCount],
  );

  const totalBookmarksCount = savedVideos.length + watchLater.length + likedCount;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Bookmark className="w-5 h-5 text-primary fill-primary shrink-0" />
          <h1 className="text-lg font-semibold text-foreground truncate">Bookmarks</h1>
          {totalBookmarksCount > 0 && (
            <span className="text-sm text-muted-foreground shrink-0">({totalBookmarksCount})</span>
          )}
        </div>
        <button
          onClick={() => {
            light();
            onClose();
          }}
          className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-border/50 px-2">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              light();
              setActiveTab(tab.id);
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {getTabCount(tab.id) > 0 && (
              <span
                className={cn(
                  'min-w-[18px] h-5 px-1.5 rounded-full flex items-center justify-center text-xs font-medium',
                  activeTab === tab.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {getTabCount(tab.id) > 99 ? '99+' : getTabCount(tab.id)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === 'saved' && (
          <SavedVideosGallery
            isOpen={true}
            onClose={onClose}
            savedVideos={savedVideos}
            onUnsave={onUnsave}
            onAddToRoute={onAddToRoute}
            onUnsaveMany={onUnsaveMany}
            syncing={savedSyncing}
            onRefresh={onSavedRefresh}
            exportAsJson={exportSavedAsJson}
            importFromJson={importSavedFromJson}
            embedded
          />
        )}

        {activeTab === 'watch-later' && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Actions bar */}
            {watchLater.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-4 border-b border-border/50 shrink-0">
                <button
                  onClick={() => {
                    light();
                    onBuildRouteFromWatchLater();
                    onClose();
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
                >
                  <Route className="w-4 h-4" />
                  Build route from list
                </button>
                {onOpenMap && (
                  <button
                    onClick={() => {
                      light();
                      onOpenMap();
                      onClose();
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors"
                  >
                    <Map className="w-4 h-4" />
                    Open map
                  </button>
                )}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 pb-24">
              {watchLater.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[240px] text-center text-muted-foreground">
                  <MapPin className="w-14 h-14 mb-4 opacity-30" />
                  <p className="text-base font-medium text-foreground">No promos in Watch Later</p>
                  <p className="text-sm mt-1">
                    When viewing a promo with a location, tap &quot;Save for later&quot; to add it here. Then build a route to visit them.
                  </p>
                  {onOpenMap && (
                    <button
                      onClick={() => {
                        light();
                        onOpenMap();
                        onClose();
                      }}
                      className="mt-6 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm"
                    >
                      <Map className="w-4 h-4" />
                      Discover on map
                    </button>
                  )}
                </div>
              ) : (
                <ul className="space-y-3">
                  {watchLater.map((item) => (
                    <li
                      key={item.promotionId}
                      className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Coins className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.businessName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          +{item.rewardAmount} {item.rewardType}
                          {item.address && ` · ${item.address}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            light();
                            onRemoveFromWatchLater(item.promotionId);
                            toast.success('Removed from Watch Later');
                          }}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {onOpenMap && (
                          <button
                            onClick={() => {
                              light();
                              onOpenMap();
                              onClose();
                            }}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            aria-label="Open map"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === 'liked' && (
          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-center">
            <Heart className="w-16 h-16 text-primary/50 mb-4" />
            <h2 className="text-lg font-semibold text-foreground">
              {likedCount === 0 ? 'No liked posts yet' : `${likedCount} liked ${likedCount === 1 ? 'post' : 'posts'}`}
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              {likedCount === 0
                ? 'Tap the heart on any video to like it. Your likes are saved and synced across devices.'
                : 'Your liked content is saved. It can appear in your personalized feed and recommendations.'}
            </p>
            {onOpenFeed && (
              <button
                onClick={() => {
                  light();
                  onOpenFeed();
                  onClose();
                }}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm"
              >
                Open feed
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
