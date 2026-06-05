/** GLSL fragment source — tunables are `u_*` uniforms (see `_accent-shader-config.ts`). */
export const ACCENT_SHADER_FRAGMENT = /* glsl */ `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_mouse;
uniform float u_mouseStrength;

uniform vec3 u_bg;
uniform float u_driftSpeed;
uniform float u_cellSize;
uniform float u_wispStretch;
uniform float u_visibleThreshold;
uniform float u_visibleThresholdReveal;
uniform float u_dotRadius;
uniform float u_dotRadiusReveal;
uniform float u_dotSoft;
uniform float u_bloomSpread;
uniform float u_bloomSpreadReveal;
uniform float u_bloomNearSigma;
uniform float u_bloomNearAmp;
uniform float u_bloomFarSigma;
uniform float u_bloomFarAmp;
uniform float u_coreAmp;
uniform float u_overlapBloom;
uniform float u_shimmerAmp;
uniform float u_shimmerWaveSpeed;
uniform float u_shimmerWaveScale;
uniform float u_shimmerNoiseScale;
uniform float u_shimmerNoiseSpeed;
uniform float u_boltSpeed;
uniform float u_boltSpawnRate;
uniform float u_boltActiveThreshold;
uniform float u_boltWidth;
uniform float u_boltHaloWidth;
uniform float u_boltAmp;
uniform float u_boltCount;
uniform float u_boltPulseLength;
uniform float u_boltSteps;
uniform float u_boltStartExtend;
uniform float u_boltEndExtend;
uniform float u_boltFromCenterMin;
uniform float u_boltFromCenterMax;
uniform float u_boltEdgeBias;
uniform float u_boltCenterExclusion;
uniform float u_boltSpread;
uniform float u_radialFadeStart;
uniform float u_radialFadeEnd;
uniform float u_brightnessRevealBoost;
uniform float u_mouseRevealAmp;
uniform float u_revealRadius;
uniform float u_revealInner;
uniform vec3 u_beamColor;
uniform float u_beamYOffset;
uniform float u_beamRx;
uniform float u_beamRy;
uniform float u_semiStart;
uniform float u_semiEnd;
uniform float u_semiAmp;
uniform float u_haloRyScale;
uniform float u_haloSigma;
uniform float u_haloAmp;
uniform float u_coreBandY;
uniform float u_coreBandX;
uniform float u_coreBandAmp;
uniform float u_heatPulseSpeed;
uniform float u_heatRippleSpeed;
uniform float u_heatRippleScale;
uniform float u_heatMaskSigma;
uniform float u_heatPulseAmp;
uniform float u_heatRippleAmp;
uniform float u_beamBottomFade;
uniform float u_illumRadius;
uniform vec3 u_illumColor;
uniform float u_illumAmp;

out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float shimmerValueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float wispShimmerOpacity(vec2 nid, vec2 wispUv) {
  float wispPhase = hash(nid) * 6.2831853;
  float sweepPhase =
    wispUv.x * u_shimmerWaveScale - u_time * u_shimmerWaveSpeed + wispPhase * 0.18;

  vec2 noiseCoord =
    wispUv * u_shimmerNoiseScale +
    vec2(u_time * u_shimmerNoiseSpeed * 0.32, u_time * u_shimmerNoiseSpeed * 0.11);
  noiseCoord += vec2(hash(nid + 3.17), hash(nid + 9.43)) * 1.6;
  float noise = shimmerValueNoise(noiseCoord);

  float phase = sweepPhase + noise * 5.2 + hash(nid + 12.7) * 0.9;
  float opacity = 0.5 - 0.5 * cos(phase);
  opacity = opacity * opacity * (3.0 - 2.0 * opacity);
  return opacity;
}

vec2 wispCenterFromCell(vec2 cell) {
  return (cell + vec2(0.5)) * u_cellSize;
}

float segmentDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float denom = dot(ba, ba);
  float h = denom > 1e-5 ? clamp(dot(pa, ba) / denom, 0.0, 1.0) : 0.0;
  return length(pa - ba * h);
}

float pulseSegmentGlow(vec2 p, vec2 a, vec2 b, float coreW, float haloW) {
  float d = segmentDist(p, a, b);
  float core = exp(-d * d / coreW);
  float halo = exp(-d * d / haloW);
  return core * 1.65 + halo * 0.38;
}

float boltHopCount(vec2 gridDim) {
  return min(max(u_boltSteps, 4.0), 10.0);
}

void boltVerticalBounds(out float startRow, out float endRow, vec2 gridDim) {
  startRow = -u_boltStartExtend * gridDim.y;
  endRow = gridDim.y * (1.0 + u_boltEndExtend);
}

float boltRowStride(vec2 gridDim, float startRow, float endRow, float hops) {
  return max((endRow - startRow) / hops, 0.5);
}

float boltStagger(float boltId) {
  float rate = max(u_boltSpeed * max(u_boltSpawnRate, 0.2), 0.2);
  return hash(vec2(boltId, 13.0)) * (0.92 / rate);
}

float boltSpreadOffset(float boltId, float lifeId, float salt) {
  return (hash(vec2(lifeId, boltId + salt)) - 0.5) * 2.0 * u_boltSpread;
}

float boltSideSign(float boltId, float lifeId) {
  return hash(vec2(lifeId, boltId + 31.0)) < 0.5 ? -1.0 : 1.0;
}

float boltEdgeCol(float boltId, float lifeId, vec2 gridDim, float centerCol, float margin) {
  float side = boltSideSign(boltId, lifeId);
  float h = hash(vec2(lifeId, boltId + 7.0));
  float leftMax = max(centerCol - margin, 1.0);
  float rightMin = centerCol + margin;
  float rightSpan = max(gridDim.x - rightMin - 1.0, 1.0);
  float col = side < 0.0 ? h * leftMax : rightMin + h * rightSpan;
  return floor(clamp(col, 0.0, max(gridDim.x - 1.0, 0.0)));
}

float boltAnchorCol(
  float boltId,
  float lifeId,
  vec2 gridDim,
  float centerCol,
  float margin,
  float edgeBlend
) {
  float edgeCol = boltEdgeCol(boltId, lifeId, gridDim, centerCol, margin);
  return mix(centerCol, edgeCol, edgeBlend);
}

float boltClampToFlank(float col, float side, float centerCol, float margin, float maxCol) {
  if (u_boltEdgeBias < 0.5) return col;
  if (side < 0.0) return clamp(col, 0.0, max(centerCol - margin, 0.0));
  return clamp(col, centerCol + margin, maxCol);
}

float boltStartCol(
  float boltId,
  float lifeId,
  vec2 gridDim,
  float side,
  float anchorCol,
  float blend,
  float centerCol,
  float margin,
  float maxCol
) {
  float randomCol =
    floor(hash(vec2(lifeId, boltId + 7.0)) * max(gridDim.x - 1.0, 1.0));
  float spreadCol = boltClampToFlank(
    anchorCol + boltSpreadOffset(boltId, lifeId, 3.0),
    side,
    centerCol,
    margin,
    maxCol
  );
  return mix(randomCol, spreadCol, blend);
}

float boltHopDx(
  vec2 cell,
  float boltId,
  float step,
  float lifeId,
  float hops,
  float blend,
  float side,
  float anchorCol,
  float startOff,
  float endOff,
  float centerCol,
  float margin,
  float maxCol
) {
  float h = hash(cell + vec2(boltId * 1.9 + lifeId, step * 2.7));
  float randomDx = floor(h * 3.0) - 1.0;
  if (blend < 0.001) return randomDx;

  float t = (step + 1.0) / max(hops, 1.0);
  float targetCol = boltClampToFlank(anchorCol + mix(startOff, endOff, t), side, centerCol, margin, maxCol);
  float steer = clamp(targetCol - cell.x, -u_boltSpread * 0.22, u_boltSpread * 0.22);
  float spreadDx = steer + (h - 0.5) * 0.85;
  return mix(randomDx, spreadDx, blend);
}

float boltPathLengthEstimate(float startRow, float endRow, float startOff, float endOff) {
  float vert = (endRow - startRow) * u_cellSize;
  float horiz = abs(endOff - startOff) * u_cellSize;
  return max(vert + horiz * 0.65 + u_cellSize * 2.0, 1.0);
}

bool boltPixelNearPath(
  vec2 px,
  vec2 startPt,
  float headDist,
  float anchorCol,
  float startOff,
  float endOff,
  float pad
) {
  float minX =
    (anchorCol + min(startOff, endOff)) * u_cellSize - pad - u_boltSpread * u_cellSize * 0.5;
  float maxX =
    (anchorCol + max(startOff, endOff)) * u_cellSize + pad + u_boltSpread * u_cellSize * 0.5;
  float maxY = startPt.y + headDist + pad;
  return px.x >= minX && px.x <= maxX && px.y >= startPt.y - pad && px.y <= maxY;
}

float singleBolt(
  vec2 px,
  float boltId,
  vec2 gridDim,
  float centerCol,
  float margin,
  float maxCol,
  float edgeBlend,
  float rowStride,
  float hops,
  float coreW,
  float haloW,
  float segPad
) {
  float timeOff = u_time + boltStagger(boltId);
  float lifeId = floor(timeOff * u_boltSpeed);
  if (hash(vec2(lifeId, boltId * 1.73)) < u_boltActiveThreshold) return 0.0;

  float progress = fract(timeOff * u_boltSpeed);
  float side = boltSideSign(boltId, lifeId);
  float anchorCol = boltAnchorCol(boltId, lifeId, gridDim, centerCol, margin, edgeBlend);
  float startOff = boltSpreadOffset(boltId, lifeId, 3.0);
  float endOff = boltSpreadOffset(boltId, lifeId, 41.0);
  float blend = mix(u_boltFromCenterMin, u_boltFromCenterMax, hash(vec2(lifeId, boltId + 99.0)));

  float startRow;
  float endRow;
  boltVerticalBounds(startRow, endRow, gridDim);
  float startCol = boltStartCol(
    boltId,
    lifeId,
    gridDim,
    side,
    anchorCol,
    blend,
    centerCol,
    margin,
    maxCol
  );
  vec2 startCell = vec2(startCol, startRow);
  vec2 startPt = wispCenterFromCell(startCell);

  float pathLen = boltPathLengthEstimate(startRow, endRow, startOff, endOff);
  float grow = progress * progress * (3.0 - 2.0 * progress);
  float headDist = grow * pathLen;
  if (headDist <= 0.001) return 0.0;

  float pathPad = u_boltHaloWidth * 3.5 + u_cellSize * 2.0;
  if (!boltPixelNearPath(px, startPt, headDist, anchorCol, startOff, endOff, pathPad)) {
    return 0.0;
  }

  vec2 cell = startCell;
  vec2 a = startPt;
  float cumLen = 0.0;
  float glow = 0.0;

  for (int i = 0; i < 10; i++) {
    if (float(i) >= hops) break;

    cell.x += boltHopDx(
      cell,
      boltId,
      float(i),
      lifeId,
      hops,
      blend,
      side,
      anchorCol,
      startOff,
      endOff,
      centerCol,
      margin,
      maxCol
    );
    cell.y += rowStride;
    vec2 b = wispCenterFromCell(cell);
    vec2 ab = b - a;
    float segLen = length(ab);
    float segStart = cumLen;
    float segEnd = cumLen + segLen;

    if (segEnd > 0.0 && segStart <= headDist) {
      float invSegLen = 1.0 / max(segLen, 0.001);
      float t0 = clamp(-segStart * invSegLen, 0.0, 1.0);
      float t1 = clamp((headDist - segStart) * invSegLen, 0.0, 1.0);
      vec2 p0 = a + ab * t0;
      vec2 p1 = a + ab * t1;
      if (
        px.x >= min(p0.x, p1.x) - segPad &&
        px.x <= max(p0.x, p1.x) + segPad &&
        px.y >= min(p0.y, p1.y) - segPad &&
        px.y <= max(p0.y, p1.y) + segPad
      ) {
        float segMid = (segStart + segEnd) * 0.5;
        float tipBias = 0.3 + 0.7 * clamp(segMid / max(headDist, 0.001), 0.0, 1.0);
        glow += pulseSegmentGlow(px, p0, p1, coreW, haloW) * tipBias;
      }
    }

    if (headDist >= segStart && headDist <= segEnd) {
      float invSegLen = 1.0 / max(segLen, 0.001);
      vec2 headPt = a + ab * clamp((headDist - segStart) * invSegLen, 0.0, 1.0);
      float headD2 = dot(px - headPt, px - headPt);
      float headPad2 = segPad * segPad;
      if (headD2 < headPad2) {
        glow += exp(-headD2 / (u_boltWidth * u_boltWidth * 0.35)) * 2.2;
      }
    }

    cumLen = segEnd;
    a = b;
  }

  return glow * (1.0 - smoothstep(1.0 - u_boltPulseLength, 1.0, progress));
}

float boltLayer(
  vec2 px,
  vec2 gridDim,
  float centerCol,
  float margin,
  float maxCol,
  float edgeBlend
) {
  float hops = boltHopCount(gridDim);
  float startRow;
  float endRow;
  boltVerticalBounds(startRow, endRow, gridDim);
  float rowStride = boltRowStride(gridDim, startRow, endRow, hops);
  float coreW = u_boltWidth * u_boltWidth * 0.55;
  float haloW = u_boltHaloWidth * u_boltHaloWidth;
  float segPad = u_boltHaloWidth * 3.0;

  float glow = 0.0;
  float count = min(max(u_boltCount, 1.0), 10.0);
  for (int b = 0; b < 10; b++) {
    if (float(b) >= count) break;
    glow += singleBolt(
      px,
      float(b),
      gridDim,
      centerCol,
      margin,
      maxCol,
      edgeBlend,
      rowStride,
      hops,
      coreW,
      haloW,
      segPad
    );
  }
  return glow * u_boltAmp;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 color = u_bg;

  vec2 px = gl_FragCoord.xy / u_pixelRatio;
  px.y -= u_time * u_driftSpeed;

  vec2 invView = vec2(
    1.0 / max(u_resolution.x / u_pixelRatio, 1.0),
    1.0 / max(u_resolution.y / u_pixelRatio, 1.0)
  );
  vec2 gridDim = vec2(u_resolution.x / u_pixelRatio, u_resolution.y / u_pixelRatio) / u_cellSize;

  vec2 mouseGL = u_mouse * u_pixelRatio;
  mouseGL.y = u_resolution.y - mouseGL.y;
  vec2 mouseDelta = gl_FragCoord.xy - mouseGL;
  float mouseDistSq = dot(mouseDelta, mouseDelta);

  float revealFactor = 0.0;
  if (u_mouseStrength > 0.001 && u_mouseRevealAmp > 0.001) {
    float revealRadius = u_revealRadius * u_pixelRatio;
    float outerR2 = revealRadius * revealRadius;
    float innerR2 = revealRadius * u_revealInner * (revealRadius * u_revealInner);
    revealFactor =
      (1.0 - smoothstep(innerR2, outerR2, mouseDistSq)) *
      u_mouseStrength *
      u_mouseRevealAmp;
  }

  float visibleThreshold = mix(u_visibleThreshold, u_visibleThresholdReveal, revealFactor);
  float dotRadius = mix(u_dotRadius, u_dotRadiusReveal, revealFactor);
  float bloomSpread = mix(u_bloomSpread, u_bloomSpreadReveal, revealFactor);
  float spread2 = bloomSpread * bloomSpread;
  float invNearSigma = 1.0 / max(u_bloomNearSigma * spread2, 0.001);
  float invFarSigma = 1.0 / max(u_bloomFarSigma * spread2, 0.001);
  bool useFarBloom = u_bloomFarAmp > 0.001;

  vec2 cellId = floor(px / u_cellSize);
  vec2 center = vec2(u_cellSize * 0.5);
  float shimmerMix = u_shimmerAmp;

  float wispBloom = 0.0;
  float core = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 nid = cellId + vec2(float(i), float(j));
      vec2 wispCenterPx = nid * u_cellSize + center;
      vec2 nDelta = px - wispCenterPx;
      float nDist = length(vec2(nDelta.x, nDelta.y * u_wispStretch));
      float nh = hash(nid);
      float nVisible = smoothstep(0.05, visibleThreshold, nh);
      if (nVisible < 0.001) continue;

      float nBrightness = mix(0.5, 1.0, nh) + revealFactor * u_brightnessRevealBoost;
      float wispOpacity = shimmerMix < 0.001
        ? 1.0
        : mix(1.0, wispShimmerOpacity(nid, wispCenterPx * invView), shimmerMix);

      float nDist2 = nDist * nDist;
      float nDotMask = 1.0 - smoothstep(dotRadius - u_dotSoft, dotRadius + u_dotSoft, nDist);
      float wispLight = nBrightness * nVisible * wispOpacity;
      core = max(core, nDotMask * wispLight);
      float bloomNear = exp(-nDist2 * invNearSigma) * u_bloomNearAmp;
      float bloomFar = useFarBloom ? exp(-nDist2 * invFarSigma) * u_bloomFarAmp : 0.0;
      wispBloom += (bloomNear + bloomFar) * wispLight;
    }
  }

  vec2 centerUV = uv - 0.5;
  centerUV.x *= u_resolution.x / u_resolution.y;
  float radialFade = 1.0 - smoothstep(u_radialFadeStart, u_radialFadeEnd, length(centerUV));

  float dotIntensity = (core * u_coreAmp + wispBloom) * radialFade;
  dotIntensity += dotIntensity * dotIntensity * u_overlapBloom;
  color += dotIntensity;

  bool beamActive =
    u_semiAmp > 0.001 ||
    u_haloAmp > 0.001 ||
    u_coreBandAmp > 0.001 ||
    u_heatPulseAmp > 0.001 ||
    u_heatRippleAmp > 0.001;
  if (beamActive && uv.y < 0.82) {
    float pxX = (uv.x - 0.5) * u_resolution.x / u_pixelRatio;
    float pxY = (uv.y + u_beamYOffset) * u_resolution.y / u_pixelRatio;
    float invBeamRx = 1.0 / max(u_beamRx, 1.0);
    float invBeamRy = 1.0 / max(u_beamRy, 1.0);

    float ellipseDist = length(vec2(pxX * invBeamRx, pxY * invBeamRy));
    float semicircle = 1.0 - smoothstep(u_semiStart, u_semiEnd, ellipseDist);

    float bloomDist = length(vec2(pxX * invBeamRx, pxY / max(u_beamRy * u_haloRyScale, 1.0)));
    float bloomDist2 = bloomDist * bloomDist;
    float halo = exp(-bloomDist2 / (2.0 * u_haloSigma * u_haloSigma));

    float coreBand =
      exp(-pxY * u_coreBandY) * exp(-pxX * pxX / (2.0 * u_coreBandX * u_coreBandX));

    float heatPulse = 0.5 + 0.5 * sin(u_time * u_heatPulseSpeed);
    float heatRipple =
      sin((bloomDist * u_heatRippleScale) - (u_time * u_heatRippleSpeed)) * 0.5 + 0.5;
    float heatMask = exp(-bloomDist2 / (2.0 * u_heatMaskSigma * u_heatMaskSigma));
    float heatGlow = heatMask * (u_heatPulseAmp * heatPulse + u_heatRippleAmp * heatRipple);

    float singleBeam = semicircle * u_semiAmp + halo * u_haloAmp + coreBand * u_coreBandAmp + heatGlow;
    if (u_beamBottomFade > 0.0001) {
      singleBeam *= smoothstep(0.0, u_beamBottomFade, uv.y);
    }
    color += u_beamColor * singleBeam;
  }

  if (u_mouseStrength > 0.001 && u_illumAmp > 0.001) {
    float illumRadius = u_illumRadius * u_pixelRatio;
    float illumFalloff =
      exp(-mouseDistSq / (2.0 * illumRadius * illumRadius)) * u_mouseStrength * u_illumAmp;
    color += u_illumColor * illumFalloff;
  }

  if (u_boltAmp > 0.001 && radialFade > 0.001) {
    float centerCol = floor(gridDim.x * 0.5);
    float margin = gridDim.x * clamp(u_boltCenterExclusion, 0.0, 0.45);
    float edgeBlend = clamp(u_boltEdgeBias, 0.0, 1.0);
    bool runBolts = edgeBlend < 0.5;
    if (!runBolts) {
      float col = floor(px.x / u_cellSize);
      runBolts = col < centerCol - margin || col > centerCol + margin;
    }
    if (runBolts) {
      float bolts = boltLayer(
        px,
        gridDim,
        centerCol,
        margin,
        max(gridDim.x - 1.0, 0.0),
        edgeBlend
      );
      color += mix(vec3(1.0), u_beamColor, 0.45) * bolts * radialFade;
    }
  }

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`
