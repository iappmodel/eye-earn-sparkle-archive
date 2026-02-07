

# Make Saved Videos Gallery Fully Functional

## Overview
Transform the current "saved videos gallery" from a simple thumbnail grid with remove/route actions into a fully functional watch-later experience -- just like Instagram's saved posts. Users will be able to open, watch, like, comment on, and share any saved video directly from the gallery.

## Current State
- Tapping a thumbnail shows a basic overlay with "Remove" and "Add to Route" buttons
- No way to actually watch the saved content
- No like, comment, or share functionality inside the gallery
- Missing `videoSrc` data in saved videos (only the thumbnail image is stored)

## What Changes

### 1. Store video playback data when saving
The `SavedVideo` data model currently only stores the thumbnail URL. We need to also store the actual video/media source so it can be played back later.

- **`src/hooks/useSavedVideos.ts`**: Add `videoSrc` and `src` fields to the `SavedVideo` interface
- **`src/pages/Index.tsx`**: Pass `videoSrc` and `src` from the current media when saving a video

### 2. Redesign gallery card interactions
Change the tap/long-press behavior on thumbnail cards:

- **Tap** a thumbnail: Opens the full-screen player for that video
- **Long press** a thumbnail: Shows the quick-actions overlay (Remove, Add to Route) -- the current tap behavior moves here

### 3. Add full-screen video player inside the gallery
A new `SavedVideoPlayer` sub-component renders when a video is selected:

- Displays the video/image full-screen (reuses the same rendering approach as the main feed)
- Right-side button stack with: Like (heart), Comment, Share, Unsave (bookmark), and Add to Route (for location-based promos)
- Swipe left/right to move between saved videos without going back to the grid
- Top bar with creator info and a back arrow to return to the gallery grid
- Tap the video area to toggle play/pause

### 4. Wire up comments and sharing
- The gallery component will render its own `CommentsPanel` and `ShareSheet` instances (same components used on the main feed)
- Like state will be tracked per-video within the gallery session (stored in component state)

## Technical Details

### Files Modified

**`src/hooks/useSavedVideos.ts`**
- Add `videoSrc?: string` and `src?: string` to the `SavedVideo` interface
- No logic changes needed -- existing localStorage persistence handles the new fields automatically

**`src/pages/Index.tsx`**
- Update `handleSaveVideo` to include `videoSrc: currentMedia.videoSrc` and `src: currentMedia.src` in the save payload

**`src/components/SavedVideosGallery.tsx`** (major rewrite)
- Add `SavedVideoPlayer` sub-component with:
  - Full-screen video element (or image) with play/pause on tap
  - Interaction buttons (Like, Comment, Share, Unsave, Add to Route)
  - Header with creator avatar, name, and back button
  - Horizontal swipe navigation between saved videos
- Modify `SavedVideoCard` to:
  - Tap triggers `onPlay(video)` instead of showing the actions overlay
  - Long press (1.5s) triggers the existing actions overlay
- Import and render `CommentsPanel` and `ShareSheet` for in-gallery commenting and sharing
- Track `likedVideos` set and `activeVideoId` for comments/share state

### User Flow

```text
Gallery Grid
  |
  |-- Tap thumbnail --> Full-Screen Player
  |                       |-- Like (heart toggle)
  |                       |-- Comment (opens CommentsPanel)
  |                       |-- Share (opens ShareSheet)
  |                       |-- Unsave (removes from gallery, returns to grid)
  |                       |-- Add to Route (for promos with physical action)
  |                       |-- Swipe left/right for next/prev saved video
  |                       |-- Back arrow returns to grid
  |
  |-- Long-press thumbnail --> Quick Actions Overlay
                                |-- Remove
                                |-- Add to Route
                                |-- Cancel
```

### No new files or dependencies required
Everything builds on existing components (`CommentsPanel`, `ShareSheet`, `NeuButton`) and the existing `useSavedVideos` hook.

