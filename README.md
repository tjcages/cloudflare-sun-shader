# cloudflare-sun-shader

Standalone, fullscreen rendering of the custom Cloudflare "accent" sun shader — extracted from the [`feat/accent-shader`](https://github.com/cloudflare/cloudflare/tree/feat/accent-shader) branch of the main marketing site and packaged as a Cloudflare Workers site.

Live: <https://cloudflare-sun-shader.ty-944.workers.dev>

## What's inside

- **Astro + React island** — single page, single component, no chrome
- **Custom GLSL fragment shader** ([src/components/accent-shader-fragment.ts](src/components/accent-shader-fragment.ts)) — wisp/dot field with bolt accents, shimmer, bloom, heat haze, and a mouse-reveal halo
- **`@paper-design/shaders` ShaderMount runtime** — adaptive pixel budget, three quality tiers, RAF-based mouse smoothing
- **Static-only Worker** — `worker/index.ts` is just `env.ASSETS.fetch(request)`; the heavy lifting is the static bundle

## Run locally

```sh
pnpm install
pnpm dev          # Astro dev server (http://localhost:4321)
```

## Build + preview as a Worker

```sh
pnpm build        # → ./dist
pnpm preview      # wrangler dev (Worker + static assets)
```

## Deploy to Cloudflare

```sh
pnpm deploy       # astro build && wrangler deploy
```

`wrangler.jsonc` pins the deploy to the `Off brand` account (`944ca70087298faa2e84783db46162c5`). Change `account_id` to redeploy elsewhere.

## Source files

| Path | What it is |
| --- | --- |
| [src/components/accent-shader.tsx](src/components/accent-shader.tsx) | React mount + quality tiers + mouse reveal loop |
| [src/components/accent-shader-config.ts](src/components/accent-shader-config.ts) | Default uniforms + config → uniform mapper |
| [src/components/accent-shader-fragment.ts](src/components/accent-shader-fragment.ts) | GLSL fragment source (the actual shader) |
| [src/lib/shader-pixel-budget.ts](src/lib/shader-pixel-budget.ts) | Pixel-count ceiling for high-DPR screens |
| [src/hooks/use-in-view.ts](src/hooks/use-in-view.ts) | IntersectionObserver hook — pauses the shader when offscreen |
| [worker/index.ts](worker/index.ts) | Trivial Worker that defers everything to the static-assets binding |
