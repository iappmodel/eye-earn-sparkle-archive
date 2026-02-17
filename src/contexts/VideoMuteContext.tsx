// Global video mute state – shared across all video players (MediaCard, FriendsPostsFeed, PromoVideosFeed, etc.)
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'visuai-video-muted';

interface VideoMuteContextType {
  /** Whether video audio is muted */
  isMuted: boolean;
  /** Toggle mute on/off */
  toggleMute: () => void;
  /** Set mute state explicitly */
  setMuted: (muted: boolean) => void;
}

const VideoMuteContext = createContext<VideoMuteContextType | null>(null);

function loadStoredMute(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'true';
  } catch {
    return true; // default: muted (common for social feeds)
  }
}

function saveMute(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(muted));
  } catch {
    // ignore
  }
}

export function VideoMuteProvider({ children }: { children: React.ReactNode }) {
  const [isMuted, setIsMutedState] = useState(loadStoredMute);

  const setMuted = useCallback((muted: boolean) => {
    setIsMutedState(muted);
    saveMute(muted);
    window.dispatchEvent(new CustomEvent('mediaMuteChanged', { detail: { muted } }));
  }, []);

  const toggleMute = useCallback(() => {
    setIsMutedState((prev) => {
      const next = !prev;
      saveMute(next);
      window.dispatchEvent(new CustomEvent('mediaMuteChanged', { detail: { muted: next } }));
      return next;
    });
  }, []);

  // Sync with legacy mediaToggleMute event (gesture combos, remote control)
  useEffect(() => {
    const handler = () => toggleMute();
    window.addEventListener('mediaToggleMute', handler);
    return () => window.removeEventListener('mediaToggleMute', handler);
  }, [toggleMute]);

  return (
    <VideoMuteContext.Provider value={{ isMuted, toggleMute, setMuted }}>
      {children}
    </VideoMuteContext.Provider>
  );
}

export function useVideoMute() {
  const ctx = useContext(VideoMuteContext);
  if (!ctx) {
    return {
      isMuted: true,
      toggleMute: () => {},
      setMuted: () => {},
    };
  }
  return ctx;
}
