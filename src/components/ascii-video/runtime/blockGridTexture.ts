import { Texture } from "pixi.js";
import type { BlockGrid } from "./computeBlockGrid";
import { encodeStripeIndex, STRIPE_CELL_SIZE } from "./stripeGridConstants";

export class BlockGridTexture {
  readonly cols: number;
  readonly rows: number;
  readonly texture: Texture;
  readonly colorTexture: Texture;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly imageData: ImageData;
  private readonly colorCanvas: HTMLCanvasElement;
  private readonly colorCtx: CanvasRenderingContext2D;
  private readonly colorImageData: ImageData;

  constructor(displayWidth: number, displayHeight: number) {
    this.cols = Math.ceil(displayWidth / STRIPE_CELL_SIZE);
    this.rows = Math.ceil(displayHeight / STRIPE_CELL_SIZE);
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.cols;
    this.canvas.height = this.rows;
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("2D canvas context unavailable for block grid texture.");
    }
    this.ctx = ctx;
    this.imageData = ctx.createImageData(this.cols, this.rows);
    this.texture = Texture.from(this.canvas);
    // Nearest: stop linear bleed between band cells.
    this.texture.source.scaleMode = "nearest";

    this.colorCanvas = document.createElement("canvas");
    this.colorCanvas.width = this.cols;
    this.colorCanvas.height = this.rows;
    const colorCtx = this.colorCanvas.getContext("2d", { willReadFrequently: true });
    if (!colorCtx) {
      throw new Error("2D canvas context unavailable for block grid color texture.");
    }
    this.colorCtx = colorCtx;
    this.colorImageData = colorCtx.createImageData(this.cols, this.rows);
    this.colorTexture = Texture.from(this.colorCanvas);
    this.colorTexture.source.scaleMode = "nearest";
  }

  update(grid: BlockGrid) {
    if (grid.cols !== this.cols || grid.rows !== this.rows) {
      return;
    }

    const out = this.imageData.data;
    const colorOut = this.colorImageData.data;
    for (let i = 0; i < grid.indices.length; i++) {
      const col = i % grid.cols;
      const row = Math.floor(i / grid.cols);
      // Canvas row 0 is top; WebGL samples v=0 from the bottom — store rows flipped.
      const destRow = grid.rows - 1 - row;
      const destIndex = destRow * grid.cols + col;
      const encoded = encodeStripeIndex(grid.indices[i] ?? 0);
      const offset = destIndex * 4;
      out[offset] = encoded;
      out[offset + 1] = encoded;
      out[offset + 2] = encoded;
      out[offset + 3] = 255;

      const colorOffset = i * 3;
      colorOut[offset] = grid.colors?.[colorOffset] ?? 0;
      colorOut[offset + 1] = grid.colors?.[colorOffset + 1] ?? 0;
      colorOut[offset + 2] = grid.colors?.[colorOffset + 2] ?? 0;
      colorOut[offset + 3] = 255;
    }

    this.ctx.putImageData(this.imageData, 0, 0);
    this.colorCtx.putImageData(this.colorImageData, 0, 0);
    this.texture.source.update();
    this.colorTexture.source.update();
  }

  destroy() {
    this.texture.destroy(true);
    this.colorTexture.destroy(true);
  }
}
