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
  const [autoFixCount, setAutoFixCount] = useState(0);

  const patchedRef = useRef<Map<Element, string>>(new Map());

  // Attempts are pointerdowns anywhere (user is trying).
  // "Successful" interactions are events that reach interactive controls.
  // If there are repeated attempts but no successful interactions, a full-screen blocker is likely.
  const attemptedInteractionsRef = useRef(0);
  const lastSuccessfulInteractionRef = useRef<number>(Date.now());
  const lastAutoFixAtRef = useRef<number>(0);
  const lastTapRef = useRef<{ x: number; y: number } | null>(null);
  const watchdogIntervalRef = useRef<number | null>(null);

  const interactiveSelector =
    'button, a, input, textarea, select, [role="button"], [role="link"], [data-no-swipe], [data-draggable], [data-interactive="true"]';

  const markSuccessfulInteraction = useCallback(() => {
    lastSuccessfulInteractionRef.current = Date.now();
    attemptedInteractionsRef.current = 0;
  }, []);

  const sample = useCallback((x: number, y: number) => {
    const els = document.elementsFromPoint(x, y);
    const infos = els.map(getElementInfo);
    setLastPoint({ x, y });
    setStack(infos);
    lastTapRef.current = { x, y };
    return infos;
  }, []);

  const parseAlpha = (color: string) => {
    if (!color) return 1;
    if (color === 'transparent') return 0;
    const m = color.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)/i);
    if (m?.[1]) return Number(m[1]);
    return 1;
  };

  // Auto-fix: disable pointer events for full-screen blockers that look closed/invisible.
  const autoFixBlockers = useCallback(() => {
    const point = lastTapRef.current ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const els = document.elementsFromPoint(point.x, point.y);
    const infos = els.map(getElementInfo);

    let fixed = false;

    for (const info of infos) {
      if (isDebuggerEl(info.el)) continue;
      if (info.tag === 'html' || info.tag === 'body') continue;

      const el = info.el as HTMLElement;
      const rect = el.getBoundingClientRect();
      const coverX = rect.width / window.innerWidth;
      const coverY = rect.height / window.innerHeight;

      // Only target near-fullscreen overlays.
      if (coverX < 0.8 || coverY < 0.8) continue;
      if (info.pointerEvents === 'none') continue;

      const s = window.getComputedStyle(el);
      const opacity = parseFloat(s.opacity || '1');
      const bgAlpha = parseAlpha(s.backgroundColor);

      const dataState = el.getAttribute('data-state');
      const ariaHidden = el.getAttribute('aria-hidden');

      const looksClosed = dataState === 'closed' || dataState === 'closing' || ariaHidden === 'true';
      const looksInvisible = opacity < 0.05 || s.visibility === 'hidden' || bgAlpha < 0.03;

      if (looksClosed || looksInvisible) {
        if (!patchedRef.current.has(el)) {
          patchedRef.current.set(el, el.style.pointerEvents || '');
        }
        el.style.pointerEvents = 'none';
        fixed = true;
        console.log('[InteractionDebugger] Auto-fixed blocker:', info.tag, info.className, {
          dataState,
          ariaHidden,
          opacity,
          bgAlpha,
          pointerEvents: info.pointerEvents,
        });
      }
    }

    if (fixed) {
      setAutoFixCount((c) => c + 1);
      lastAutoFixAtRef.current = Date.now();
      // refresh stack so it's obvious something changed
      sample(point.x, point.y);
    }

    return fixed;
  }, [sample]);

  // Pre-emptive cleanup: clear stale/closed fullscreen overlays left behind after navigation/render errors.
  useEffect(() => {
    const t = window.setTimeout(() => {
      autoFixBlockers();
    }, 1200);

    return () => window.clearTimeout(t);
  }, [autoFixBlockers]);

  // Track *successful* interactions only.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(interactiveSelector)) {
        markSuccessfulInteraction();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(interactiveSelector)) {
        markSuccessfulInteraction();
      }
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('touchend', onTouchEnd, true);

    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('touchend', onTouchEnd, true);
    };
  }, [markSuccessfulInteraction]);

  // Track attempts + capture what receives the event.
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      attemptedInteractionsRef.current += 1;
      sample(e.clientX, e.clientY);
    };

    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [sample]);

  // Watchdog: if user keeps tapping but nothing interactive is being reached, try to auto-fix.
  useEffect(() => {
    const startWatchdog = () => {
      watchdogIntervalRef.current = window.setInterval(() => {
        const now = Date.now();
        const attempts = attemptedInteractionsRef.current;
        const sinceSuccess = now - lastSuccessfulInteractionRef.current;
        const sinceAutoFix = now - lastAutoFixAtRef.current;

        if (attempts >= 3 && sinceSuccess > 4000 && sinceAutoFix > 4000) {
          const fixed = autoFixBlockers();
          if (fixed) {
            attemptedInteractionsRef.current = 0;
            console.log('[InteractionDebugger] Watchdog triggered auto-fix');
          }
        }
      }, 1500);
    };

    const initTimer = window.setTimeout(startWatchdog, 2500);

    return () => {
      window.clearTimeout(initTimer);
      if (watchdogIntervalRef.current) window.clearInterval(watchdogIntervalRef.current);
    };
  }, [autoFixBlockers]);

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
    setAutoFixCount(0);
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
            autoFixBlockers();
            scanCenter();
          }}
          className={cn(
            'pointer-events-auto',
            'rounded-full border border-border/50 bg-background/80 backdrop-blur-md',
            'shadow-lg',
            'h-10 px-3 flex items-center gap-2',
            'text-xs text-foreground',
            autoFixCount > 0 && 'ring-2 ring-primary/40'
          )}
        >
          <ShieldAlert className="h-4 w-4 text-primary" />
          Debug
          {autoFixCount > 0 && <span className="text-primary">•</span>}
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
              {autoFixCount > 0 && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  Auto-fixed{autoFixCount > 1 ? ` ×${autoFixCount}` : ''}
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  autoFixBlockers();
                  disableBlocker();
                }}
                className="gap-2"
              >
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
                {top
                  ? `${top.tag}${top.id ? `#${top.id}` : ''}${top.className ? `.${top.className.split(' ')[0]}` : ''}`
                  : '—'}
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
              If the app feels "dead", it’s usually a full-screen overlay. Auto-fix triggers after a few taps that don’t reach any real button/link.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};


export default InteractionDebugger;
