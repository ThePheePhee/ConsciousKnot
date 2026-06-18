precision highp float;

uniform float time;
uniform float oilSlickStrength;
uniform float fractalStrength;
uniform float fibreDensity;
uniform float fibreStrength;
uniform float lightStrength;
uniform float colorSpeed;
uniform float colorScale;
uniform vec3 corePosition;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewDir;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), u.x), u.y);
}

vec3 palette(float t) {
  vec3 a = vec3(0.42, 0.05, 0.62);
  vec3 b = vec3(0.48, 0.47, 0.48);
  vec3 c = vec3(1.15, 0.92, 0.78);
  vec3 d = vec3(0.04, 0.29, 0.58);
  vec3 base = a + b * cos(6.28318 * (c * t + d));
  vec3 copper = vec3(1.0, 0.42, 0.13) * smoothstep(0.55, 1.0, sin(t * 18.0) * 0.5 + 0.5);
  vec3 cyan = vec3(0.0, 0.92, 1.0) * smoothstep(0.2, 0.95, cos(t * 13.0 + 1.7) * 0.5 + 0.5);
  return max(base + 0.32 * copper + 0.28 * cyan, 0.0);
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);
  float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.2);
  float edge = pow(abs(vUv.y * 2.0 - 1.0), 2.4);
  float cell = noise(vUv * vec2(180.0, 28.0) + vec2(time * 0.05, time * 0.03));
  float cellFine = noise(vUv * vec2(520.0, 88.0) - time * 0.04);
  float interference = sin(vUv.x * colorScale * 6.28318 + cell * 3.2 + time * colorSpeed);
  float strands = pow(0.5 + 0.5 * sin(vUv.y * fibreDensity * 6.28318 + cellFine * 5.5), 10.0);
  float longitudinal = vUv.x * colorScale + 0.18 * sin(vUv.x * 35.0 + time * 0.25) + 0.12 * interference;
  vec3 oil = palette(longitudinal) * (1.0 + oilSlickStrength * 0.95);
  vec3 micro = mix(vec3(1.0), vec3(0.55, 0.85, 1.0) + 0.7 * palette(longitudinal + 0.2), fractalStrength * (0.22 + 0.55 * cell));
  vec3 coreVec = corePosition - vWorldPosition;
  float coreGlow = lightStrength * 0.028 / max(dot(coreVec, coreVec), 0.12);
  vec3 white = vec3(1.0, 0.96, 0.9);
  vec3 color = oil * micro;
  color += white * (fresnel * 2.5 + edge * 1.1 + strands * fibreStrength * 0.7 + coreGlow);
  color += palette(longitudinal + 0.43) * strands * fibreStrength * 0.48;
  color = pow(color, vec3(0.82));
  gl_FragColor = vec4(color, 1.0);
}
