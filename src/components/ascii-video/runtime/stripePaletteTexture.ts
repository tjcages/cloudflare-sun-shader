import { Texture } from "pixi.js";
import { STRIPE_MAX_WIDTH_PX } from "./stripeGridConstants";
import type { StripePaletteEntry } from "./stripes";

const PALETTE_HEIGHT = 2;

function toByte(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 255);
}

/**
 * Small data texture feeding the stripe shader: width = stripe count, height = 2.
 * Canvas row 0 = color (RGB, alpha 255), row 1 = width (R = width / STRIPE_MAX_WIDTH_PX).
 */
export class StripePaletteTexture {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  texture: Texture;
  count: number;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1;
    this.canvas.height = PALETTE_HEIGHT;
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("2D canvas context unavailable for stripe palette texture.");
    }
    this.ctx = ctx;
    this.count = 0;
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = "nearest";
  }

  update(palette: readonly StripePaletteEntry[]) {
    const width = Math.max(1, palette.length);
    if (width !== this.canvas.width) {
      this.canvas.width = width;
      this.texture.destroy(true);
      this.texture = Texture.from(this.canvas);
      this.texture.source.scaleMode = "nearest";
    }
    this.count = palette.length;

    const image = this.ctx.createImageData(width, PALETTE_HEIGHT);
    const data = image.data;
    for (let i = 0; i < width; i++) {
      const entry = palette[i];
      const colorOffset = i * 4;
      const widthOffset = (width + i) * 4;
      if (entry) {
        data[colorOffset] = toByte(entry.rgb[0]);
        data[colorOffset + 1] = toByte(entry.rgb[1]);
        data[colorOffset + 2] = toByte(entry.rgb[2]);
        data[widthOffset] = toByte(entry.width / STRIPE_MAX_WIDTH_PX);
      }
      data[colorOffset + 3] = 255;
      data[widthOffset + 3] = 255;
    }

    this.ctx.putImageData(image, 0, 0);
    this.texture.source.update();
  }

  destroy() {
    this.texture.destroy(true);
  }
}
