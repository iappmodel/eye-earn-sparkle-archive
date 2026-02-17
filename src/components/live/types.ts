/** UI shape for live stream card and viewer (shared by LiveFeed and LiveStreamViewer). */
export interface LiveStreamUI {
  id: string;
  hostId: string;
  hostUsername: string;
  hostAvatarUrl?: string;
  title: string;
  viewerCount: number;
  thumbnailUrl: string;
  isLive: boolean;
}
