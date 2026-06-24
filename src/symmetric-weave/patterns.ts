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
  'loxodrome lattice': 'loxodrome lattice',
  'kagome rosette': 'kagome rosette',
  'goldberg shell': 'goldberg shell',
  'flower-of-life shell': 'flower-of-life shell',
  'pentagonal star braid': 'pentagonal star braid',
  'dense phyllotaxis': 'dense phyllotaxis',
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
    case 'loxodrome lattice':
      return {
        pattern,
        layerFrequency: 7,
        layerDepth: 0.6,
        orbitLayerCoupling: 1.2,
        motifs: [
          motif(0.76, 0.1, 5, 0.27, 0.42, 0.35, 0.05, 0.1, 0.02, 1),
          motif(2.38, 0.48, 5, 0.27, 0.42, 1.92, 0.05, 2.2, -0.02, -1),
        ],
      };
    case 'kagome rosette':
      return {
        pattern,
        layerFrequency: 6,
        layerDepth: 0.68,
        orbitLayerCoupling: 1.5,
        motifs: [
          motif(0.9, 0.08, 3, 0.31, 0.2, 0.0, 0.1, 0.3, 0.05, 1),
          motif(1.62, 0.28, 4, 0.29, 0.28, 1.4, 0.07, 1.9, 0.0, -1),
          motif(2.34, 0.48, 3, 0.31, 0.2, 2.8, 0.1, 3.5, -0.05, 1),
        ],
      };
    case 'goldberg shell':
      return {
        pattern,
        layerFrequency: 8,
        layerDepth: 0.62,
        orbitLayerCoupling: 2.1,
        motifs: [
          motif(0.72, 0.18, 5, 0.26, 0.18, 0.2, 0.08, 0.6, 0.04, 1),
          motif(1.58, 0.36, 6, 0.24, 0.25, 1.7, 0.06, 2.2, 0.0, -1),
          motif(2.4, 0.56, 5, 0.26, 0.18, 3.2, 0.08, 3.8, -0.04, 1),
        ],
      };
    case 'flower-of-life shell':
      return {
        pattern,
        layerFrequency: 6,
        layerDepth: 0.56,
        orbitLayerCoupling: 1.0,
        motifs: [
          motif(0.84, 0.05, 6, 0.24, 0.12, 0.0, 0.14, 0.0, 0.04, 1),
          motif(2.3, 0.52, 6, 0.24, 0.12, 1.05, 0.14, 3.14, -0.04, -1),
        ],
      };
    case 'pentagonal star braid':
      return {
        pattern,
        layerFrequency: 5,
        layerDepth: 0.66,
        orbitLayerCoupling: 1.8,
        motifs: [
          motif(0.68, 0.12, 5, 0.34, 0.33, 0.1, 0.08, 0.8, 0.03, 1),
          motif(2.5, 0.48, 5, 0.34, 0.33, 2.0, 0.08, 2.9, -0.03, -1),
        ],
      };
    case 'dense phyllotaxis':
      return {
        pattern,
        layerFrequency: 9,
        layerDepth: 0.58,
        orbitLayerCoupling: 2.4,
        motifs: [
          motif(0.7, 0.18, 7, 0.22, 0.2, 0.0, 0.06, 0.2, 0.04, 1),
          motif(1.55, 0.34, 8, 0.2, 0.24, 1.9, 0.05, 2.5, 0.0, -1),
          motif(2.42, 0.54, 7, 0.22, 0.2, 3.8, 0.06, 4.2, -0.04, 1),
        ],
      };
    case 'temari orbit':
      return {
        pattern,
        layerFrequency: 4,
        layerDepth: 0.62,
        orbitLayerCoupling: 1.0,
        motifs: [
          motif(0.94, 0.18, 4, 0.33, 0.24, 0.2, 0.06, 0.4, 0.03, 1),
          motif(2.16, 0.34, 5, 0.31, 0.22, 1.5, 0.07, 2.8, -0.03, -1),
        ],
      };
    case 'trihex orbit':
      return {
        pattern,
        layerFrequency: 5,
        layerDepth: 0.66,
        orbitLayerCoupling: 1.5,
        motifs: [
          motif(1.02, 0.12, 3, 0.36, 0.26, 0.1, 0.04, 0.0, 0.04, 1),
          motif(2.02, 0.36, 4, 0.32, 0.24, 2.2, 0.05, 2.4, -0.04, -1),
        ],
      };
    case 'geodesic flower':
      return {
        pattern,
        layerFrequency: 6,
        layerDepth: 0.64,
        orbitLayerCoupling: 2.0,
        motifs: [
          motif(0.82, 0.16, 5, 0.34, 0.2, 0.0, 0.08, 0.7, 0.05, 1),
          motif(2.24, 0.4, 5, 0.32, 0.22, 2.9, 0.08, 3.4, -0.05, -1),
        ],
      };
    case 'dihedral basket':
    default:
      return {
        pattern: 'dihedral basket',
        layerFrequency: 3,
        layerDepth: 0.6,
        orbitLayerCoupling: 1.0,
        motifs: [
          motif(1.02, 0.14, 2, 0.34, 0.25, 0.2, 0.03, 0.0, 0.04, 1),
          motif(2.05, 0.38, 3, 0.3, 0.22, 1.9, 0.04, 2.4, -0.04, -1),
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
