import { AdditiveBlending, ShaderMaterial, SphereGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import vertexShader from '../shaders/ribbon.vert.glsl?raw';
import fragmentShader from '../shaders/ribbon.frag.glsl?raw';
import type { Params } from '../math/types';

export function createRibbonMaterial(params: Params) {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      time: { value: 0 },
      oilSlickStrength: { value: params.oilSlickStrength },
      fractalStrength: { value: params.fractalStrength },
      fibreDensity: { value: params.fibreDensity },
      fibreStrength: { value: params.fibreStrength },
      lightStrength: { value: params.diamondLightStrength },
      colorSpeed: { value: 0.18 },
      colorScale: { value: 8.5 },
      corePosition: { value: new Vector3() },
    },
  });
}

export function createCore(size: number) {
  const material = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.92,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  return new Mesh(new SphereGeometry(size, 32, 16), material);
}
