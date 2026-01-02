import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ShieldAlert, X, MousePointer2, Ban, RotateCcw } from 'lucide-react';

type ElementInfo = {
  el: Element;
  tag: string;
  id?: string;
  className?: string;
  zIndex?: string;
  pointerEvents?: string;
  position?: string;
  opacity?: string;
  visibility?: string;
};

const isDebuggerEl = (el: Element) => Boolean((el as HTMLElement)?.closest?.('[data-interaction-debugger]'));

const getElementInfo = (el: Element): ElementInfo => {
  const h = el as HTMLElement;
  const s = window.getComputedStyle(h);
  return {
    el,
    tag: el.tagName.toLowerCase(),
    id: h.id || undefined,
    className: typeof h.className === 'string' ? h.className : undefined,
    zIndex: s.zIndex,
    pointerEvents: s.pointerEvents,
    position: s.position,
    opacity: s.opacity,
    visibility: s.visibility,
  };
};

const pickLikelyBlocker = (infos: ElementInfo[]) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const candidates = infos
    .filter((i) => !isDebuggerEl(i.el))
    .filter((i) => i.tag !== 'html' && i.tag !== 'body')
    .filter((i) => i.pointerEvents !== 'none')
    .map((i) => {
      const r = (i.el as HTMLElement).getBoundingClientRect();
      const cover = (Math.min(r.width, vw) / vw) * (Math.min(r.height, vh) / vh);
      return { ...i, rect: r, cover };
    })
    .filter((i) => i.cover > 0.5)
    .sort((a, b) => {
      // Prefer fixed/absolute overlays with big cover
      const posScore = (p?: string) => (p === 'fixed' ? 3 : p === 'absolute' ? 2 : 0);
      const zA = Number.isFinite(Number(a.zIndex)) ? Number(a.zIndex) : 0;
      const zB = Number.isFinite(Number(b.zIndex)) ? Number(b.zIndex) : 0;
      const scoreA = a.cover * 10 + posScore(a.position) + zA / 1000;
      const scoreB = b.cover * 10 + posScore(b.position) + zB / 1000;
      return scoreB - scoreA;
    });

  return candidates[0] ?? null;
};

export const InteractionDebugger: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [stack, setStack] = useState<ElementInfo[]>([]);
  const [autoFixApplied, setAutoFixApplied] = useState(false);

  const patchedRef = useRef<Map<Element, string>>(new Map());
  const lastInteractionRef = useRef<number>(Date.now());
  const watchdogIntervalRef = useRef<number | null>(null);

  const sample = useCallback((x: number, y: number) => {
    const els = document.elementsFromPoint(x, y);
    const infos = els.map(getElementInfo);
    setLastPoint({ x, y });
    setStack(infos);
    return infos;
  }, []);

  // Auto-fix: detect and disable invisible full-screen blockers
  const autoFixBlockers = useCallback(() => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const els = document.elementsFromPoint(centerX, centerY);
    const infos = els.map(getElementInfo);
    
    let fixed = false;
    for (const info of infos) {
      if (isDebuggerEl(info.el)) continue;
      if (info.tag === 'html' || info.tag === 'body') continue;
      
      const el = info.el as HTMLElement;
      const rect = el.getBoundingClientRect();
      const coverX = rect.width / window.innerWidth;
      const coverY = rect.height / window.innerHeight;
      
      // If this element covers most of the screen and is invisible/transparent
      if (coverX > 0.8 && coverY > 0.8) {
        const opacity = parseFloat(info.opacity || '1');
        const bgColor = window.getComputedStyle(el).backgroundColor;
        const isTransparentBg = bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)';
        
        // If it's a transparent/invisible overlay blocking interactions
        if ((opacity < 0.1 || isTransparentBg) && info.pointerEvents !== 'none') {
          if (!patchedRef.current.has(el)) {
            patchedRef.current.set(el, el.style.pointerEvents || '');
          }
          el.style.pointerEvents = 'none';
          fixed = true;
          console.log('[InteractionDebugger] Auto-fixed invisible blocker:', info.tag, info.className);
        }
      }
    }
    
    if (fixed) {
      setAutoFixApplied(true);
    }
    return fixed;
  }, []);

  // Track user interactions to detect unresponsive UI
  useEffect(() => {
    const trackInteraction = () => {
      lastInteractionRef.current = Date.now();
    };

    // Listen for successful interactions (clicks that reach actual elements)
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, [role="button"]')) {
        trackInteraction();
      }
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('touchend', trackInteraction, { passive: true });

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('touchend', trackInteraction);
    };
  }, []);

  // Watchdog: if no successful interactions for 10 seconds after initial load, auto-fix
  useEffect(() => {
    // Wait for app to stabilize, then start watchdog
    const startWatchdog = () => {
      watchdogIntervalRef.current = window.setInterval(() => {
        const timeSinceInteraction = Date.now() - lastInteractionRef.current;
        
        // If it's been more than 10 seconds since last successful interaction
        // and we haven't already applied a fix, try to auto-fix
        if (timeSinceInteraction > 10000 && !autoFixApplied) {
          const fixed = autoFixBlockers();
          if (fixed) {
            console.log('[InteractionDebugger] Watchdog triggered auto-fix');
          }
        }
      }, 5000);
    };

    // Start watchdog after 5 seconds to let app initialize
    const initTimer = window.setTimeout(startWatchdog, 5000);

    return () => {
      window.clearTimeout(initTimer);
      if (watchdogIntervalRef.current) {
        window.clearInterval(watchdogIntervalRef.current);
      }
    };
  }, [autoFixApplied, autoFixBlockers]);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      // Capture what receives touches/clicks
      sample(e.clientX, e.clientY);
      lastInteractionRef.current = Date.now();
    };

    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [sample]);

  const scanCenter = useCallback(() => {
    sample(window.innerWidth / 2, window.innerHeight / 2);
  }, [sample]);

  const disableBlocker = useCallback(() => {
    const infos = stack.length ? stack : sample(window.innerWidth / 2, window.innerHeight / 2);
    const blocker = pickLikelyBlocker(infos);
    if (!blocker) return;

    const el = blocker.el as HTMLElement;
    if (!patchedRef.current.has(el)) {
      patchedRef.current.set(el, el.style.pointerEvents || '');
    }
    el.style.pointerEvents = 'none';

    // Re-scan so user immediately sees updated stack
    sample(window.innerWidth / 2, window.innerHeight / 2);
  }, [sample, stack]);

  const reset = useCallback(() => {
    for (const [el, prev] of patchedRef.current.entries()) {
      (el as HTMLElement).style.pointerEvents = prev;
    }
    patchedRef.current.clear();
    setAutoFixApplied(false);
    scanCenter();
  }, [scanCenter]);

  const top = useMemo(() => stack[0], [stack]);

  return (
    <div data-interaction-debugger className="fixed left-3 top-3 z-[2147483647]">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            scanCenter();
          }}
          className={cn(
            'pointer-events-auto',
            'rounded-full border border-border/50 bg-background/80 backdrop-blur-md',
            'shadow-lg',
            'h-10 px-3 flex items-center gap-2',
            'text-xs text-foreground',
            autoFixApplied && 'ring-2 ring-amber-500'
          )}
        >
          <ShieldAlert className="h-4 w-4 text-primary" />
          Debug
          {autoFixApplied && <span className="text-amber-500">•</span>}
        </button>
      ) : (
        <div
          className={cn(
            'pointer-events-auto w-[320px] max-w-[calc(100vw-24px)]',
            'rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl shadow-2xl',
            'overflow-hidden'
          )}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Interaction Debug</span>
              {autoFixApplied && (
                <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded">
                  Auto-fixed
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="secondary" size="sm" onClick={scanCenter} className="gap-2">
                <MousePointer2 className="h-4 w-4" />
                Scan center
              </Button>
              <Button variant="secondary" size="sm" onClick={disableBlocker} className="gap-2">
                <Ban className="h-4 w-4" />
                Disable blocker
              </Button>
              <Button variant="ghost" size="sm" onClick={reset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>

            <div className="rounded-xl bg-muted/30 border border-border/50 p-2">
              <div className="text-xs text-muted-foreground">Top receiver</div>
              <div className="text-xs font-medium break-words">
                {top ? `${top.tag}${top.id ? `#${top.id}` : ''}${top.className ? `.${top.className.split(' ')[0]}` : ''}` : '—'}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                z: {top?.zIndex ?? '—'} • pe: {top?.pointerEvents ?? '—'} • pos: {top?.position ?? '—'}
              </div>
              {lastPoint && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  last tap: {Math.round(lastPoint.x)}, {Math.round(lastPoint.y)}
                </div>
              )}
            </div>

            <details className="rounded-xl border border-border/50 bg-background/40 p-2">
              <summary className="text-xs cursor-pointer select-none">Element stack</summary>
              <div className="mt-2 space-y-1 max-h-40 overflow-auto">
                {stack.slice(0, 12).map((i, idx) => (
                  <div key={idx} className="text-[11px] text-muted-foreground break-words">
                    {idx + 1}. {i.tag}
                    {i.id ? `#${i.id}` : ''}
                    {i.className ? `.${i.className.split(' ')[0]}` : ''}
                    {'  '}• z:{i.zIndex} • pe:{i.pointerEvents}
                  </div>
                ))}
              </div>
            </details>

            <p className="text-[11px] text-muted-foreground">
              If the app is "dead", it's usually a full-screen overlay. "Disable blocker" turns off pointer-events for the most likely overlay (this session only). Auto-fix runs if no interactions detected for 10s.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractionDebugger;
