import { describe, expect, it } from "vitest";
import { FUSE_WIDGET_MESSAGE_SOURCE } from "mezo-fuse";
import { acceptWidgetMessage } from "./hostMessages";

const frameWindow = {};
const widgetOrigin = "https://fuse.vercel.app";
const data = {
  source: FUSE_WIDGET_MESSAGE_SOURCE,
  version: 1,
  type: "account",
  address: null,
  chainId: null,
};

describe("acceptWidgetMessage", () => {
  it("accepts a valid message from the widget frame and origin", () => {
    expect(
      acceptWidgetMessage(
        { origin: widgetOrigin, source: frameWindow, data },
        { widgetOrigin, frameWindow },
      ),
    ).toEqual(data);
  });

  it("rejects a message from another origin", () => {
    expect(
      acceptWidgetMessage(
        { origin: "https://other.example", source: frameWindow, data },
        { widgetOrigin, frameWindow },
      ),
    ).toBeNull();
  });

  it("rejects a message from another frame", () => {
    expect(
      acceptWidgetMessage(
        { origin: widgetOrigin, source: {}, data },
        { widgetOrigin, frameWindow },
      ),
    ).toBeNull();
  });

  it("rejects malformed data from the expected frame", () => {
    expect(
      acceptWidgetMessage(
        {
          origin: widgetOrigin,
          source: frameWindow,
          data: { source: FUSE_WIDGET_MESSAGE_SOURCE, version: 1, type: "other" },
        },
        { widgetOrigin, frameWindow },
      ),
    ).toBeNull();
  });
});
