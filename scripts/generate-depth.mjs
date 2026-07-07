/**
 * Precompute a depth map PNG for an image using Depth Anything V2 (small).
 *
 * Usage: node scripts/generate-depth.mjs public/profiles/michelle-zatlyn.jpg
 * Writes <input-basename>-depth.png next to the input.
 *
 * The /profiles page runs the exact same model in the browser for uploads —
 * this script just bakes the default image's depth so the page loads instantly.
 */
import { pipeline } from "@huggingface/transformers"
import path from "node:path"

const input = process.argv[2]
if (!input) {
  console.error("Usage: node scripts/generate-depth.mjs <image-path>")
  process.exit(1)
}

console.log("Loading Depth Anything V2 small…")
const estimator = await pipeline(
  "depth-estimation",
  "onnx-community/depth-anything-v2-small",
)

console.log(`Estimating depth for ${input}…`)
const { depth } = await estimator(input)

const out = path.join(
  path.dirname(input),
  `${path.basename(input, path.extname(input))}-depth.png`,
)
await depth.save(out)
console.log(`Wrote ${out} (${depth.width}x${depth.height})`)
