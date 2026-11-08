import type { FuseWidgetMessage } from "mezo-fuse";

export function isCrossOriginFrame(): boolean {
  if (typeof window === "undefined" || window.parent === window) return false;
  try {
    return window.top?.location.origin !== window.location.origin;
  } catch {
    return true;
  }
}

export function postToHost(message: FuseWidgetMessage): void {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage(message, "*");
}
