varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewDir;
varying float vWIntensity;
varying float vWAlpha;

attribute float aWIntensity;
attribute float aWAlpha;

void main() {
  vUv = uv;
  vWIntensity = aWIntensity;
  vWAlpha = aWAlpha;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
