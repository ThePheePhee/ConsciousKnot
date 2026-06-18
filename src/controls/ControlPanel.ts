import GUI from 'lil-gui';
import type { Params } from '../math/types';
import { knotLabels } from '../math/knots';

export function createControlPanel(params: Params, onChange: () => void) {
  const gui = new GUI({ title: 'ConsciousKnot Controls', width: 340 });
  const knots = Object.fromEntries(Object.entries(knotLabels).map(([key, value]) => [value, key]));

  gui.add(params, 'mode', ['3D Knot', '4D Transition']).name('mode').onChange(onChange);
  gui.add(params, 'sampleCount', 180, 820, 1).name('sample count').onFinishChange(onChange);
  gui.add(params, 'crossSamples', 8, 32, 1).name('ribbon samples').onFinishChange(onChange);
  gui.add(params, 'ribbonWidth', 0.05, 0.42, 0.01).name('ribbon width').onChange(onChange);
  gui.add(params, 'edgeFlare', 0, 2.6, 0.01).name('edge flare').onChange(onChange);
  gui.add(params, 'spherizeAmount', 0, 1, 0.01).name('spherize').onChange(onChange);
  gui.add(params, 'tipStrength', 0, 1.5, 0.01).name('ten-tip strength').onChange(onChange);

  const mode3 = gui.addFolder('3D Knot Mode');
  mode3.add(params, 'knotType', knots).name('knot type').onChange(onChange);
  mode3.add(params, 'torusP', 1, 9, 1).name('torus p').onChange(onChange);
  mode3.add(params, 'torusQ', 1, 9, 1).name('torus q').onChange(onChange);
  mode3.add(params, 'slitherAmplitude', 0, 0.7, 0.01).name('slither amplitude').onChange(onChange);
  mode3.add(params, 'slitherSpeed', 0, 2.4, 0.01).name('slither speed');
  mode3.add(params, 'slitherWaveCount', 1, 14, 1).name('slither waves').onChange(onChange);

  const mode4 = gui.addFolder('4D Transition Mode');
  mode4.add(params, 'sourceKnot', knots).name('source knot').onChange(onChange);
  mode4.add(params, 'targetKnot', knots).name('target knot').onChange(onChange);
  mode4.add(params, 'transitionProgress', 0, 1, 0.001).name('transition').onChange(onChange);
  mode4.add(params, 'autoTransitionSpeed', 0, 0.4, 0.001).name('auto speed');
  mode4.add(params, 'liftAmplitude', 0, 2.5, 0.01).name('4D lift').onChange(onChange);
  mode4.add(params, 'projectionDistance4D', 2.2, 8, 0.01).name('projection d4').onChange(onChange);
  mode4.add(params, 'rotateXY', -0.6, 0.6, 0.001).name('XY speed');
  mode4.add(params, 'rotateXZ', -0.6, 0.6, 0.001).name('XZ speed');
  mode4.add(params, 'rotateXW', -0.8, 0.8, 0.001).name('XW speed');
  mode4.add(params, 'rotateYZ', -0.6, 0.6, 0.001).name('YZ speed');
  mode4.add(params, 'rotateYW', -0.8, 0.8, 0.001).name('YW speed');
  mode4.add(params, 'rotateZW', -0.8, 0.8, 0.001).name('ZW speed');

  const motion = gui.addFolder('Rotation and Light');
  motion.add(params, 'rotationX', -0.5, 0.5, 0.001).name('rotate x');
  motion.add(params, 'rotationY', -0.5, 0.5, 0.001).name('rotate y');
  motion.add(params, 'rotationZ', -0.5, 0.5, 0.001).name('rotate z');
  motion.add(params, 'diamondLightStrength', 0, 14, 0.01).name('diamond light');
  motion.add(params, 'bloomStrength', 0, 3, 0.01).name('bloom');
  motion.add(params, 'coreSize', 0.05, 1.1, 0.01).name('core size');
  motion.add(params, 'sparkleStrength', 0, 2, 0.01).name('sparkle');

  const surface = gui.addFolder('Ribbon Shader');
  surface.add(params, 'oilSlickStrength', 0, 2, 0.01).name('oil slick');
  surface.add(params, 'fractalStrength', 0, 1.5, 0.01).name('fractal surface');
  surface.add(params, 'fibreDensity', 10, 140, 1).name('fibre density');
  surface.add(params, 'fibreStrength', 0, 1.5, 0.01).name('fibre strength');
  return gui;
}
