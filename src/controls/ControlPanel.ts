import GUI from 'lil-gui';
import type { Params, ProductionWeavePreset } from '../math/types';

const weaveChoices: Record<string, ProductionWeavePreset> = {
  'reference triad': 'reference triad',
  'flower lattice': 'flower lattice',
  'dense shell': 'dense shell',
};

const productionPresets: Record<ProductionWeavePreset, Partial<Params>> = {
  'reference triad': {
    exactSymmetryGroup: 'D6',
    exactTrajectorySize: 3,
    exactSource: 'dihedral basket',
    exactTarget: 'trihex orbit',
    exactThird: 'kagome rosette',
    exactFourth: 'goldberg shell',
    shellRadius: 1.34,
    shellThickness: 0.28,
    ribbonWidth: 0.16,
  },
  'flower lattice': {
    exactSymmetryGroup: 'D10',
    exactTrajectorySize: 3,
    exactSource: 'geodesic flower',
    exactTarget: 'flower-of-life shell',
    exactThird: 'temari orbit',
    exactFourth: 'pentagonal star braid',
    shellRadius: 1.32,
    shellThickness: 0.32,
    ribbonWidth: 0.13,
  },
  'dense shell': {
    exactSymmetryGroup: 'D8',
    exactTrajectorySize: 3,
    exactSource: 'goldberg shell',
    exactTarget: 'dense phyllotaxis',
    exactThird: 'loxodrome lattice',
    exactFourth: 'kagome rosette',
    shellRadius: 1.36,
    shellThickness: 0.34,
    ribbonWidth: 0.115,
  },
};

export function createControlPanel(params: Params, onChange: () => void) {
  const gui = new GUI({ title: 'Replication: Knot of Consciousness', width: 292 });

  gui.add(params, 'paused').name('pause');
  gui.add(params, 'globalSpeed', 0.05, 1.65, 0.001).name('speed');
  gui.add(params, 'transitionProgress', 0, 1, 0.001).name('transition').onChange(onChange);
  gui.add(params, 'autoTransitionSpeed', 0, 0.18, 0.001).name('cycle');
  gui.add(params, 'productionWeavePreset', weaveChoices).name('weave').onChange((preset: ProductionWeavePreset) => {
    applyProductionPreset(params, preset);
    onChange();
  });
  gui.add(params, 'showWPassage').name('W transitions').onChange(onChange);
  gui.add(params, 'cameraZoom', 0.62, 2.4, 0.01).name('zoom');

  return gui;
}

function applyProductionPreset(params: Params, preset: ProductionWeavePreset) {
  params.productionWeavePreset = preset;
  Object.assign(params, productionPresets[preset]);
}
