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

  const patchedRef = useRef<Map<Element, string>>(new Map());

  const sample = useCallback((x: number, y: number) => {
    const els = document.elementsFromPoint(x, y);
    const infos = els.map(getElementInfo);
    setLastPoint({ x, y });
    setStack(infos);
    return infos;
  }, []);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      // Capture what receives touches/clicks
      sample(e.clientX, e.clientY);
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
            'text-xs text-foreground'
          )}
        >
          <ShieldAlert className="h-4 w-4 text-primary" />
          Debug
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
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2">
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
              If the app is “dead”, it’s usually a full-screen overlay. “Disable blocker” turns off pointer-events for the most likely overlay (this session only).
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractionDebugger;
