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
export type DevCrossingMode = 'projected intersections' | 'hidden 4D passage';
export type DevSphereMode = 'off' | 'contain ball' | 'radial shell' | 'symmetric shell';
export type MainMode = 'exact symmetric shell weave' | 'simple knot crossings';
export type ExactSymmetryGroup = 'D6' | 'D8' | 'D10';
export type ExactWeavePattern =
  | 'dihedral basket'
  | 'temari orbit'
  | 'trihex orbit'
  | 'geodesic flower'
  | 'loxodrome lattice'
  | 'kagome rosette'
  | 'goldberg shell'
  | 'flower-of-life shell'
  | 'pentagonal star braid'
  | 'dense phyllotaxis';
export type ExactTransitionMode = 'orbit crossings' | 'phase-staggered orbits' | 'local study';
export type DevShellPattern =
  | 'unknot shell'
  | 'trefoil shell'
  | 'figure-eight shell'
  | 'pentafoil shell'
  | 'sixfold shell weave'
  | 'loxodrome basket shell'
  | 'temari flower shell'
  | 'trihex kagome shell'
  | 'goldberg geodesic shell'
  | 'phyllotactic dense shell';
export type DevKnotKind = string;

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
  sampleCount: number;
  crossSamples: number;
  ribbonWidth: number;
  paused: boolean;
  globalSpeed: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  autoRotate: boolean;
  diamondLightStrength: number;
  innerFogEnabled: boolean;
  innerFogStrength: number;
  bloomStrength: number;
  coreSize: number;
  sparkleStrength: number;
  oilSlickStrength: number;
  fractalStrength: number;
  fibreDensity: number;
  fibreStrength: number;
  transitionProgress: number;
  autoTransitionSpeed: number;
  liftAmplitude: number;
  showWPassage: boolean;
  cameraOrbit: number;
  cameraZoom: number;
  mainMode: MainMode;
  exactSymmetryGroup: ExactSymmetryGroup;
  exactTrajectorySize: number;
  exactSource: ExactWeavePattern;
  exactTarget: ExactWeavePattern;
  exactThird: ExactWeavePattern;
  exactFourth: ExactWeavePattern;
  exactTransitionMode: ExactTransitionMode;
  exactRelaxationSteps: number;
  exactSymmetrySettle: number;
  exactSolidSolve: boolean;
  exactSolidPasses: number;
  exactCreaseStrength: number;
  adaptivePlayback: boolean;
  playbackQuality: number;
  playbackCacheFrames: number;
  shellRadius: number;
  shellThickness: number;
  simpleSourceKnot: DevKnotKind;
  simpleMidKnot: DevKnotKind;
  simpleTargetKnot: DevKnotKind;
  simpleFourthKnot: DevKnotKind;
  simpleTrajectorySize: number;
  simpleProjectionDistance4D: number;
  simpleSimultaneousUncrossings: number;
  simpleCrossingMode: DevCrossingMode;
  simpleSphereMode: DevSphereMode;
  simpleSphereStrength: number;
  simpleSphereRadius: number;
  simpleSphereSymmetry: number;
  simpleSelfAvoidance: boolean;
  simpleSelfAvoidanceStrength: number;
  simpleSelfAvoidanceIterations: number;
  simpleTubeClearance: number;
  simpleHideDuringUncrossing: number;
  simpleFourthDimensionDuty: number;
  simpleTwistEnabled: boolean;
  simpleTwistTurns: number;
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
  confineProjectedSphere: boolean;
  confine4DSphere: boolean;
  denseProjection: boolean;
  densityPasses: number;
  densityPhaseSpread: number;
  densityPhaseOffset: number;
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
