export type PathPoint = readonly [number, number]

type LightLoopMode = "forward" | "pingpong"

function segmentLength(a: PathPoint, b: PathPoint): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

function polylineLength(points: readonly PathPoint[]): number {
  let len = 0
  for (let i = 0; i < points.length - 1; i++) {
    len += segmentLength(points[i], points[i + 1])
  }
  return len
}

function samplePolyline(
  points: readonly PathPoint[],
  distance: number,
): PathPoint {
  if (points.length === 0) return [0, 0]
  if (points.length === 1) return [points[0][0], points[0][1]]

  const total = polylineLength(points)
  if (total <= 0) return [points[0][0], points[0][1]]

  let d = ((distance % total) + total) % total
  for (let i = 0; i < points.length - 1; i++) {
    const seg = segmentLength(points[i], points[i + 1])
    if (d <= seg) {
      const t = seg > 0 ? d / seg : 0
      return [
        points[i][0] + (points[i + 1][0] - points[i][0]) * t,
        points[i][1] + (points[i + 1][1] - points[i][1]) * t,
      ]
    }
    d -= seg
  }
  const last = points[points.length - 1]
  return [last[0], last[1]]
}

/** Closed loop: home → waypoints → home. */
function buildForwardChain(
  anchor: PathPoint,
  waypoints: readonly PathPoint[],
): PathPoint[] {
  return [anchor, ...waypoints, anchor]
}

/** Out-and-back through waypoints, returning to home. */
function buildPingpongChain(
  anchor: PathPoint,
  waypoints: readonly PathPoint[],
): PathPoint[] {
  const forward = [anchor, ...waypoints]
  const backward = [...waypoints.slice(0, -1)].reverse()
  return [...forward, ...backward, anchor]
}

function parseLoopMode(loop: string): LightLoopMode {
  if (loop === "pingpong") return "pingpong"
  if (loop === "forward") return "forward"
  return "forward"
}

/**
 * Sample animated light position. `anchor` is always the path start (home);
 * `waypoints` are additional destinations only.
 */
export function sampleLightPath(
  anchor: PathPoint,
  waypoints: readonly PathPoint[],
  elapsedSeconds: number,
  speed: number,
  loop: string,
): PathPoint {
  if (waypoints.length === 0) return [anchor[0], anchor[1]]

  const mode = parseLoopMode(loop)
  const chain =
    mode === "pingpong"
      ? buildPingpongChain(anchor, waypoints)
      : buildForwardChain(anchor, waypoints)

  const total = polylineLength(chain)
  if (total <= 0) return [anchor[0], anchor[1]]

  const distance = elapsedSeconds * speed * total
  return samplePolyline(chain, distance)
}

/** Drop waypoints that sit on top of the home anchor (duplicate start points). */
export function stripAnchorDuplicateWaypoints(
  anchor: PathPoint,
  waypoints: readonly PathPoint[],
  epsilon = 0.02,
): PathPoint[] {
  return waypoints.filter(
    (p) => Math.hypot(p[0] - anchor[0], p[1] - anchor[1]) >= epsilon,
  )
}
