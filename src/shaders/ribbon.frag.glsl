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
  vec3 a = vec3(0.25, 0.03, 0.42);
  vec3 b = vec3(0.38, 0.42, 0.46);
  vec3 c = vec3(1.15, 0.94, 0.72);
  vec3 d = vec3(0.06, 0.31, 0.59);
  vec3 base = a + b * cos(6.28318 * (c * t + d));
  vec3 copper = vec3(0.95, 0.33, 0.08) * smoothstep(0.6, 1.0, sin(t * 21.0) * 0.5 + 0.5);
  vec3 cyan = vec3(0.0, 0.78, 1.0) * smoothstep(0.32, 0.95, cos(t * 15.0 + 1.7) * 0.5 + 0.5);
  vec3 emerald = vec3(0.0, 0.76, 0.42) * smoothstep(0.5, 1.0, sin(t * 9.0 + 2.3) * 0.5 + 0.5);
  return max(base + 0.22 * copper + 0.24 * cyan + 0.18 * emerald, 0.0);
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);
  float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.2);
  float edge = pow(abs(vUv.y * 2.0 - 1.0), 3.1);
  float cell = noise(vUv * vec2(180.0, 28.0) + vec2(time * 0.05, time * 0.03));
  float cellFine = noise(vUv * vec2(520.0, 88.0) - time * 0.04);
  float interference = sin(vUv.x * colorScale * 6.28318 + cell * 3.2 + time * colorSpeed);
  float strandPhase = vUv.y * fibreDensity * 6.28318 + 0.35 * sin(vUv.x * 54.0 + time * 0.18) + cellFine * 3.5;
  float strands = pow(0.5 + 0.5 * sin(strandPhase), 18.0);
  float strandGroove = pow(0.5 + 0.5 * cos(strandPhase), 4.0);
  float longitudinal = vUv.x * colorScale + 0.18 * sin(vUv.x * 47.0 + time * 0.18) + 0.12 * interference;
  vec3 oil = palette(longitudinal) * (0.55 + oilSlickStrength * 0.58);
  vec3 strandColor = palette(longitudinal + vUv.y * 1.4 + cellFine * 0.22);
  vec3 micro = mix(vec3(0.78), vec3(0.45, 0.72, 0.96) + 0.48 * palette(longitudinal + 0.2), fractalStrength * (0.26 + 0.52 * cell));
  vec3 coreVec = corePosition - vWorldPosition;
  float coreGlow = lightStrength * 0.012 / max(dot(coreVec, coreVec), 0.16);
  vec3 white = vec3(0.9, 0.96, 1.0);
  vec3 color = oil * micro;
  color *= 0.78 - 0.22 * strandGroove * fibreStrength;
  color += strandColor * strands * fibreStrength * 0.82;
  color += white * (fresnel * 0.52 + edge * 0.42 + coreGlow);
  color += palette(longitudinal + 0.43) * strands * fibreStrength * 0.24;
  color = color / (vec3(1.0) + color * 0.38);
  color = pow(color, vec3(0.9));
  gl_FragColor = vec4(color, 1.0);
}
