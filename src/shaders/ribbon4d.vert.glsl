precision highp float;

attribute vec3 aRibbon;

uniform float time;
uniform float transitionProgress;
uniform float sourceKind;
uniform float midKind;
uniform float targetKind;
uniform float transitionPath;
uniform float torusP;
uniform float torusQ;
uniform float ribbonWidth;
uniform float edgeFlare;
uniform float tipStrength;
uniform float liftAmplitude;
uniform float liftFrequency;
uniform float sphereTightness;
uniform float confineProjectedSphere;
uniform float confine4DSphere;
uniform float denseProjection;
uniform float densityPasses;
uniform float densityPhaseSpread;
uniform float symmetryOrder;
uniform float phaseSourceMid;
uniform float phaseSourceTarget;
uniform float phaseMidTarget;
uniform float localCrossingCenter;
uniform float localCrossingWidth;
uniform float localCrossingStrength;
uniform float localFocusZoom;
uniform float projectionDistance4D;
uniform float rotateXY;
uniform float rotateXZ;
uniform float rotateXW;
uniform float rotateYZ;
uniform float rotateYW;
uniform float rotateZW;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewDir;
varying float vWIntensity;
varying float vWAlpha;

const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;

float ease(float x) {
  float t = clamp(x, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

float envelopeRadius(float t) {
  float order = max(3.0, floor(symmetryOrder + 0.5));
  return 1.42 + 0.13 * sin(2.0 * order * t) * tipStrength + 0.035 * sin(order * t + PI / order);
}

vec3 torusPoint(float t, float p, float q, float major, float minor) {
  return vec3(
    (major + minor * cos(q * t)) * cos(p * t),
    (major + minor * cos(q * t)) * sin(p * t),
    minor * sin(q * t)
  );
}

vec3 figureEight(float t) {
  return 0.62 * vec3((2.0 + cos(2.0 * t)) * cos(3.0 * t), (2.0 + cos(2.0 * t)) * sin(3.0 * t), sin(4.0 * t));
}

vec3 consciousOrb(float t, float p, float q) {
  float azimuth = p * t + 0.48 * sin(5.0 * t + 0.3) + 0.18 * sin(10.0 * t) + 0.08 * sin((p - q) * t);
  float rawZ = 0.7 * sin(q * t + 0.32 * sin(5.0 * t)) + 0.18 * sin((q + 10.0) * t + 0.8) + 0.08 * cos((p + 5.0) * t);
  float z = clamp(rawZ, -0.92, 0.92);
  float xy = sqrt(max(0.001, 1.0 - z * z));
  float tenTip = 0.17 * pow(0.5 + 0.5 * cos(10.0 * t), 2.0);
  float radius = 1.12 + tenTip + 0.08 * sin((p + q) * t + 0.4);
  vec3 shell = radius * vec3(cos(azimuth) * xy, sin(azimuth) * xy, z);
  vec3 inner = vec3(0.18 * cos((p + 5.0) * t + 1.4), 0.18 * sin((q + 5.0) * t), 0.12 * sin((p - q + 10.0) * t));
  return shell + inner;
}

vec3 knotPoint(float kind, float t) {
  if (kind < 0.5) return torusPoint(t, 1.0, 1.0, 1.5, 0.12);
  if (kind < 1.5) return torusPoint(t, 2.0, 3.0, 1.24, 0.72);
  if (kind < 2.5) return torusPoint(t, 2.0, 5.0, 1.17, 0.72);
  if (kind < 3.5) return torusPoint(t, 3.0, 4.0, 1.12, 0.77);
  if (kind < 4.5) return torusPoint(t, 5.0, 3.0, 1.08, 0.82);
  if (kind < 5.5) return torusPoint(t, 8.0, 5.0, 1.02, 0.9);
  if (kind < 6.5) return torusPoint(t, 11.0, 8.0, 0.98, 0.93);
  if (kind < 7.5) return torusPoint(t, 13.0, 7.0, 0.98, 0.94);
  if (kind < 8.5) return consciousOrb(t, max(8.0, torusP), max(5.0, torusQ));
  if (kind < 9.5) return figureEight(t);
  return torusPoint(t, max(1.0, torusP), max(1.0, torusQ), 1.1, 0.78);
}

vec3 sphericalKnot(float kind, float t) {
  vec3 p = knotPoint(kind, t);
  return normalize(p) * envelopeRadius(t);
}

vec3 stableAxis(vec3 v) {
  vec3 candidate = abs(v.z) < 0.8 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  return normalize(cross(candidate, v));
}

vec3 rotateAroundAxis(vec3 v, vec3 axis, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}

vec3 sphericalBlend(vec3 a, vec3 b, float amount) {
  float radius = mix(length(a), length(b), amount);
  vec3 av = normalize(a);
  vec3 bv = normalize(b);
  float dotAB = clamp(dot(av, bv), -0.999, 0.999);
  if (dotAB < -0.96) return normalize(rotateAroundAxis(av, stableAxis(av), PI * amount)) * radius;
  float theta = acos(dotAB);
  if (theta < 0.001) return normalize(mix(av, bv, amount)) * radius;
  float sinTheta = sin(theta);
  return normalize(av * (sin((1.0 - amount) * theta) / sinTheta) + bv * (sin(amount * theta) / sinTheta)) * radius;
}

float localWindow(float t, float center, float width) {
  float d = abs(mod(t - center + 1.5, 1.0) - 0.5);
  return exp(-(d * d) / max(0.0001, 2.0 * width * width));
}

vec3 localCrossingPoint(float t, float a) {
  vec3 source = sphericalKnot(1.0, t);
  vec3 target = sphericalKnot(9.0, t + 0.1 * sin(PI * a));
  vec3 base = sphericalBlend(source, target, a);
  float window = localWindow(t / TAU, localCrossingCenter, localCrossingWidth);
  vec3 tangentLike = normalize(vec3(-base.y, base.x, 0.0));
  vec3 sideways = normalize(cross(tangentLike, normalize(base)));
  float surgery = sin(PI * a) * window * localCrossingStrength;
  return base + sideways * (0.42 * surgery * sin(18.0 * t + 0.7)) + normalize(base) * (0.18 * surgery * cos(12.0 * t));
}

void rotatePlane(inout vec4 v, int plane, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  float a;
  float b;
  if (plane == 0) { a = v.x; b = v.y; v.x = c * a - s * b; v.y = s * a + c * b; }
  if (plane == 1) { a = v.x; b = v.z; v.x = c * a - s * b; v.z = s * a + c * b; }
  if (plane == 2) { a = v.x; b = v.w; v.x = c * a - s * b; v.w = s * a + c * b; }
  if (plane == 3) { a = v.y; b = v.z; v.y = c * a - s * b; v.z = s * a + c * b; }
  if (plane == 4) { a = v.y; b = v.w; v.y = c * a - s * b; v.w = s * a + c * b; }
  if (plane == 5) { a = v.z; b = v.w; v.z = c * a - s * b; v.w = s * a + c * b; }
}

vec3 centerline(float t01, float passOffset) {
  float a = ease(transitionProgress);
  float phase = passOffset * densityPhaseSpread * TAU / max(1.0, symmetryOrder * max(1.0, densityPasses));
  float t = t01 * TAU + phase;
  vec3 source = sphericalKnot(sourceKind, t);
  vec3 target = sphericalKnot(targetKind, t + phaseSourceTarget);
  vec3 mid = sphericalKnot(midKind, t + phaseSourceMid);
  vec3 targetFromMid = sphericalKnot(targetKind, t + phaseSourceMid + phaseMidTarget);
  vec3 xyz = transitionPath > 1.5 ? localCrossingPoint(t, a) : transitionPath > 0.5 ? (a < 0.5 ? sphericalBlend(source, mid, ease(a * 2.0)) : sphericalBlend(mid, targetFromMid, ease((a - 0.5) * 2.0))) : sphericalBlend(source, target, a);
  float envelope = envelopeRadius(t);
  if (confineProjectedSphere > 0.5 || confine4DSphere > 0.5) xyz = mix(xyz, normalize(xyz) * envelope, sphereTightness);
  float liftWindow = transitionPath > 1.5 ? localWindow(t01, localCrossingCenter, localCrossingWidth) : 1.0;
  float lift = liftAmplitude * liftWindow * sin(PI * a) * sin(liftFrequency * t + time * 0.6 + 0.7 * sin(5.0 * t));
  vec4 p4 = vec4(xyz, lift);
  rotatePlane(p4, 0, rotateXY);
  rotatePlane(p4, 1, rotateXZ);
  rotatePlane(p4, 2, rotateXW);
  rotatePlane(p4, 3, rotateYZ);
  rotatePlane(p4, 4, rotateYW);
  rotatePlane(p4, 5, rotateZW);
  if (confine4DSphere > 0.5) p4 *= envelope / max(0.001, length(p4));
  float factor = projectionDistance4D / max(0.18, projectionDistance4D - p4.w);
  vec3 projected = p4.xyz * factor;
  if (confineProjectedSphere > 0.5) projected = mix(projected, normalize(projected) * envelope, pow(sphereTightness, 1.35));
  return projected;
}

void main() {
  float t01 = aRibbon.x;
  float crossU = aRibbon.y;
  float passOffset = denseProjection > 0.5 ? aRibbon.z : 0.0;
  float eps = 1.0 / 900.0;
  vec3 p = centerline(t01, passOffset);
  vec3 pPrev = centerline(t01 - eps, passOffset);
  vec3 pNext = centerline(t01 + eps, passOffset);
  vec3 tangent = normalize(pNext - pPrev);
  vec3 outward = normalize(p);
  vec3 side = normalize(cross(tangent, outward));
  if (length(side) < 0.01) side = normalize(cross(tangent, vec3(0.0, 1.0, 0.0)));
  vec3 binormal = normalize(cross(tangent, side));
  float edge = pow(abs(crossU), 3.4);
  float pinch = 0.5 + 0.5 * pow(0.5 + 0.5 * cos(10.0 * t01 * TAU), 4.0) * tipStrength;
  float localWidth = ribbonWidth * (0.82 + 0.3 * pinch);
  vec3 ribbonPos = p + side * localWidth * crossU + outward * (edgeFlare * edge * ribbonWidth * 0.42 + 0.05 * edge * pinch);
  vec3 ribbonNormal = normalize(binormal * 0.36 + outward * (0.84 + edge * 0.7) + side * crossU * edgeFlare * 0.18);

  vUv = uv;
  vWIntensity = 0.0;
  vWAlpha = 1.0;
  vec4 world = modelMatrix * vec4(ribbonPos, 1.0);
  vWorldPosition = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * ribbonNormal);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
