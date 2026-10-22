import { afterEach, describe, expect, it, vi } from "vitest";
import { JpegEncoder } from "./JpegEncoder";

describe("JpegEncoder watermark", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws the Free watermark when enabled", async () => {
    const fillText = vi.fn();
    const context = {
      createImageData: (width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      }),
      putImageData: vi.fn(),
      save: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillText,
      restore: vi.fn(),
      globalAlpha: 1,
      fillStyle: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      font: "",
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: (callback: BlobCallback) =>
        callback(new Blob(["jpeg"], { type: "image/jpeg" })),
    };

    vi.stubGlobal("document", {
      createElement: vi.fn(() => canvas),
    });

    const page = {
      width: 100,
      height: 100,
      stride: 400,
      pixels: new Uint8Array(40000),
    };

    const result = await new JpegEncoder().encode(page, 0.9, true);

    expect(fillText).toHaveBeenCalledWith("iePDF Free", 0, 0);
    expect(result.type).toBe("image/jpeg");
  });

  it("does not draw the watermark when disabled", async () => {
    const fillText = vi.fn();
    const context = {
      createImageData: (width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      }),
      putImageData: vi.fn(),
      save: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillText,
      restore: vi.fn(),
      globalAlpha: 1,
      fillStyle: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      font: "",
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: (callback: BlobCallback) =>
        callback(new Blob(["jpeg"], { type: "image/jpeg" })),
    };

    vi.stubGlobal("document", {
      createElement: vi.fn(() => canvas),
    });

    const page = {
      width: 100,
      height: 100,
      stride: 400,
      pixels: new Uint8Array(40000),
    };

    await new JpegEncoder().encode(page, 0.9, false);

    expect(fillText).not.toHaveBeenCalled();
  });
});
