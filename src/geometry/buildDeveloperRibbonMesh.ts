import { Vector3, Vector4 } from 'three';
import { devKnotPoint } from '../math/devKnots';
import { project4Dto3D } from '../math/projection4';
import { buildFrames } from '../math/frames3';
import { buildRibbonMesh3D } from './buildRibbonMesh3D';
import type { DevKnotKind, TransitionPath } from '../math/types';

interface DeveloperRibbonOptions {
  knots: DevKnotKind[];
  progress: number;
  samples: number;
  width: number;
  crossSamples: number;
  liftAmplitude: number;
  projectionDistance4D: number;
  canonicalRelaxation: number;
  intermediateRelaxation: number;
  simultaneousUncrossings: number;
  twistTurns: number;
}

export function buildDeveloperRibbonMesh(options: DeveloperRibbonOptions) {
  const knots = options.knots.length > 0 ? options.knots : ['unknot' as DevKnotKind];
  const segmentCount = Math.max(1, knots.length - 1);
  const segmentPosition = Math.min(0.999999, Math.max(0, options.progress)) * segmentCount;
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(segmentPosition));
  const segmentT = segmentCount === 1 && knots.length === 1 ? 0 : segmentPosition - segmentIndex;
  const sourceKnot = knots[segmentIndex] ?? knots[0];
  const targetKnot = knots[Math.min(segmentIndex + 1, knots.length - 1)] ?? sourceKnot;
  const stage = stagedProgress(segmentT, segmentIndex, options);
  const points: Vector3[] = [];
  for (let i = 0; i < options.samples; i++) {
    const t = (i / options.samples) * Math.PI * 2;
    const source = devKnotPoint(sourceKnot, t);
    const target = devKnotPoint(targetKnot, t);
    const xyz = source.clone().lerp(target, stage.morph);
    const lift = options.liftAmplitude * stage.crossingWindow * localizedLift(t, segmentIndex, options.simultaneousUncrossings);
    points.push(project4Dto3D(new Vector4(xyz.x, xyz.y, xyz.z, lift), options.projectionDistance4D));
  }
  const frames = buildFrames(points, 0);
  if (Math.abs(options.twistTurns) > 0.0001) {
    for (let i = 0; i < frames.length; i++) {
      const angle = options.twistTurns * Math.PI * 2 * (i / frames.length);
      frames[i].normal.applyAxisAngle(frames[i].tangent, angle).normalize();
      frames[i].binormal.crossVectors(frames[i].tangent, frames[i].normal).normalize();
    }
  }
  return buildRibbonMesh3D(frames, options.width, 0.2, options.crossSamples);
}

function smoothstep(x: number) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function stagedProgress(segmentT: number, segmentIndex: number, options: DeveloperRibbonOptions) {
  const relax = Math.min(0.85, Math.max(0, segmentIndex === 0 ? options.canonicalRelaxation : options.intermediateRelaxation));
  if (segmentT < relax) {
    return { morph: 0, crossingWindow: 0 };
  }
  const crossingT = smoothstep((segmentT - relax) / Math.max(0.0001, 1 - relax));
  return {
    morph: crossingT,
    crossingWindow: Math.sin(Math.PI * crossingT),
  };
}

function localizedLift(t: number, segmentIndex: number, simultaneousUncrossings: number) {
  const count = Math.max(1, Math.round(simultaneousUncrossings));
  let lift = 0;
  for (let i = 0; i < count; i++) {
    const center = ((i + 0.5) / count) * Math.PI * 2 + segmentIndex * 0.73;
    const d = Math.atan2(Math.sin(t - center), Math.cos(t - center));
    const window = Math.exp(-(d * d) / 0.18);
    lift += window * Math.sin(t * (2 + i) + segmentIndex);
  }
  return lift / Math.sqrt(count);
}
