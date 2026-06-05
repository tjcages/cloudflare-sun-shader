# cloudflare-sun-shader

Standalone Astro site that renders the Cloudflare "sun" Unicorn Studio shader fullscreen.

The shader itself is hosted by [Unicorn Studio](https://www.unicorn.studio/) — this project simply loads the official `unicornstudio.js` runtime and mounts the project canvas (`data-us-project="hKMQx3xwg1G1DMk0IUfA"`) to fill the viewport.

## Run locally

```sh
pnpm install   # or npm install / yarn
pnpm dev
```

Then open <http://localhost:4321>.

## Build

```sh
pnpm build
pnpm preview
```

## How it works

- [src/pages/index.astro](src/pages/index.astro) — fullscreen container with the Unicorn Studio canvas element and a small inline loader script.
- [src/layouts/Layout.astro](src/layouts/Layout.astro) — minimal HTML shell with global resets so the canvas can fill the viewport edge-to-edge.

The loader checks for WebGL hardware acceleration before fetching the Unicorn Studio runtime, then calls `UnicornStudio.init()` to bind the shader to the `[data-us-project]` element.
