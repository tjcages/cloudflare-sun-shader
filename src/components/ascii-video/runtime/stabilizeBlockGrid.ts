/**
 * Limit stripe-index changes to one step per update so colors do not snap frame to frame.
 * Indices are contiguous (0 = background, 1…N), so a single-step move is a neighbor stripe.
 */
export function smoothBlockGridIndices(next: Uint8Array, previous: Uint8Array | undefined): Uint8Array {
  if (!previous || previous.length !== next.length) {
    return new Uint8Array(next);
  }

  const out = new Uint8Array(next.length);
  for (let i = 0; i < next.length; i++) {
    const prev = previous[i] ?? 0;
    const target = next[i] ?? 0;
    if (target > prev) {
      out[i] = prev + 1;
    } else if (target < prev) {
      out[i] = prev - 1;
    } else {
      out[i] = prev;
    }
  }

  return out;
}
