import { Vector3, Vector4 } from 'three';
import { devKnotPoint } from '../math/devKnots';
import { project4Dto3D } from '../math/projection4';
import { buildFrames } from '../math/frames3';
import { buildRibbonMesh3D } from './buildRibbonMesh3D';
import type { DevKnotKind, TransitionPath } from '../math/types';

interface DeveloperRibbonOptions {
  source: DevKnotKind;
  mid: DevKnotKind;
  target: DevKnotKind;
  path: TransitionPath;
  progress: number;
  samples: number;
  width: number;
  crossSamples: number;
  liftAmplitude: number;
  projectionDistance4D: number;
  twistTurns: number;
}

export function buildDeveloperRibbonMesh(options: DeveloperRibbonOptions) {
  const a = smoothstep(options.progress);
  const points: Vector3[] = [];
  for (let i = 0; i < options.samples; i++) {
    const t = (i / options.samples) * Math.PI * 2;
    const source = devKnotPoint(options.source, t);
    const mid = devKnotPoint(options.mid, t);
    const target = devKnotPoint(options.target, t);
    const xyz = options.path === 'three-step spherical' ? (a < 0.5 ? source.clone().lerp(mid, smoothstep(a * 2)) : mid.clone().lerp(target, smoothstep((a - 0.5) * 2))) : source.clone().lerp(target, a);
    const lift = options.liftAmplitude * Math.sin(Math.PI * a) * Math.sin(3 * t);
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
