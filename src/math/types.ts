import type { Vector3, Vector4 } from 'three';

export type KnotKind =
  | 'unknot'
  | 'trefoil'
  | 'cinquefoil'
  | 'torus34'
  | 'torus53'
  | 'torus85'
  | 'torus118'
  | 'torus137'
  | 'consciousOrb'
  | 'figureEight'
  | 'customTorus';
export type Mode = '3D Knot' | '4D Transition';
export type TransitionPath = 'direct spherical' | 'three-step spherical' | 'local crossing';

export interface RibbonFrame {
  position: Vector3;
  tangent: Vector3;
  normal: Vector3;
  binormal: Vector3;
  outward: Vector3;
  pinch: number;
}

export interface CurveOptions {
  knot: KnotKind;
  torusP: number;
  torusQ: number;
  samples: number;
  time: number;
  slitherAmplitude: number;
  slitherSpeed: number;
  slitherWaveCount: number;
  spherizeAmount: number;
  tipStrength: number;
}

export interface Params {
  mode: Mode;
  sampleCount: number;
  crossSamples: number;
  ribbonWidth: number;
  edgeFlare: number;
  spherizeAmount: number;
  tipStrength: number;
  paused: boolean;
  globalSpeed: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  diamondLightStrength: number;
  bloomStrength: number;
  coreSize: number;
  sparkleStrength: number;
  knotType: KnotKind;
  torusP: number;
  torusQ: number;
  slitherAmplitude: number;
  slitherSpeed: number;
  slitherWaveCount: number;
  oilSlickStrength: number;
  fractalStrength: number;
  fibreDensity: number;
  fibreStrength: number;
  sourceKnot: KnotKind;
  midKnot: KnotKind;
  targetKnot: KnotKind;
  transitionPath: TransitionPath;
  transitionProgress: number;
  autoTransitionSpeed: number;
  liftAmplitude: number;
  liftFrequency: number;
  sphereTightness: number;
  symmetryOrder: number;
  phaseLockStrength: number;
  phaseSearchSteps: number;
  localCrossingCenter: number;
  localCrossingWidth: number;
  localCrossingStrength: number;
  localFocusZoom: number;
  projectionDistance4D: number;
  rotateXY: number;
  rotateXZ: number;
  rotateXW: number;
  rotateYZ: number;
  rotateYW: number;
  rotateZW: number;
  cameraOrbit: number;
}

export interface Curve4DOptions extends CurveOptions {
  sourceKnot: KnotKind;
  midKnot: KnotKind;
  targetKnot: KnotKind;
  transitionPath: TransitionPath;
  transitionProgress: number;
  liftAmplitude: number;
  liftFrequency: number;
  sphereTightness: number;
  symmetryOrder: number;
  phaseLockStrength: number;
  phaseSearchSteps: number;
  localCrossingCenter: number;
  localCrossingWidth: number;
  localCrossingStrength: number;
  localFocusZoom: number;
  projectionDistance4D: number;
  rotations: Record<'xy' | 'xz' | 'xw' | 'yz' | 'yw' | 'zw', number>;
}

export interface Projected4DPoint {
  p4: Vector4;
  p3: Vector3;
}
