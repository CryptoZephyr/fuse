import {
  parseFuseWidgetMessage,
  type FuseWidgetMessage,
} from "mezo-fuse";

export interface WidgetMessageEvent {
  origin: string;
  source: unknown;
  data: unknown;
}

export interface WidgetMessageContext {
  widgetOrigin: string;
  frameWindow: unknown;
}

export function acceptWidgetMessage(
  event: WidgetMessageEvent,
  { widgetOrigin, frameWindow }: WidgetMessageContext,
): FuseWidgetMessage | null {
  if (event.origin !== widgetOrigin || event.source !== frameWindow) return null;
  return parseFuseWidgetMessage(event.data);
}
