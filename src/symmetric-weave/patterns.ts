import type { ExactSymmetryGroup, ExactTransitionMode, ExactWeavePattern } from '../math/types';

export const exactSymmetryGroupLabels: Record<ExactSymmetryGroup, string> = {
  D6: 'D6 dihedral',
  D8: 'D8 dihedral',
  D10: 'D10 dihedral',
};

export const exactWeavePatternLabels: Record<ExactWeavePattern, string> = {
  'dihedral basket': 'dihedral basket',
  'temari orbit': 'temari orbit',
  'trihex orbit': 'trihex orbit',
  'geodesic flower': 'geodesic flower',
};

export const exactTransitionModeLabels: Record<ExactTransitionMode, string> = {
  'orbit crossings': 'orbit crossings',
  'phase-staggered orbits': 'phase-staggered orbits',
  'local study': 'local study',
};

export interface ExactWeaveMotif {
  tilt: number;
  roll: number;
  waves: number;
  amplitude: number;
  skew: number;
  phase: number;
  petal: number;
  layerPhase: number;
  layerBias: number;
  handedness: number;
}

export interface ExactWeaveSpec {
  pattern: ExactWeavePattern;
  layerFrequency: number;
  layerDepth: number;
  orbitLayerCoupling: number;
  motifs: ExactWeaveMotif[];
}

export function exactWeaveSpec(pattern: ExactWeavePattern): ExactWeaveSpec {
  switch (pattern) {
    case 'temari orbit':
      return {
        pattern,
        layerFrequency: 6,
        layerDepth: 0.82,
        orbitLayerCoupling: 1.0,
        motifs: [
          motif(0.62, 0.08, 3, 0.46, 0.14, 0.2, 0.08, 0.4, 0.03, 1),
          motif(0.92, 0.42, 4, 0.38, -0.1, 1.4, 0.1, 2.2, -0.02, -1),
          motif(1.18, -0.28, 5, 0.32, 0.08, 2.7, 0.06, 4.0, 0.0, 1),
        ],
      };
    case 'trihex orbit':
      return {
        pattern,
        layerFrequency: 8,
        layerDepth: 0.9,
        orbitLayerCoupling: 1.5,
        motifs: [
          motif(0.7, 0.0, 4, 0.44, 0.1, 0.1, 0.04, 0.0, 0.04, 1),
          motif(1.02, 0.32, 4, 0.42, -0.12, 2.15, 0.05, 2.05, -0.03, -1),
          motif(1.26, -0.36, 6, 0.34, 0.09, 4.1, 0.04, 4.2, 0.0, 1),
        ],
      };
    case 'geodesic flower':
      return {
        pattern,
        layerFrequency: 10,
        layerDepth: 0.86,
        orbitLayerCoupling: 2.0,
        motifs: [
          motif(0.56, 0.1, 5, 0.4, 0.09, 0.0, 0.1, 0.7, 0.05, 1),
          motif(0.98, -0.22, 6, 0.34, 0.07, 1.8, 0.08, 2.8, 0.0, -1),
          motif(1.32, 0.48, 5, 0.36, -0.08, 3.5, 0.1, 5.0, -0.04, 1),
        ],
      };
    case 'dihedral basket':
    default:
      return {
        pattern: 'dihedral basket',
        layerFrequency: 5,
        layerDepth: 0.78,
        orbitLayerCoupling: 1.0,
        motifs: [
          motif(0.72, 0.0, 2, 0.48, 0.1, 0.2, 0.02, 0.0, 0.05, 1),
          motif(1.06, 0.36, 3, 0.38, -0.08, 1.7, 0.04, 2.4, -0.03, -1),
          motif(1.28, -0.24, 2, 0.32, 0.06, 3.2, 0.02, 4.2, 0.0, 1),
        ],
      };
  }
}

function motif(
  tilt: number,
  roll: number,
  waves: number,
  amplitude: number,
  skew: number,
  phase: number,
  petal: number,
  layerPhase: number,
  layerBias: number,
  handedness: number,
): ExactWeaveMotif {
  return { tilt, roll, waves, amplitude, skew, phase, petal, layerPhase, layerBias, handedness };
}

