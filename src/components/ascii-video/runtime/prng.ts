const hashSeed = (seed: string) => {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

export type Prng = {
  next: () => number;
  integer: (min: number, max: number) => number;
  chance: (probability: number) => boolean;
};

export const createPrng = (seed: string): Prng => {
  let state = hashSeed(seed) || 1;

  const next = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    integer: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    chance: (probability) => next() < probability,
  };
};

export const shuffleWithPrng = <T>(items: T[], prng: Prng): T[] => {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = prng.integer(0, index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
};
