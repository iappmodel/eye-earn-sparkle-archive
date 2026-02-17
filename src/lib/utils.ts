import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Detect iOS (iPhone, iPad, iPod). Used for user-gesture requirements (getUserMedia). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Dispatch cameraUserStart – call from click/tap handlers so getUserMedia runs with user gesture (iOS). */
export function dispatchCameraUserStart(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('cameraUserStart'));
  }
}
