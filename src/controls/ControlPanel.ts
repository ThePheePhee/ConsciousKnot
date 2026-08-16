import GUI from 'lil-gui';
import type { Params } from '../math/types';

export function createControlPanel(params: Params, onChange: () => void) {
  const gui = new GUI({ title: 'Knot of Consciousness', width: 292 });

  gui.add(params, 'paused').name('pause');
  gui.add(params, 'globalSpeed', 0.05, 1.65, 0.001).name('speed');
  gui.add(params, 'transitionProgress', 0, 1, 0.001).name('transition').onChange(onChange);
  gui.add(params, 'autoTransitionSpeed', 0, 0.18, 0.001).name('cycle');
  gui.add(params, 'showWPassage').name('W transitions').onChange(onChange);
  gui.add(params, 'cameraZoom', 0.62, 2.4, 0.01).name('zoom');

  return gui;
}
