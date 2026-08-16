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
      morphAlpha: { value: 0 },
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
    depthTest: false,
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

      float diamondFacet(vec3 ray, float scale, float phase) {
        vec3 p = ray * scale + vec3(phase, phase * 0.37, -phase * 0.61);
        float a = abs(sin(dot(p, vec3(5.31, 8.17, 3.73))));
        float b = abs(sin(dot(p, vec3(-6.73, 2.41, 7.93))));
        float c = abs(sin(dot(p, vec3(4.19, -7.11, 5.67))));
        return pow(a * b * c, 10.0);
      }

      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(vViewDir);
        vec3 ray = normalize(vWorldPosition - cameraPosition);
        vec3 coreRay = normalize(corePosition - cameraPosition);
        float alignment = max(dot(ray, coreRay), 0.0);
        float broadShaft = pow(alignment, 2.25);
        float narrowShaft = pow(alignment, 18.0);
        float rim = pow(1.0 - abs(dot(n, v)), 1.35);
        float murk = valueNoise(ray * 5.4 + vec3(time * 0.012, time * 0.019, -time * 0.015));
        float fineMurk = valueNoise(ray * 18.0 + vec3(-time * 0.018, time * 0.011, time * 0.023));
        float breath = 0.84 + 0.16 * sin(time * 0.46 + murk * 6.28318);
        float facet = diamondFacet(ray, 4.2, time * 0.035) + 0.65 * diamondFacet(ray, 8.7, time * 0.021 + 2.0);
        float shimmer = smoothstep(0.12, 0.48, facet) * (0.5 + 0.5 * fineMurk);
        float haze = 0.008 + 0.038 * broadShaft + 0.014 * rim + 0.058 * narrowShaft;
        haze += shimmer * (0.012 + 0.036 * broadShaft);
        haze *= breath * (0.72 + 0.28 * murk);
        float alpha = intensity * lightStrength * haze;
        vec3 blue = vec3(0.36, 0.72, 1.0);
        vec3 opal = vec3(0.92, 0.78, 1.0);
        vec3 warm = vec3(1.0, 0.83, 0.58);
        vec3 color = mix(blue, opal, murk * 0.55 + broadShaft * 0.18);
        color = mix(color, warm, narrowShaft * 0.32 + shimmer * 0.18);
        color += vec3(0.75, 0.96, 1.0) * shimmer * 1.15;
        gl_FragColor = vec4(color * alpha * 7.2, clamp(alpha, 0.0, 0.12));
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
