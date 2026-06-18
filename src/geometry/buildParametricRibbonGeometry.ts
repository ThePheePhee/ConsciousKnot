import { BufferAttribute, BufferGeometry } from 'three';

export function buildParametricRibbonGeometry(samples: number, crossSamples: number, passes: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const params: number[] = [];
  const indices: number[] = [];
  const n = Math.max(16, Math.round(samples));
  const m = Math.max(4, Math.round(crossSamples));
  const p = Math.max(1, Math.round(passes));

  for (let pass = 0; pass < p; pass++) {
    const passValue = p === 1 ? 0 : pass - (p - 1) / 2;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      for (let j = 0; j < m; j++) {
        const v = j / (m - 1);
        positions.push(0, 0, 0);
        normals.push(0, 0, 1);
        uvs.push(t, v);
        params.push(t, v * 2 - 1, passValue);
      }
    }
  }

  for (let pass = 0; pass < p; pass++) {
    const base = pass * n * m;
    for (let i = 0; i < n; i++) {
      const ni = (i + 1) % n;
      for (let j = 0; j < m - 1; j++) {
        const a = base + i * m + j;
        const b = base + ni * m + j;
        const c = base + ni * m + j + 1;
        const d = base + i * m + j + 1;
        indices.push(a, b, d, b, c, d);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setAttribute('aRibbon', new BufferAttribute(new Float32Array(params), 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
