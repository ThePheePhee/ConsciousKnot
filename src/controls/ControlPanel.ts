import GUI from 'lil-gui';
import type { Params } from '../math/types';
import { knotLabels } from '../math/knots';

export function createControlPanel(params: Params, onChange: () => void) {
  const gui = new GUI({ title: '4D Knot Rearrangement', width: 340 });
  const knots = Object.fromEntries(Object.entries(knotLabels).map(([key, value]) => [value, key]));

  gui.add(params, 'paused').name('pause');
  gui.add(params, 'globalSpeed', 0, 2, 0.01).name('speed');
  gui.add(params, 'transitionProgress', 0, 1, 0.001).name('transition').onChange(onChange);
  gui.add(params, 'autoTransitionSpeed', 0, 0.18, 0.001).name('auto cycle');

  const topology = gui.addFolder('Topology');
  topology.add(params, 'transitionPath', ['direct spherical', 'three-step spherical', 'local crossing']).name('move').onChange(onChange);
  topology.add(params, 'sourceKnot', knots).name('source').onChange(onChange);
  topology.add(params, 'midKnot', knots).name('via').onChange(onChange);
  topology.add(params, 'targetKnot', knots).name('target').onChange(onChange);
  topology.add(params, 'phaseLockStrength', 0, 1, 0.01).name('phase lock').onChange(onChange);
  topology.add(params, 'symmetryOrder', 3, 12, 1).name('symmetry').onChange(onChange);

  const confinement = gui.addFolder('Spherical Confinement');
  confinement.add(params, 'sphereTightness', 0.65, 1, 0.01).name('sphere tightness').onChange(onChange);
  confinement.add(params, 'liftAmplitude', 0.15, 1.6, 0.01).name('4D lift').onChange(onChange);
  confinement.add(params, 'liftFrequency', 3, 16, 1).name('lift waves').onChange(onChange);
  confinement.add(params, 'ribbonWidth', 0.07, 0.24, 0.005).name('ribbon width').onChange(onChange);

  const local = gui.addFolder('Local Crossing Study');
  local.add(params, 'localCrossingCenter', 0, 1, 0.001).name('center').onChange(onChange);
  local.add(params, 'localCrossingWidth', 0.03, 0.24, 0.001).name('width').onChange(onChange);
  local.add(params, 'localCrossingStrength', 0, 1.6, 0.01).name('strength').onChange(onChange);
  local.add(params, 'localFocusZoom', 0, 1, 0.01).name('focus').onChange(onChange);

  const presentation = gui.addFolder('Presentation');
  presentation.add(params, 'rotationX', -0.18, 0.18, 0.001).name('tilt drift');
  presentation.add(params, 'rotationY', -0.22, 0.22, 0.001).name('turn drift');
  presentation.add(params, 'rotationZ', -0.18, 0.18, 0.001).name('roll drift');
  presentation.add(params, 'diamondLightStrength', 0, 5, 0.01).name('inner light');
  presentation.add(params, 'bloomStrength', 0, 1.2, 0.01).name('bloom');
  return gui;
}
