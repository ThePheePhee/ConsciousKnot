import GUI from 'lil-gui';
import type { Params } from '../math/types';
import { knotLabels } from '../math/knots';
import { devKnotLabels } from '../math/devKnots';
import { devShellPatternLabels } from '../math/sphericalWeaves';

export function createControlPanel(params: Params, onChange: () => void) {
  const gui = new GUI({ title: '4D Knot Rearrangement', width: 340 });
  const knots = Object.fromEntries(Object.entries(knotLabels).map(([key, value]) => [value, key]));
  const devKnots = Object.fromEntries(Object.entries(devKnotLabels).map(([key, value]) => [value, key]));
  const shellPatterns = Object.fromEntries(Object.entries(devShellPatternLabels).map(([key, value]) => [value, key]));
  const changed = () => {
    onChange();
    updateVisibility();
  };

  gui.add(params, 'developerMode').name('developer mode').onChange(changed);
  gui.add(params, 'paused').name('pause');
  gui.add(params, 'globalSpeed', 0, 2, 0.001).name('speed');
  gui.add(params, 'transitionProgress', 0, 1, 0.001).name('transition').onChange(onChange);
  gui.add(params, 'autoTransitionSpeed', 0, 1, 0.001).name('auto cycle');
  gui.add(params, 'autoRotate').name('auto rotate');
  gui.add(params, 'cameraZoom', 0.45, 3.5, 0.01).name('zoom');

  const topology = gui.addFolder('Topology');
  topology.add(params, 'transitionPath', ['direct spherical', 'three-step spherical', 'local crossing']).name('move').onChange(onChange);
  topology.add(params, 'sourceKnot', knots).name('source').onChange(onChange);
  topology.add(params, 'midKnot', knots).name('via').onChange(onChange);
  topology.add(params, 'targetKnot', knots).name('target').onChange(onChange);
  topology.add(params, 'phaseLockStrength', 0, 1, 0.01).name('phase lock').onChange(onChange);
  topology.add(params, 'symmetryOrder', 3, 12, 1).name('symmetry').onChange(onChange);

  const developerRoot = gui.addFolder('Developer Mode');
  withHelp(developerRoot.add(params, 'devCoreMode', ['spherical shell weave', 'legacy knot curve']).name('core').onChange(changed), 'Choose the mathematical core used in developer mode. Spherical shell weave builds a knot diagram natively in a thickened spherical shell. Legacy knot curve keeps the earlier Euclidean knot-curve inspection path.');

  const shellDeveloper = gui.addFolder('Spherical Shell Developer');
  withHelp(shellDeveloper.add(params, 'devShellSource', shellPatterns).name('source shell').onChange(onChange), 'Starting spherical-shell diagram. These are realized in S2 x I, using radial height for over/under information rather than flattening onto one sphere.');
  withHelp(shellDeveloper.add(params, 'devShellTarget', shellPatterns).name('target shell').onChange(onChange), 'Target spherical-shell diagram for the transition.');
  withHelp(shellDeveloper.add(params, 'transitionProgress', 0, 1, 0.0005).name('scrub').onChange(onChange), 'Scrub the shell-native transition. Stable endpoints have W equal to zero; middle frames mark compact fourth-dimensional crossing-change neighborhoods.');
  withHelp(shellDeveloper.add(params, 'devSampleCount', 240, 1200, 1).name('samples').onFinishChange(onChange), 'Centerline samples used by the shell embedding and self-avoidance pass.');
  withHelp(shellDeveloper.add(params, 'devCrossSamples', 8, 32, 1).name('ribbon samples').onFinishChange(onChange), 'Samples across the ribbon width.');
  withHelp(shellDeveloper.add(params, 'devRibbonWidth', 0.025, 0.16, 0.005).name('ribbon width').onChange(onChange), 'Physical ribbon width. The shell solver treats this as tube thickness when separating non-neighboring branches.');
  withHelp(shellDeveloper.add(params, 'devShellRadius', 0.9, 1.9, 0.005).name('shell radius').onChange(onChange), 'Mean radius of the spherical shell.');
  withHelp(shellDeveloper.add(params, 'devShellThickness', 0.12, 0.7, 0.005).name('shell depth').onChange(onChange), 'Available radial depth for over/under weaving inside S2 x I.');
  withHelp(shellDeveloper.add(params, 'devLiftAmplitude', 0, 2.4, 0.01).name('4D lift').onChange(onChange), 'Diagnostic W lift for compact crossing-change neighborhoods during shell-diagram transitions.');
  withHelp(shellDeveloper.add(params, 'devShowWPassage').name('show W passage').onChange(onChange), 'When enabled, the compact W neighborhoods turn red and fade with W depth. Stable shell states should not show red.');
  withHelp(shellDeveloper.add(params, 'devSelfAvoidanceStrength', 0, 1, 0.01).name('avoid strength').onChange(onChange), 'Strength of the constrained shell solver. It alternates elastic relaxation toward a lower-energy symmetric curve with tube-thickness separation for visible 3D ribbon branches.');
  withHelp(shellDeveloper.add(params, 'devSelfAvoidanceIterations', 0, 12, 1).name('avoid passes').onFinishChange(onChange), 'Number of relaxation/separation passes. Higher values better remove tight contacts in dense shell weaves, at greater rebuild cost.');
  withHelp(shellDeveloper.add(params, 'devTubeClearance', 1.2, 6.0, 0.05).name('tube clearance').onChange(onChange), 'Minimum centerline clearance in ribbon-width units for visible 3D branches. W-active crossing neighborhoods are exempt while they are outside ordinary 3-space.');
  withHelp(shellDeveloper.add(params, 'devSphereSymmetry', 2, 16, 1).name('forced symmetry').onChange(onChange), 'Symmetry order used by the high-width footprint solver when choosing curl directions around hard contacts. Higher values encourage more repeated, mandala-like conflict resolutions.');

  const legacyDeveloper = gui.addFolder('Legacy Curve Developer');
  withHelp(legacyDeveloper.add(params, 'devTrajectorySize', 1, 4, 1).name('trajectory knots').onChange(onChange), 'How many knots are used in the legacy developer-mode path. A value of 2 means knot 1 goes directly to knot 2; higher values include the next selected knots as intermediate embeddings.');
  withHelp(legacyDeveloper.add(params, 'devSourceKnot', devKnots).name('knot 1').onChange(onChange), 'The initial embedded 3D knot in the transition trajectory.');
  withHelp(legacyDeveloper.add(params, 'devMidKnot', devKnots).name('knot 2').onChange(onChange), 'The second knot in the trajectory. With trajectory knots set to 2, this is the target knot.');
  withHelp(legacyDeveloper.add(params, 'devTargetKnot', devKnots).name('knot 3').onChange(onChange), 'The third knot in a three- or four-step trajectory.');
  withHelp(legacyDeveloper.add(params, 'devFourthKnot', devKnots).name('knot 4').onChange(onChange), 'The fourth knot in the longest developer trajectory.');
  withHelp(legacyDeveloper.add(params, 'transitionProgress', 0, 1, 0.0005).name('paused scrub').onChange(onChange), 'When paused, use this to scrub backward and forward through the transition for frame-by-frame inspection.');
  withHelp(legacyDeveloper.add(params, 'devSampleCount', 160, 1400, 1).name('samples').onFinishChange(onChange), 'Number of samples along the closed knot centerline. Higher values make smoother curves and more accurate crossings, but cost more CPU/GPU upload time in developer mode.');
  withHelp(legacyDeveloper.add(params, 'devCrossSamples', 6, 32, 1).name('ribbon samples').onFinishChange(onChange), 'Number of samples across the ribbon width. Higher values make the ribbon surface smoother across its width.');
  withHelp(legacyDeveloper.add(params, 'devRibbonWidth', 0.02, 0.2, 0.005).name('ribbon width').onChange(onChange), 'Physical width of the inspectable ribbon around the knot centerline.');
  withHelp(legacyDeveloper.add(params, 'devLiftAmplitude', 0, 2.4, 0.01).name('4D lift').onChange(onChange), 'Maximum W-axis displacement during a crossing move. In hidden 4D passage mode, this is the actual fourth-dimensional excursion that separates strands without a 3D self-intersection.');
  withHelp(legacyDeveloper.add(params, 'devSimultaneousUncrossings', 1, 5, 1).name('parallel crossings').onChange(onChange), 'How many localized crossing windows are allowed at the same time along the ribbon. Lower values isolate one move; higher values show multiple W-axis passages in parallel.');
  withHelp(legacyDeveloper.add(params, 'devCrossingMode', ['projected intersections', 'hidden 4D passage']).name('crossing view').onChange(onChange), 'Projected intersections keeps W equal to zero so you can inspect the 3D self-intersection. Hidden 4D passage performs the crossing by lifting localized strands into the fourth dimension.');
  withHelp(legacyDeveloper.add(params, 'devShowWPassage').name('show W passage').onChange(onChange), 'When enabled, ribbon sections with nonzero W remain visible, turn red, and become more translucent as their fourth-dimensional displacement increases.');
  withHelp(legacyDeveloper.add(params, 'devSphereMode', ['off', 'contain ball', 'radial shell', 'symmetric shell']).name('sphere mode').onChange(onChange), 'Constrains the developer knot toward a spherical envelope. Contain ball only prevents escape; radial shell pulls toward a round sphere; symmetric shell adds a low-amplitude symmetric shell modulation.');
  withHelp(legacyDeveloper.add(params, 'devSphereStrength', 0, 1, 0.001).name('sphere strength').onChange(onChange), 'Blend strength for the spherical envelope. Use 0 for raw knot validation and 1 for maximum shell conformance.');
  withHelp(legacyDeveloper.add(params, 'devSphereRadius', 0.8, 2.4, 0.005).name('sphere radius').onChange(onChange), 'Target radius of the developer-mode spherical envelope.');
  withHelp(legacyDeveloper.add(params, 'devSphereSymmetry', 3, 12, 1).name('sphere symmetry').onChange(onChange), 'Symmetry order used by the symmetric shell mode to distribute folds around the sphere.');
  withHelp(legacyDeveloper.add(params, 'devSelfAvoidance').name('self avoid').onChange(onChange), 'Keeps non-neighboring parts of the developer ribbon separated after knot morphing and spherical shell projection. This is a tube-thickness relaxation, not just a visual offset.');
  withHelp(legacyDeveloper.add(params, 'devSelfAvoidanceStrength', 0, 1, 0.01).name('avoid strength').onChange(onChange), 'How strongly the self-avoidance relaxation pushes apart distant parts of the ribbon when they get closer than the tube clearance.');
  withHelp(legacyDeveloper.add(params, 'devSelfAvoidanceIterations', 0, 10, 1).name('avoid passes').onFinishChange(onChange), 'Number of self-avoidance solver passes. More passes catch harder shell-compression conflicts but cost more CPU when the developer mesh rebuilds.');
  withHelp(legacyDeveloper.add(params, 'devTubeClearance', 1.2, 5.5, 0.05).name('tube clearance').onChange(onChange), 'Minimum centerline separation in multiples of ribbon width. Larger values make intersections less likely but may fight tight spherical packing.');
  withHelp(legacyDeveloper.add(params, 'devHideDuringUncrossing', 0, 1, 0.01).name('hide passage').onChange(onChange), 'How much the ribbon narrows during the localized 4D passage. This is only a visual cue; the mathematical W excursion is controlled by 4D lift.');
  withHelp(legacyDeveloper.add(params, 'devFourthDimensionDuty', 0.005, 0.25, 0.001).name('4D duty').onChange(onChange), 'Temporal width of the W-axis crossing window. Low values make brief excursions; higher values keep the crossing in 4D for a larger fraction of the transition.');
  withHelp(legacyDeveloper.add(params, 'devTwistEnabled').name('twisted ribbon').onChange(onChange), 'Toggles framing twist on the ribbon. This rotates the ribbon frame around the 3D centerline; it should not move the knot centerline into W.');
  withHelp(legacyDeveloper.add(params, 'devTwistTurns', -12, 12, 1).name('twist turns').onChange(onChange), 'Integer number of full rotations applied to the ribbon framing around the centerline.');

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
  function updateVisibility() {
    for (const folder of productionFolders) folder.domElement.style.display = params.developerMode ? 'none' : '';
    developerRoot.domElement.style.display = params.developerMode ? '' : 'none';
    shellDeveloper.domElement.style.display = params.developerMode && params.devCoreMode === 'spherical shell weave' ? '' : 'none';
    legacyDeveloper.domElement.style.display = params.developerMode && params.devCoreMode === 'legacy knot curve' ? '' : 'none';
  }
  updateVisibility();
  return gui;
}

function withHelp<T extends { domElement: HTMLElement }>(controller: T, message: string) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '?';
  button.title = message;
  button.style.width = '18px';
  button.style.height = '18px';
  button.style.marginLeft = '6px';
  button.style.padding = '0';
  button.style.border = '1px solid rgba(255, 255, 255, 0.35)';
  button.style.borderRadius = '50%';
  button.style.background = 'rgba(255, 255, 255, 0.08)';
  button.style.color = '#ffffff';
  button.style.fontSize = '11px';
  button.style.lineHeight = '16px';
  button.style.cursor = 'help';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.alert(message);
  });
  controller.domElement.appendChild(button);
  return controller;
}
