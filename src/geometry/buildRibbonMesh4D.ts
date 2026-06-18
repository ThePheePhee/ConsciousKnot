import { BufferAttribute, BufferGeometry } from 'three';
import { buildRibbonMesh3D } from './buildRibbonMesh3D';
import { sampleCurve4D } from '../math/frames4';
import type { Curve4DOptions } from '../math/types';

export function buildRibbonMesh4D(options: Curve4DOptions, width: number, edgeFlare: number, crossSamples: number) {
  if (!options.denseProjection || options.densityPasses <= 1) {
    return buildRibbonMesh3D(sampleCurve4D({ ...options, densityPhaseOffset: 0 }), width, edgeFlare, crossSamples);
  }

  const passes = Math.max(1, Math.round(options.densityPasses));
  const geometries: BufferGeometry[] = [];
  for (let i = 0; i < passes; i++) {
    const centered = i - (passes - 1) / 2;
    const phase = centered * options.densityPhaseSpread * (Math.PI * 2) / Math.max(3, Math.round(options.symmetryOrder) * passes);
    const passWidth = width * (0.92 + 0.18 * Math.cos((i / passes) * Math.PI * 2));
    geometries.push(buildRibbonMesh3D(sampleCurve4D({ ...options, densityPhaseOffset: phase }), passWidth, edgeFlare, crossSamples));
  }

  return mergeGeometries(geometries);
}

function mergeGeometries(geometries: BufferGeometry[]) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const geometry of geometries) {
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < position.count; i++) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      uvs.push(uv.getX(i), uv.getY(i));
    }
    const index = geometry.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + vertexOffset);
    }
    vertexOffset += position.count;
    geometry.dispose();
  }

  const merged = new BufferGeometry();
  merged.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  merged.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  merged.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  merged.setIndex(indices);
  merged.computeBoundingSphere();
  return merged;
}
