import { Vector4 } from 'three';
import { knotPoint } from './knots';
import { project4Dto3D } from './projection4';
import { rotate4D } from './rotations4';
import { spherizePoint } from './spherize';
import { buildFrames } from './frames3';
import type { Curve4DOptions, RibbonFrame } from './types';

export function sampleCurve4D(options: Curve4DOptions): RibbonFrame[] {
  const points3 = [];
  const a = options.transitionProgress;
  for (let i = 0; i < options.samples; i++) {
    const t = (i / options.samples) * Math.PI * 2;
    const source = spherizePoint(knotPoint(options.sourceKnot, t, options.torusP, options.torusQ), options.spherizeAmount, options.tipStrength, t);
    const shiftedT = t + 0.35 * Math.sin(Math.PI * a);
    const target = spherizePoint(knotPoint(options.targetKnot, shiftedT, options.torusP, options.torusQ), options.spherizeAmount, options.tipStrength, shiftedT);
    const xyz = source.lerp(target, a);
    const lift = options.liftAmplitude * Math.sin(Math.PI * a) * Math.sin(5 * t + options.time * 0.6);
    const p4 = rotate4D(new Vector4(xyz.x, xyz.y, xyz.z, lift), options.rotations);
    points3.push(project4Dto3D(p4, options.projectionDistance4D));
  }
  return buildFrames(points3, options.tipStrength);
}
