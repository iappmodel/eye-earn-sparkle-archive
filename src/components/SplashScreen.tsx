import React, { useState, useEffect } from 'react';
import iLogo from '@/assets/i-logo.png';

const SPLASH_KEY = 'splash_shown';
const DISPLAY_MS = 1200;
const FADE_MS = 300;

export const SplashScreen: React.FC = () => {
  const [visible, setVisible] = useState(() => {
    try {
      return !sessionStorage.getItem(SPLASH_KEY);
    } catch {
      return true;
    }
  });
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (!visible) return;

    // Remove the inline HTML splash placeholder once React has mounted
    const inlineSplash = document.getElementById('splash');
    if (inlineSplash) inlineSplash.remove();

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      // Skip animation entirely
      try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch {}
      setVisible(false);
      return;
    }

    const fadeTimer = setTimeout(() => setFadingOut(true), DISPLAY_MS);
    const removeTimer = setTimeout(() => {
      try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch {}
      setVisible(false);
    }, DISPLAY_MS + FADE_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{
        backgroundColor: '#0A0A0F',
        transition: fadingOut ? `opacity ${FADE_MS}ms ease-out, transform ${FADE_MS}ms ease-out` : undefined,
        opacity: fadingOut ? 0 : 1,
        transform: fadingOut ? 'scale(1.05)' : 'scale(1)',
      }}
    >
      {/* Radial glow backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, hsl(270 95% 65% / 0.15) 0%, transparent 60%)',
          animation: 'splash-glow-pulse 2s ease-in-out infinite',
        }}
      />

      {/* Logo container */}
      <div
        className="relative flex items-center justify-center"
        style={{
          animation: 'splash-scale-in 400ms ease-out forwards',
        }}
      >
        {/* Blur glow behind logo */}
        <div
          className="absolute w-32 h-32 rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(270 95% 65% / 0.5) 0%, hsl(320 90% 60% / 0.3) 50%, transparent 70%)',
            filter: 'blur(25px)',
          }}
        />

        {/* Logo image */}
        <img
          src={iLogo}
          alt="iView Logo"
          className="relative w-20 h-24 object-contain mix-blend-screen"
          style={{
            filter: 'drop-shadow(0 0 20px hsl(270 95% 65% / 0.6)) drop-shadow(0 0 40px hsl(320 90% 60% / 0.4))',
          }}
        />
      </div>

      {/* App name */}
      <span
        className="relative mt-4 font-display font-bold text-3xl gradient-text"
        style={{
          animation: 'splash-text-in 300ms ease-out 200ms forwards',
          opacity: 0,
        }}
      >
        iView
      </span>

      {/* Inline keyframes */}
      <style>{`
        @keyframes splash-scale-in {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes splash-text-in {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes splash-glow-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
