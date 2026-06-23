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
export type DevCoreMode = 'exact symmetric shell weave' | 'spherical shell weave' | 'legacy knot curve';
export type ExactSymmetryGroup = 'D6' | 'D8' | 'D10';
export type ExactWeavePattern = 'dihedral basket' | 'temari orbit' | 'trihex orbit' | 'geodesic flower';
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
  developerMode: boolean;
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
  autoRotate: boolean;
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
  confineProjectedSphere: boolean;
  confine4DSphere: boolean;
  denseProjection: boolean;
  densityPasses: number;
  densityPhaseSpread: number;
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
  cameraZoom: number;
  devSourceKnot: DevKnotKind;
  devMidKnot: DevKnotKind;
  devTargetKnot: DevKnotKind;
  devFourthKnot: DevKnotKind;
  devCoreMode: DevCoreMode;
  devExactSymmetryGroup: ExactSymmetryGroup;
  devExactSource: ExactWeavePattern;
  devExactTarget: ExactWeavePattern;
  devExactTransitionMode: ExactTransitionMode;
  devExactRelaxationSteps: number;
  devShellSource: DevShellPattern;
  devShellTarget: DevShellPattern;
  devShellRadius: number;
  devShellThickness: number;
  devTrajectorySize: number;
  devTransitionPath: TransitionPath;
  devSampleCount: number;
  devCrossSamples: number;
  devRibbonWidth: number;
  devLiftAmplitude: number;
  devProjectionDistance4D: number;
  devSimultaneousUncrossings: number;
  devCrossingMode: DevCrossingMode;
  devShowWPassage: boolean;
  devSphereMode: DevSphereMode;
  devSphereStrength: number;
  devSphereRadius: number;
  devSphereSymmetry: number;
  devSelfAvoidance: boolean;
  devSelfAvoidanceStrength: number;
  devSelfAvoidanceIterations: number;
  devTubeClearance: number;
  devPhysicsMode: boolean;
  devPhysicsSubsteps: number;
  devPhysicsBend: number;
  devHideDuringUncrossing: number;
  devFourthDimensionDuty: number;
  devTwistEnabled: boolean;
  devTwistTurns: number;
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
