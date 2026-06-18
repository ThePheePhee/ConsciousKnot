import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import type { RibbonFrame } from '../math/types';

export function buildRibbonMesh3D(frames: RibbonFrame[], width: number, edgeFlare: number, crossSamples: number): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const n = frames.length;
  const m = crossSamples;

  for (let i = 0; i < n; i++) {
    const f = frames[i];
    for (let j = 0; j < m; j++) {
      const v = j / (m - 1);
      const u = v * 2 - 1;
      const edge = Math.pow(Math.abs(u), 3.4);
      const localWidth = width * (0.82 + 0.3 * f.pinch);
      const lip = edgeFlare * edge * width * 0.42;
      const pos = f.position
        .clone()
        .add(f.normal.clone().multiplyScalar(localWidth * u))
        .add(f.outward.clone().multiplyScalar(lip + 0.05 * edge * f.pinch));
      const normal = new Vector3()
        .addScaledVector(f.binormal, 0.36)
        .addScaledVector(f.outward, 0.84 + edge * 0.7)
        .addScaledVector(f.normal, u * edgeFlare * 0.18)
        .normalize();
      positions.push(pos.x, pos.y, pos.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(i / n, v);
    }
  }

  for (let i = 0; i < n; i++) {
    const ni = (i + 1) % n;
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j;
      const b = ni * m + j;
      const c = ni * m + j + 1;
      const d = i * m + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
