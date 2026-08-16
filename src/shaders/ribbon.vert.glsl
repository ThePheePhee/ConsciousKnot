varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewDir;
varying float vWIntensity;
varying float vWAlpha;

uniform float morphAlpha;

attribute vec3 aNextPosition;
attribute vec3 aNextNormal;
attribute float aWIntensity;
attribute float aWAlpha;
attribute float aNextWIntensity;
attribute float aNextWAlpha;

void main() {
  float blend = clamp(morphAlpha, 0.0, 1.0);
  vec3 morphedPosition = mix(position, aNextPosition, blend);
  vec3 morphedNormal = normalize(mix(normal, aNextNormal, blend));
  vUv = uv;
  vWIntensity = mix(aWIntensity, aNextWIntensity, blend);
  vWAlpha = mix(aWAlpha, aNextWAlpha, blend);
  vec4 world = modelMatrix * vec4(morphedPosition, 1.0);
  vWorldPosition = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * morphedNormal);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
