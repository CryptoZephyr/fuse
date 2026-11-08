import type { FuseWidgetMessage } from "mezo-fuse";

export function postToHost(message: FuseWidgetMessage): void {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage(message, "*");
}
