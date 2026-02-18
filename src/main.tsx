import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML = "<div style='padding:1rem;font-family:system-ui;'><p>App root element missing.</p><button onclick='location.reload()'>Reload</button></div>";
} else {
  try {
    createRoot(rootEl).render(<App />);
    try {
      (window as any).__iviewMarkMounted?.();
    } catch {
      // ignore
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const escaped = String(msg)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    rootEl.innerHTML = `<div style='padding:1rem;font-family:system-ui;max-width:360px;'><p><strong>Something went wrong</strong></p><p style='font-size:0.9em;color:#666;'>${escaped}</p><button onclick='location.reload()' style='margin-top:0.5rem;padding:0.5rem 1rem;'>Reload</button></div>`;
    console.error("[App] Mount error:", err);
  }
}

try {
  registerSW({ immediate: true });
} catch {
  // PWA registration failure (e.g. some mobile browsers) should not break the app
}
