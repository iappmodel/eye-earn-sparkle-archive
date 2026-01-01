import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { errorTrackingService } from "@/services/errorTracking.service";
import { CURRENT_APP_VERSION } from "@/services/appVersion.service";
import { attemptChunkRecovery, isChunkLoadError } from "@/lib/chunkRecovery";
import App from "./App.tsx";
import "./index.css";

// Register PWA service worker.
// NOTE: We explicitly disable SW on Lovable preview domains to avoid stale-cache blank screens in the in-app preview/embedded contexts.
const isLovablePreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.endsWith("lovableproject.com") ||
    window.location.hostname.endsWith("lovable.app"));

const shouldEnableServiceWorker = import.meta.env.PROD && !isLovablePreviewHost;

// Proactive recovery for lazy-route chunk load failures.
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError((event as PromiseRejectionEvent).reason)) {
      void attemptChunkRecovery();
    }
  });

  window.addEventListener("error", (event) => {
    const e = event as ErrorEvent;
    if (isChunkLoadError(e.error || e.message)) {
      void attemptChunkRecovery();
    }
  });
}

if ("serviceWorker" in navigator) {
  if (shouldEnableServiceWorker) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registered:", registration.scope);
        })
        .catch((error) => {
          console.log("SW registration failed:", error);
        });
    });
  } else {
    // In preview/dev, unregister any previously-registered SW immediately to prevent caching issues.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });

    // Best-effort cache cleanup (ignore if unsupported)
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  }
}

errorTrackingService.init({ appVersion: CURRENT_APP_VERSION });

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary componentName="Root">
    <App />
  </ErrorBoundary>
);

