import GUI from 'lil-gui';
import type { Params } from '../math/types';
import { knotLabels } from '../math/knots';
import { devKnotLabels } from '../math/devKnots';

export function createControlPanel(params: Params, onChange: () => void) {
  const gui = new GUI({ title: '4D Knot Rearrangement', width: 340 });
  const knots = Object.fromEntries(Object.entries(knotLabels).map(([key, value]) => [value, key]));
  const devKnots = Object.fromEntries(Object.entries(devKnotLabels).map(([key, value]) => [value, key]));
  const changed = () => {
    onChange();
    updateVisibility();
  };

  gui.add(params, 'developerMode').name('developer mode').onChange(changed);
  gui.add(params, 'paused').name('pause');
  gui.add(params, 'globalSpeed', 0, 2, 0.01).name('speed');
  gui.add(params, 'transitionProgress', 0, 1, 0.001).name('transition').onChange(onChange);
  gui.add(params, 'autoTransitionSpeed', 0, 0.18, 0.001).name('auto cycle');
  gui.add(params, 'cameraZoom', 0.45, 3.5, 0.01).name('zoom');

  const topology = gui.addFolder('Topology');
  topology.add(params, 'transitionPath', ['direct spherical', 'three-step spherical', 'local crossing']).name('move').onChange(onChange);
  topology.add(params, 'sourceKnot', knots).name('source').onChange(onChange);
  topology.add(params, 'midKnot', knots).name('via').onChange(onChange);
  topology.add(params, 'targetKnot', knots).name('target').onChange(onChange);
  topology.add(params, 'phaseLockStrength', 0, 1, 0.01).name('phase lock').onChange(onChange);
  topology.add(params, 'symmetryOrder', 3, 12, 1).name('symmetry').onChange(onChange);

  const developer = gui.addFolder('Developer Mode');
  developer.add(params, 'devTrajectorySize', 1, 4, 1).name('trajectory knots').onChange(onChange);
  developer.add(params, 'devSourceKnot', devKnots).name('knot 1').onChange(onChange);
  developer.add(params, 'devMidKnot', devKnots).name('knot 2').onChange(onChange);
  developer.add(params, 'devTargetKnot', devKnots).name('knot 3').onChange(onChange);
  developer.add(params, 'devFourthKnot', devKnots).name('knot 4').onChange(onChange);
  developer.add(params, 'devSampleCount', 160, 1400, 1).name('samples').onFinishChange(onChange);
  developer.add(params, 'devCrossSamples', 6, 32, 1).name('ribbon samples').onFinishChange(onChange);
  developer.add(params, 'devRibbonWidth', 0.02, 0.2, 0.005).name('ribbon width').onChange(onChange);
  developer.add(params, 'devLiftAmplitude', 0, 2.4, 0.01).name('4D lift').onChange(onChange);
  developer.add(params, 'devProjectionDistance4D', 2.4, 9, 0.01).name('projection d4').onChange(onChange);
  developer.add(params, 'devCanonicalRelaxation', 0, 0.85, 0.01).name('settle first').onChange(onChange);
  developer.add(params, 'devIntermediateRelaxation', 0, 1, 0.01).name('settle between').onChange(onChange);
  developer.add(params, 'devSimultaneousUncrossings', 1, 5, 1).name('parallel crossings').onChange(onChange);
  developer.add(params, 'devCrossingMode', ['projected intersections', 'hidden 4D passage']).name('crossing view').onChange(onChange);
  developer.add(params, 'devHideDuringUncrossing', 0, 1, 0.01).name('hide passage').onChange(onChange);
  developer.add(params, 'devFourthDimensionDuty', 0.03, 0.45, 0.005).name('4D duty').onChange(onChange);
  developer.add(params, 'devTwistEnabled').name('twisted ribbon').onChange(onChange);
  developer.add(params, 'devTwistTurns', -12, 12, 1).name('twist turns').onChange(onChange);

  const confinement = gui.addFolder('Spherical Confinement');
  confinement.add(params, 'confineProjectedSphere').name('3D sphere').onChange(onChange);
  confinement.add(params, 'confine4DSphere').name('4D sphere').onChange(onChange);
  confinement.add(params, 'sphereTightness', 0.65, 1, 0.01).name('sphere tightness').onChange(onChange);
  confinement.add(params, 'liftAmplitude', 0.15, 1.6, 0.01).name('4D lift').onChange(onChange);
  confinement.add(params, 'liftFrequency', 3, 16, 1).name('lift waves').onChange(onChange);
  confinement.add(params, 'ribbonWidth', 0.07, 0.24, 0.005).name('ribbon width').onChange(onChange);

  const density = gui.addFolder('Occluding Weave');
  density.add(params, 'denseProjection').name('dense mode').onChange(onChange);
  density.add(params, 'densityPasses', 1, 7, 1).name('passes').onFinishChange(onChange);
  density.add(params, 'densityPhaseSpread', 0, 1, 0.01).name('spread').onChange(onChange);

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

  const surface = gui.addFolder('Ribbon Shader');
  surface.add(params, 'oilSlickStrength', 0, 2, 0.01).name('oil slick');
  surface.add(params, 'fractalStrength', 0, 1.5, 0.01).name('fractal surface');
  surface.add(params, 'fibreDensity', 10, 180, 1).name('fibre density');
  surface.add(params, 'fibreStrength', 0, 1.5, 0.01).name('fibre strength');

  const productionFolders = [topology, confinement, density, local];
  const developerFolders = [developer];
  function updateVisibility() {
    for (const folder of productionFolders) folder.domElement.style.display = params.developerMode ? 'none' : '';
    for (const folder of developerFolders) folder.domElement.style.display = params.developerMode ? '' : 'none';
  }
  updateVisibility();
  return gui;
}
