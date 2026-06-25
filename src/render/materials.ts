import { AdditiveBlending, BackSide, DoubleSide, ShaderMaterial, SphereGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import classicVertexShader from '../shaders/ribbon.vert.glsl?raw';
import fragmentShader from '../shaders/ribbon.frag.glsl?raw';
import type { Params } from '../math/types';

export function createClassicRibbonMaterial(params: Params) {
  return new ShaderMaterial({
    vertexShader: classicVertexShader,
    fragmentShader,
    side: DoubleSide,
    transparent: true,
    depthWrite: true,
    uniforms: {
      time: { value: 0 },
      oilSlickStrength: { value: params.oilSlickStrength },
      fractalStrength: { value: params.fractalStrength },
      fibreDensity: { value: params.fibreDensity },
      fibreStrength: { value: params.fibreStrength },
      lightStrength: { value: params.diamondLightStrength },
      innerFogEnabled: { value: params.innerFogEnabled ? 1 : 0 },
      innerFogStrength: { value: params.innerFogStrength },
      colorSpeed: { value: 0.18 },
      colorScale: { value: 12.0 },
      corePosition: { value: new Vector3() },
    },
  });
}

export function createInnerFog(size: number) {
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    side: BackSide,
    uniforms: {
      time: { value: 0 },
      intensity: { value: 0 },
      lightStrength: { value: 1 },
      corePosition: { value: new Vector3() },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform float time;
      uniform float intensity;
      uniform float lightStrength;
      uniform vec3 corePosition;

      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }

      float valueNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash(i + vec3(0.0, 0.0, 0.0));
        float n100 = hash(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash(i + vec3(1.0, 1.0, 1.0));
        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);
        return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
      }

      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(vViewDir);
        vec3 coreVec = corePosition - vWorldPosition;
        float d2 = max(dot(coreVec, coreVec), 0.18);
        float rim = pow(1.0 - abs(dot(n, v)), 1.65);
        float murk = valueNoise(vWorldPosition * 3.1 + vec3(0.0, time * 0.025, 0.0));
        float breath = 0.82 + 0.18 * sin(time * 0.55 + murk * 6.28318);
        float alpha = intensity * lightStrength * breath * (0.015 / d2 + 0.036 * rim) * (0.68 + 0.32 * murk);
        vec3 color = mix(vec3(0.42, 0.74, 1.0), vec3(1.0, 0.82, 0.66), murk * 0.32 + rim * 0.18);
        gl_FragColor = vec4(color * alpha * 8.0, clamp(alpha, 0.0, 0.12));
      }
    `,
  });
  return new Mesh(new SphereGeometry(size, 64, 32), material);
}

export function createCore(size: number) {
  const material = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  return new Mesh(new SphereGeometry(size, 32, 16), material);
}
