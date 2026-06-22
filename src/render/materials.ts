import { AdditiveBlending, DoubleSide, ShaderMaterial, SphereGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import vertexShader from '../shaders/ribbon4d.vert.glsl?raw';
import classicVertexShader from '../shaders/ribbon.vert.glsl?raw';
import fragmentShader from '../shaders/ribbon.frag.glsl?raw';
import type { KnotKind, Params, TransitionPath } from '../math/types';

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
      colorScale: { value: 12.0 },
      corePosition: { value: new Vector3() },
      transitionProgress: { value: params.transitionProgress },
      sourceKind: { value: knotKindId(params.sourceKnot) },
      midKind: { value: knotKindId(params.midKnot) },
      targetKind: { value: knotKindId(params.targetKnot) },
      transitionPath: { value: transitionPathId(params.transitionPath) },
      torusP: { value: params.torusP },
      torusQ: { value: params.torusQ },
      ribbonWidth: { value: params.ribbonWidth },
      edgeFlare: { value: params.edgeFlare },
      tipStrength: { value: params.tipStrength },
      liftAmplitude: { value: params.liftAmplitude },
      liftFrequency: { value: params.liftFrequency },
      sphereTightness: { value: params.sphereTightness },
      confineProjectedSphere: { value: params.confineProjectedSphere ? 1 : 0 },
      confine4DSphere: { value: params.confine4DSphere ? 1 : 0 },
      denseProjection: { value: params.denseProjection ? 1 : 0 },
      densityPasses: { value: params.densityPasses },
      densityPhaseSpread: { value: params.densityPhaseSpread },
      symmetryOrder: { value: params.symmetryOrder },
      phaseSourceMid: { value: 0 },
      phaseSourceTarget: { value: 0 },
      phaseMidTarget: { value: 0 },
      localCrossingCenter: { value: params.localCrossingCenter },
      localCrossingWidth: { value: params.localCrossingWidth },
      localCrossingStrength: { value: params.localCrossingStrength },
      localFocusZoom: { value: params.localFocusZoom },
      projectionDistance4D: { value: params.projectionDistance4D },
      rotateXY: { value: 0 },
      rotateXZ: { value: 0 },
      rotateXW: { value: 0 },
      rotateYZ: { value: 0 },
      rotateYW: { value: 0 },
      rotateZW: { value: 0 },
    },
  });
}

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
      colorSpeed: { value: 0.18 },
      colorScale: { value: 12.0 },
      corePosition: { value: new Vector3() },
    },
  });
}

export function knotKindId(kind: KnotKind) {
  const ids: Record<KnotKind, number> = {
    unknot: 0,
    trefoil: 1,
    cinquefoil: 2,
    torus34: 3,
    torus53: 4,
    torus85: 5,
    torus118: 6,
    torus137: 7,
    consciousOrb: 8,
    figureEight: 9,
    customTorus: 10,
  };
  return ids[kind];
}

export function transitionPathId(path: TransitionPath) {
  if (path === 'direct spherical') return 0;
  if (path === 'three-step spherical') return 1;
  return 2;
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
