import { buildRibbonMesh3D } from './buildRibbonMesh3D';
import { sampleCurve4D } from '../math/frames4';
import type { Curve4DOptions } from '../math/types';

export function buildRibbonMesh4D(options: Curve4DOptions, width: number, edgeFlare: number, crossSamples: number) {
  return buildRibbonMesh3D(sampleCurve4D(options), width, edgeFlare, crossSamples);
}
