import GUI from 'lil-gui';
import type { Params } from '../math/types';
import { devKnotLabels } from '../math/devKnots';
import { exactSymmetryGroupLabels, exactTransitionModeLabels, exactWeavePatternLabels } from '../symmetric-weave/patterns';

export function createControlPanel(params: Params, onChange: () => void) {
  const gui = new GUI({ title: '4D Ribbon Weave', width: 340 });
  const devKnots = Object.fromEntries(Object.entries(devKnotLabels).map(([key, value]) => [value, key]));
  const exactGroups = Object.fromEntries(Object.entries(exactSymmetryGroupLabels).map(([key, value]) => [value, key]));
  const exactPatterns = Object.fromEntries(Object.entries(exactWeavePatternLabels).map(([key, value]) => [value, key]));
  const exactTransitions = Object.fromEntries(Object.entries(exactTransitionModeLabels).map(([key, value]) => [value, key]));
  const changed = () => {
    onChange();
    updateVisibility();
  };

  withHelp(gui.add(params, 'mainMode', ['exact symmetric shell weave', 'simple knot crossings']).name('mode').onChange(changed), 'Choose between the exact symmetric spherical weave engine and the simple inspectable knot-crossing engine.');
  gui.add(params, 'paused').name('pause');
  gui.add(params, 'globalSpeed', 0, 2, 0.001).name('speed');
  gui.add(params, 'transitionProgress', 0, 1, 0.001).name('transition').onChange(onChange);
  gui.add(params, 'autoTransitionSpeed', 0, 1, 0.001).name('auto cycle');
  gui.add(params, 'autoRotate').name('auto rotate');
  gui.add(params, 'cameraZoom', 0.45, 3.5, 0.01).name('zoom');

  const geometry = gui.addFolder('Shared Geometry');
  withHelp(geometry.add(params, 'sampleCount', 160, 1400, 1).name('samples').onFinishChange(onChange), 'Centerline sample budget for the active mode. Higher values improve geometric smoothness and collision fidelity, at greater rebuild cost.');
  withHelp(geometry.add(params, 'crossSamples', 6, 32, 1).name('ribbon samples').onFinishChange(onChange), 'Samples across each ribbon width. Higher values smooth the ribbon surface across its fibres.');
  withHelp(geometry.add(params, 'ribbonWidth', 0.025, 0.2, 0.005).name('ribbon width').onChange(onChange), 'Physical ribbon width used by both modes. Wider ribbons require more collision work and more shell depth.');
  withHelp(geometry.add(params, 'liftAmplitude', 0, 2.4, 0.01).name('4D lift').onChange(onChange), 'Magnitude of the compact W-axis passage used when crossings must happen outside ordinary 3-space.');
  withHelp(geometry.add(params, 'showWPassage').name('show W passage').onChange(onChange), 'When enabled, W-active sections remain visible as red ghostly material. When disabled, those sections disappear from the 3D projection.');

  const exact = gui.addFolder('Exact Symmetric Shell');
  withHelp(exact.add(params, 'exactSymmetryGroup', exactGroups).name('symmetry group').onChange(onChange), 'Finite dihedral group used to replicate every ribbon motif. The whole object is generated as group orbits, so symmetry is exact as a set.');
  withHelp(exact.add(params, 'exactTrajectorySize', 2, 4, 1).name('trajectory weaves').onChange(onChange), 'Number of exact weave states in the cycle. Three or four creates a longer smooth path through the next selected symmetric states.');
  withHelp(exact.add(params, 'exactSource', exactPatterns).name('weave 1').onChange(onChange), 'Starting symmetric weave family.');
  withHelp(exact.add(params, 'exactTarget', exactPatterns).name('weave 2').onChange(onChange), 'Second symmetric weave family. With trajectory weaves set to 2, this is the target.');
  withHelp(exact.add(params, 'exactThird', exactPatterns).name('weave 3').onChange(onChange), 'Third symmetric weave family used when trajectory weaves is set to 3 or 4.');
  withHelp(exact.add(params, 'exactFourth', exactPatterns).name('weave 4').onChange(onChange), 'Fourth symmetric weave family used by the longest exact weave trajectory.');
  withHelp(exact.add(params, 'exactTransitionMode', exactTransitions).name('crossing schedule').onChange(onChange), 'How W passages are scheduled. Orbit crossings preserves exact symmetry by moving whole crossing orbits; local study intentionally breaks symmetry to inspect one neighborhood.');
  withHelp(exact.add(params, 'shellRadius', 0.9, 1.9, 0.005).name('shell radius').onChange(onChange), 'Mean radius of the symmetric spherical shell.');
  withHelp(exact.add(params, 'shellThickness', 0.18, 0.72, 0.005).name('shell depth').onChange(onChange), 'Radial layer depth used for over-under separation in ordinary 3D space.');
  withHelp(exact.add(params, 'exactRelaxationSteps', 0, 8, 1).name('relax steps').onFinishChange(onChange), 'Equivariant local smoothing applied inside each generated orbit. It smooths without creating W or changing crossing schedules.');
  withHelp(exact.add(params, 'exactSymmetrySettle', 0, 1, 0.01).name('symmetry settle').onChange(onChange), 'Projects the relaxed weave back toward its exact rotational orbit structure after collision solving. Higher values favor cleaner symmetric states; lower values leave more local material freedom.');
  withHelp(exact.add(params, 'exactSolidSolve').name('solid fibres').onChange(onChange), 'Runs a material-style solid-contact solve. Ribbon lanes are treated as finite-width fibres that crease and slide instead of passing through each other.');
  withHelp(exact.add(params, 'exactSolidPasses', 0, 12, 1).name('solid passes').onFinishChange(onChange), 'Number of solid-contact constraint passes. Higher values catch more 3D self-intersections and wide-ribbon contacts, but cost more rebuild time.');
  withHelp(exact.add(params, 'exactCreaseStrength', 0, 1, 0.01).name('crease response').onChange(onChange), 'How strongly contact pushes spread into neighboring samples as visible creases. Higher values make collisions resolve through bends rather than sharp local overlaps.');
  withHelp(exact.add(params, 'adaptivePlayback').name('adaptive playback').onChange(onChange), 'When enabled, animated playback uses a lighter cached solve while paused inspection and scrubbing still use the full solid-fibre settings.');
  withHelp(exact.add(params, 'playbackQuality', 0.15, 1, 0.01).name('live quality').onChange(onChange), 'Quality budget for moving playback. Higher values use more samples and contact passes while running; lower values prioritize continuous motion.');
  withHelp(exact.add(params, 'playbackCacheFrames', 24, 180, 1).name('cache frames').onFinishChange(onChange), 'Number of transition positions used for cached live playback. Higher values are more temporally precise; lower values reuse solved frames more often.');

  const simple = gui.addFolder('Simple Knot Crossings');
  withHelp(simple.add(params, 'simpleTrajectorySize', 1, 4, 1).name('trajectory knots').onChange(onChange), 'How many knots are used in the simple crossing path. A value of 2 means knot 1 goes directly to knot 2; higher values include the next selected knots as intermediate embeddings.');
  withHelp(simple.add(params, 'simpleSourceKnot', devKnots).name('knot 1').onChange(onChange), 'Initial embedded 3D knot in the transition trajectory.');
  withHelp(simple.add(params, 'simpleMidKnot', devKnots).name('knot 2').onChange(onChange), 'Second knot in the trajectory. With trajectory knots set to 2, this is the target knot.');
  withHelp(simple.add(params, 'simpleTargetKnot', devKnots).name('knot 3').onChange(onChange), 'Third knot in a three- or four-step trajectory.');
  withHelp(simple.add(params, 'simpleFourthKnot', devKnots).name('knot 4').onChange(onChange), 'Fourth knot in the longest simple trajectory.');
  withHelp(simple.add(params, 'simpleSimultaneousUncrossings', 1, 5, 1).name('parallel crossings').onChange(onChange), 'How many localized crossing windows are allowed at the same time. Lower values isolate one move; higher values show multiple W-axis passages in parallel.');
  withHelp(simple.add(params, 'simpleCrossingMode', ['projected intersections', 'hidden 4D passage']).name('crossing view').onChange(onChange), 'Projected intersections keeps W equal to zero for validation. Hidden 4D passage performs the crossing by lifting localized strands into the fourth dimension.');
  withHelp(simple.add(params, 'simpleSphereMode', ['off', 'contain ball', 'radial shell', 'symmetric shell']).name('sphere mode').onChange(onChange), 'Constrains the simple knot toward a spherical envelope. Use off for raw knot validation; use shell modes to study spherical packing.');
  withHelp(simple.add(params, 'simpleSphereStrength', 0, 1, 0.001).name('sphere strength').onChange(onChange), 'Blend strength for the spherical envelope.');
  withHelp(simple.add(params, 'simpleSphereRadius', 0.8, 2.4, 0.005).name('sphere radius').onChange(onChange), 'Target radius of the simple-mode spherical envelope.');
  withHelp(simple.add(params, 'simpleSphereSymmetry', 3, 12, 1).name('sphere symmetry').onChange(onChange), 'Symmetry order used by the simple symmetric shell mode to distribute folds around the sphere.');
  withHelp(simple.add(params, 'simpleSelfAvoidance').name('self avoid').onChange(onChange), 'Keeps non-neighboring parts of the simple ribbon separated after knot morphing and shell projection.');
  withHelp(simple.add(params, 'simpleSelfAvoidanceStrength', 0, 1, 0.01).name('avoid strength').onChange(onChange), 'How strongly self-avoidance pushes apart distant parts of the ribbon when they get closer than tube clearance.');
  withHelp(simple.add(params, 'simpleSelfAvoidanceIterations', 0, 10, 1).name('avoid passes').onFinishChange(onChange), 'Number of self-avoidance solver passes.');
  withHelp(simple.add(params, 'simpleTubeClearance', 1.2, 5.5, 0.05).name('tube clearance').onChange(onChange), 'Minimum centerline separation in multiples of ribbon width.');
  withHelp(simple.add(params, 'simpleProjectionDistance4D', 2.4, 8, 0.01).name('4D projection').onChange(onChange), 'Projection distance used when simple crossing passages move through W.');
  withHelp(simple.add(params, 'simpleHideDuringUncrossing', 0, 1, 0.01).name('hide passage').onChange(onChange), 'How much the ribbon narrows during the localized 4D passage. This is a visual cue; the mathematical W excursion is controlled by 4D lift.');
  withHelp(simple.add(params, 'simpleFourthDimensionDuty', 0.005, 0.25, 0.001).name('4D duty').onChange(onChange), 'Temporal width of the W-axis crossing window. Low values make brief excursions; higher values keep the crossing in 4D for a larger fraction of the transition.');
  withHelp(simple.add(params, 'simpleTwistEnabled').name('twisted ribbon').onChange(onChange), 'Toggles framing twist on the ribbon. This rotates the ribbon frame around the 3D centerline; it should not move the knot centerline into W.');
  withHelp(simple.add(params, 'simpleTwistTurns', -12, 12, 1).name('twist turns').onChange(onChange), 'Integer number of full rotations applied to the ribbon framing around the centerline.');

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

  function updateVisibility() {
    exact.domElement.style.display = params.mainMode === 'exact symmetric shell weave' ? '' : 'none';
    simple.domElement.style.display = params.mainMode === 'simple knot crossings' ? '' : 'none';
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
