import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const isHTMLElement = (el: Element | null): el is HTMLElement =>
  Boolean(el) && el instanceof HTMLElement;

const coversViewport = (el: HTMLElement, threshold = 0.85) => {
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  const cover = (Math.min(r.width, vw) / vw) * (Math.min(r.height, vh) / vh);
  return cover >= threshold;
};

const parseBlurPx = (filter: string) => {
  const m = filter?.match?.(/blur\(([-0-9.]+)px\)/i);
  if (!m?.[1]) return 0;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : 0;
};

const forceVisible = (el: HTMLElement, reason: string) => {
  // Only override minimal properties needed to make the UI paint again.
  el.style.opacity = "1";
  el.style.visibility = "visible";
  
  // Fix global pointer-events blocking on body/root
  if (el.tagName === "BODY" || el.id === "root") {
    if (el.style.pointerEvents === "none") {
      el.style.pointerEvents = "";
      console.warn("[RenderWatchdog] Removed pointer-events:none from", el.tagName || el.id);
    }
    // Fix stuck overflow hidden (scroll lock)
    if (el.style.overflow === "hidden") {
      el.style.overflow = "";
      console.warn("[RenderWatchdog] Removed overflow:hidden from", el.tagName || el.id);
    }
  }

  // Extreme filters can make the app appear blank even though it renders.
  const computed = window.getComputedStyle(el);
  const blurPx = parseBlurPx(computed.filter);
  if (blurPx >= 30 || computed.filter === "brightness(0)" || computed.filter === "contrast(0)") {
    el.style.filter = "none";
  }

  // backdrop-filter can also hide everything behind it.
  const backdrop = (computed as any).backdropFilter as string | undefined;
  const backdropBlur = parseBlurPx(backdrop || "");
  if (backdropBlur >= 30) {
    (el.style as any).backdropFilter = "none";
  }

  console.warn("[RenderWatchdog] Forced element visible", {
    reason,
    tag: el.tagName.toLowerCase(),
    id: el.id || undefined,
    className: el.className || undefined,
  });
};

/**
 * RenderWatchdog
 * Fixes the class of issues where React rendered, but the UI is effectively invisible (opacity/visibility/filter stuck).
 * This does not change business logic; it only corrects broken visual state.
 */
export const RenderWatchdog = () => {
  const location = useLocation();

  useEffect(() => {
    const run = () => {
      try {
        // Check body for global blocking
        const body = document.body;
        if (body) {
          const bs = window.getComputedStyle(body);
          if (bs.pointerEvents === "none") {
            body.style.pointerEvents = "";
            console.warn("[RenderWatchdog] Fixed body pointer-events:none");
          }
        }

        const root = document.getElementById("root");
        if (isHTMLElement(root)) {
          const s = window.getComputedStyle(root);
          const opacity = Number.parseFloat(s.opacity || "1");
          if (opacity < 0.05 || s.visibility === "hidden") {
            forceVisible(root, "root_hidden");
            return;
          }
          // Check root for pointer-events blocking
          if (s.pointerEvents === "none") {
            root.style.pointerEvents = "";
            console.warn("[RenderWatchdog] Fixed root pointer-events:none");
          }
        }

        // If the element receiving pointer events is a full-viewport layer that is invisible,
        // force it visible so the UI paints again.
        const x = window.innerWidth / 2;
        const y = window.innerHeight / 2;
        const stack = document.elementsFromPoint(x, y);
        for (const el of stack) {
          if (!isHTMLElement(el)) continue;
          if (el.id === "root") continue;
          const s = window.getComputedStyle(el);
          const opacity = Number.parseFloat(s.opacity || "1");

          // Consider it "invisible" if it's near-transparent or hidden, yet still present.
          const isInvisible = opacity < 0.05 || s.visibility === "hidden";
          if (!isInvisible) continue;

          // Only intervene for fullscreen-ish layers (the common blank-screen case).
          if (!coversViewport(el)) continue;

          forceVisible(el, "fullscreen_invisible_layer");
          return;
        }
      } catch (e) {
        console.warn("[RenderWatchdog] Failed to run", e);
      }
    };

    const schedule = (ms: number) =>
      window.setTimeout(() => {
        const ric = (window as any).requestIdleCallback as
          | ((cb: () => void, opts?: { timeout?: number }) => void)
          | undefined;
        if (typeof ric === "function") {
          ric(run, { timeout: 600 });
          return;
        }
        window.requestAnimationFrame(run);
      }, ms);

    // Run twice: shortly after route change, and again as a fail-open.
    const t1 = schedule(650);
    const t2 = schedule(1800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [location.key]);

  return null;
};

export default RenderWatchdog;
