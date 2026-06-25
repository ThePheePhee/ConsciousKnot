import { useEffect, useRef } from 'react';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  Vector2,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { buildParametricRibbonGeometry } from '../geometry/buildParametricRibbonGeometry';
import { buildDeveloperRibbonMesh } from '../geometry/buildDeveloperRibbonMesh';
import { buildSphericalWeaveRibbonMesh } from '../geometry/buildSphericalWeaveRibbonMesh';
import { buildExactSymmetricWeaveMesh } from '../symmetric-weave/mesh';
import { createControlPanel } from '../controls/ControlPanel';
import { defaultParams } from '../controls/defaultParams';
import { createClassicRibbonMaterial, createCore, createRibbonMaterial, knotKindId, transitionPathId } from './materials';
import { addLights } from './lights';
import { knotPoint } from '../math/knots';
import { spherizePoint } from '../math/spherize';
import type { KnotKind, Params } from '../math/types';

export function KnotScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    const params: Params = { ...defaultParams };
    let dirty = true;
    let time = 0;
    let transitionClock = params.transitionProgress;

    const scene = new Scene();
    scene.background = new Color(0x000000);
    const camera = new PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.01, 100);
    camera.position.set(0, 0, 5.5);

    const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = 'srgb';
    mount.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new Vector2(mount.clientWidth, mount.clientHeight), params.bloomStrength, 0.36, 0.72);
    composer.addPass(bloom);

    addLights(scene);
    const interactionRig = new Group();
    scene.add(interactionRig);
    const material = createRibbonMaterial(params);
    const knot = new Mesh(new BufferGeometry(), material);
    interactionRig.add(knot);
    const developerMaterial = createClassicRibbonMaterial(params);
    const developerKnot = new Mesh(new BufferGeometry(), developerMaterial);
    interactionRig.add(developerKnot);
    const exactGeometryCache = new Map<string, BufferGeometry>();
    const cachedExactGeometries = new Set<BufferGeometry>();
    const maxExactGeometryCacheEntries = 48;
    let phaseCacheKey = '';
    let phaseSourceMid = 0;
    let phaseSourceTarget = 0;
    let phaseMidTarget = 0;

    const core = createCore(params.coreSize);
    core.visible = false;
    interactionRig.add(core);
    const sparkleMaterial = new MeshBasicMaterial({ color: 0xeef8ff, transparent: true, opacity: 0.48, blending: AdditiveBlending });
    const sparkles = Array.from({ length: 6 }, (_, i) => {
      const s = new Mesh(new SphereGeometry(0.012, 12, 8), sparkleMaterial);
      const a = (i / 10) * Math.PI * 2;
      s.position.set(Math.cos(a) * 1.75, Math.sin(a) * 1.75, 0.12 * Math.sin(5 * a));
      interactionRig.add(s);
      return s;
    });

    const updateGeometry = () => {
      const old = knot.geometry;
      const passes = params.denseProjection ? Math.round(params.densityPasses) : 1;
      knot.geometry = buildParametricRibbonGeometry(Math.round(params.sampleCount), Math.round(params.crossSamples), passes);
      old.dispose();
      dirty = false;
    };

    const disposeDeveloperGeometry = (geometry: BufferGeometry) => {
      if (!cachedExactGeometries.has(geometry)) geometry.dispose();
    };

    const setDeveloperGeometry = (geometry: BufferGeometry) => {
      const old = developerKnot.geometry;
      developerKnot.geometry = geometry;
      if (old !== geometry) disposeDeveloperGeometry(old);
      dirty = false;
    };

    const cacheExactGeometry = (key: string, geometry: BufferGeometry) => {
      exactGeometryCache.set(key, geometry);
      cachedExactGeometries.add(geometry);
      while (exactGeometryCache.size > maxExactGeometryCacheEntries) {
        const oldest = exactGeometryCache.entries().next().value as [string, BufferGeometry] | undefined;
        if (!oldest) break;
        const [oldestKey, oldestGeometry] = oldest;
        exactGeometryCache.delete(oldestKey);
        cachedExactGeometries.delete(oldestGeometry);
        if (developerKnot.geometry !== oldestGeometry) oldestGeometry.dispose();
      }
    };

    const clearExactGeometryCache = () => {
      for (const geometry of exactGeometryCache.values()) {
        if (developerKnot.geometry !== geometry) geometry.dispose();
      }
      exactGeometryCache.clear();
      cachedExactGeometries.clear();
    };

    const updateDeveloperGeometry = () => {
      if (params.devCoreMode === 'exact symmetric shell weave') {
        const livePlayback = params.devAdaptivePlayback && !params.paused && !dragging && params.autoTransitionSpeed > 0 && params.globalSpeed > 0;
        const quality = clamp01Number(params.devPlaybackQuality);
        const sampleScale = livePlayback ? 0.65 + 0.35 * quality : 1;
        const crossScale = livePlayback ? 0.55 + 0.45 * quality : 1;
        const relaxationScale = livePlayback ? 0.45 + 0.45 * quality : 1;
        const solidScale = livePlayback ? 0.16 + 0.46 * quality : 1;
        const relaxationSteps = params.devExactRelaxationSteps > 0
          ? Math.max(livePlayback ? 1 : 0, Math.round(params.devExactRelaxationSteps * relaxationScale))
          : 0;
        const solidPasses = params.devExactSolidSolve && params.devExactSolidPasses > 0
          ? Math.max(livePlayback ? 1 : 0, Math.round(params.devExactSolidPasses * solidScale))
          : 0;
        const progress = livePlayback
          ? quantizeProgress(params.transitionProgress, Math.round(params.devPlaybackCacheFrames))
          : params.transitionProgress;
        const cacheKey = livePlayback ? exactGeometryCacheKey(params, progress, quality) : '';
        const cached = livePlayback ? exactGeometryCache.get(cacheKey) : undefined;
        if (cached) {
          exactGeometryCache.delete(cacheKey);
          exactGeometryCache.set(cacheKey, cached);
          setDeveloperGeometry(cached);
          return;
        }

        const geometry = buildExactSymmetricWeaveMesh({
          group: params.devExactSymmetryGroup,
          sourcePattern: params.devExactSource,
          targetPattern: params.devExactTarget,
          trajectoryPatterns: [
            params.devExactSource,
            params.devExactTarget,
            params.devExactThird,
            params.devExactFourth,
          ].slice(0, Math.round(params.devExactTrajectorySize)),
          transitionMode: params.devExactTransitionMode,
          progress,
          samples: Math.max(180, Math.round(params.devSampleCount * sampleScale)),
          crossSamples: Math.max(6, Math.round(params.devCrossSamples * crossScale)),
          width: params.devRibbonWidth,
          shellRadius: params.devShellRadius,
          shellThickness: params.devShellThickness,
          liftAmplitude: params.devLiftAmplitude,
          showWPassage: params.devShowWPassage,
          relaxationSteps,
          symmetrySettle: params.devExactSymmetrySettle,
          solidSolve: params.devExactSolidSolve,
          solidPasses,
          creaseStrength: params.devExactCreaseStrength,
        });
        if (livePlayback) cacheExactGeometry(cacheKey, geometry);
        setDeveloperGeometry(geometry);
      } else if (params.devCoreMode === 'spherical shell weave') {
        setDeveloperGeometry(buildSphericalWeaveRibbonMesh({
            sourcePattern: params.devShellSource,
            targetPattern: params.devShellTarget,
            progress: params.transitionProgress,
            samples: Math.round(params.devSampleCount),
            crossSamples: Math.round(params.devCrossSamples),
            width: params.devRibbonWidth,
            shellRadius: params.devShellRadius,
            shellThickness: params.devShellThickness,
            liftAmplitude: params.devLiftAmplitude,
            showWPassage: params.devShowWPassage,
            selfAvoidanceStrength: params.devSelfAvoidanceStrength,
            selfAvoidanceIterations: params.devSelfAvoidanceIterations,
            tubeClearance: params.devTubeClearance,
            symmetryOrder: params.devSphereSymmetry,
            physicsMode: params.devPhysicsMode,
            physicsSubsteps: params.devPhysicsSubsteps,
            physicsBend: params.devPhysicsBend,
          }));
      } else {
        setDeveloperGeometry(buildDeveloperRibbonMesh({
            knots: [params.devSourceKnot, params.devMidKnot, params.devTargetKnot, params.devFourthKnot].slice(0, Math.round(params.devTrajectorySize)),
            progress: params.transitionProgress,
            samples: Math.round(params.devSampleCount),
            crossSamples: Math.round(params.devCrossSamples),
            width: params.devRibbonWidth,
            liftAmplitude: params.devLiftAmplitude,
            projectionDistance4D: params.devProjectionDistance4D,
            simultaneousUncrossings: params.devSimultaneousUncrossings,
            crossingMode: params.devCrossingMode,
            showWPassage: params.devShowWPassage,
            sphereMode: params.devSphereMode,
            sphereStrength: params.devSphereStrength,
            sphereRadius: params.devSphereRadius,
            sphereSymmetry: params.devSphereSymmetry,
            selfAvoidance: params.devSelfAvoidance,
            selfAvoidanceStrength: params.devSelfAvoidanceStrength,
            selfAvoidanceIterations: params.devSelfAvoidanceIterations,
            tubeClearance: params.devTubeClearance,
            hideDuringUncrossing: params.devHideDuringUncrossing,
            fourthDimensionDuty: params.devFourthDimensionDuty,
            twistTurns: params.devTwistEnabled ? params.devTwistTurns : 0,
          }));
      }
    };

    const updateUniforms = () => {
      const nextPhaseKey = [
        params.sourceKnot,
        params.midKnot,
        params.targetKnot,
        params.torusP,
        params.torusQ,
        params.tipStrength,
        params.symmetryOrder,
        params.phaseLockStrength,
        params.phaseSearchSteps,
      ].join('|');
      if (nextPhaseKey !== phaseCacheKey) {
        phaseCacheKey = nextPhaseKey;
        phaseSourceMid = alignedPhase(params.sourceKnot, params.midKnot, params);
        phaseSourceTarget = alignedPhase(params.sourceKnot, params.targetKnot, params);
        phaseMidTarget = alignedPhase(params.midKnot, params.targetKnot, params);
      }
      const uniforms = material.uniforms;
      uniforms.time.value = time;
      uniforms.oilSlickStrength.value = params.oilSlickStrength;
      uniforms.fractalStrength.value = params.fractalStrength;
      uniforms.fibreDensity.value = params.fibreDensity;
      uniforms.fibreStrength.value = params.fibreStrength;
      uniforms.lightStrength.value = params.diamondLightStrength;
      uniforms.corePosition.value = core.position;
      uniforms.transitionProgress.value = params.transitionProgress;
      uniforms.sourceKind.value = knotKindId(params.sourceKnot);
      uniforms.midKind.value = knotKindId(params.midKnot);
      uniforms.targetKind.value = knotKindId(params.targetKnot);
      uniforms.transitionPath.value = transitionPathId(params.transitionPath);
      uniforms.torusP.value = params.torusP;
      uniforms.torusQ.value = params.torusQ;
      uniforms.ribbonWidth.value = params.ribbonWidth;
      uniforms.edgeFlare.value = params.edgeFlare;
      uniforms.tipStrength.value = params.tipStrength;
      uniforms.liftAmplitude.value = params.liftAmplitude;
      uniforms.liftFrequency.value = params.liftFrequency;
      uniforms.sphereTightness.value = params.sphereTightness;
      uniforms.confineProjectedSphere.value = params.confineProjectedSphere ? 1 : 0;
      uniforms.confine4DSphere.value = params.confine4DSphere ? 1 : 0;
      uniforms.denseProjection.value = params.denseProjection ? 1 : 0;
      uniforms.densityPasses.value = params.denseProjection ? Math.round(params.densityPasses) : 1;
      uniforms.densityPhaseSpread.value = params.densityPhaseSpread;
      uniforms.symmetryOrder.value = Math.round(params.symmetryOrder);
      uniforms.phaseSourceMid.value = phaseSourceMid;
      uniforms.phaseSourceTarget.value = phaseSourceTarget;
      uniforms.phaseMidTarget.value = phaseMidTarget;
      uniforms.localCrossingCenter.value = params.localCrossingCenter;
      uniforms.localCrossingWidth.value = params.localCrossingWidth;
      uniforms.localCrossingStrength.value = params.localCrossingStrength;
      uniforms.localFocusZoom.value = params.localFocusZoom;
      uniforms.projectionDistance4D.value = params.projectionDistance4D;
      uniforms.rotateXY.value = time * params.rotateXY;
      uniforms.rotateXZ.value = time * params.rotateXZ;
      uniforms.rotateXW.value = time * params.rotateXW;
      uniforms.rotateYZ.value = time * params.rotateYZ;
      uniforms.rotateYW.value = time * params.rotateYW;
      uniforms.rotateZW.value = time * params.rotateZW;
    };

    const updateDeveloperUniforms = () => {
      const uniforms = developerMaterial.uniforms;
      uniforms.time.value = params.developerMode ? 0 : time;
      uniforms.oilSlickStrength.value = params.oilSlickStrength;
      uniforms.fractalStrength.value = params.fractalStrength;
      uniforms.fibreDensity.value = params.fibreDensity;
      uniforms.fibreStrength.value = params.fibreStrength;
      uniforms.lightStrength.value = params.diamondLightStrength;
      uniforms.corePosition.value = core.position;
    };

    const gui = createControlPanel(params, () => {
      clearExactGeometryCache();
      dirty = true;
    });

    const onResize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      composer.setSize(width, height);
      bloom.setSize(width, height);
    };
    window.addEventListener('resize', onResize);

    let dragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      renderer.domElement.style.cursor = 'grabbing';
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      interactionRig.rotation.y += dx * 0.006;
      interactionRig.rotation.x += dy * 0.006;
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      renderer.domElement.style.cursor = 'grab';
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    };
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);

    let frame = 0;
    let raf = 0;
    let lastNow = performance.now();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      const speed = params.paused || dragging ? 0 : params.globalSpeed;
      time += delta * speed;
      frame++;
      if (params.paused) {
        transitionClock = params.developerMode ? inversePingPong(params.transitionProgress) : params.transitionProgress;
      } else if (params.autoTransitionSpeed > 0 && speed > 0) {
        transitionClock = (transitionClock + delta * speed * params.autoTransitionSpeed) % 1;
        params.transitionProgress = params.developerMode ? pingPong(transitionClock) : 0.5 - 0.5 * Math.cos(transitionClock * Math.PI * 2);
        if (params.developerMode) dirty = true;
      } else if (params.autoTransitionSpeed === 0) {
        transitionClock = params.transitionProgress;
      }
      knot.visible = !params.developerMode;
      developerKnot.visible = params.developerMode;
      if (dirty) {
        if (params.developerMode) updateDeveloperGeometry();
        else updateGeometry();
      }

      const rotationSpeed = params.autoRotate ? speed : 0;
      knot.rotation.x += params.rotationX * 0.62 * delta * rotationSpeed;
      knot.rotation.y += params.rotationY * 0.62 * delta * rotationSpeed;
      knot.rotation.z += params.rotationZ * 0.62 * delta * rotationSpeed;
      developerKnot.rotation.copy(knot.rotation);
      core.rotation.y -= 0.5 * delta * speed;
      core.scale.setScalar(params.coreSize / 0.42);
      updateUniforms();
      updateDeveloperUniforms();
      bloom.strength = params.bloomStrength;
      bloom.radius = 0.34;
      bloom.threshold = 0.72;
      const light = scene.getObjectByName('diamondLight');
      if (light && 'intensity' in light) light.intensity = params.diamondLightStrength;
      for (let i = 0; i < sparkles.length; i++) {
        const a = (i / sparkles.length) * Math.PI * 2 + time * 0.2;
        sparkles[i].position.set(Math.cos(a) * 1.72, Math.sin(a) * 1.72, 0.35 * Math.sin(5 * a + time));
        sparkles[i].scale.setScalar(params.sparkleStrength * (0.55 + 0.45 * Math.sin(time * 2 + i)));
      }
      const cameraOrbitTime = params.autoRotate ? time * params.cameraOrbit : 0;
      camera.position.x = Math.sin(cameraOrbitTime) * 0.65;
      camera.position.y = Math.cos(cameraOrbitTime * 0.7) * 0.25;
      camera.position.z = 5.5 / params.cameraZoom;
      camera.lookAt(0, 0, 0);
      composer.render();
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      gui.destroy();
      renderer.dispose();
      composer.dispose();
      knot.geometry.dispose();
      material.dispose();
      clearExactGeometryCache();
      developerKnot.geometry.dispose();
      developerMaterial.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <>
      <div className="brand">
        <h1>ConsciousKnot</h1>
        <p>Projected 4D rearrangements of spherical ribbon knots, constrained to stay dense, smooth, and luminous.</p>
      </div>
      <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
    </>
  );
}

function pingPong(phase: number) {
  const t = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  return Math.max(0, Math.min(1, t));
}

function inversePingPong(progress: number) {
  return Math.max(0, Math.min(0.5, progress * 0.5));
}

function quantizeProgress(progress: number, frames: number) {
  const frameCount = Math.max(2, Math.round(frames));
  return Math.round(clamp01Number(progress) * (frameCount - 1)) / (frameCount - 1);
}

function exactGeometryCacheKey(params: Params, progress: number, quality: number) {
  return [
    'exact-live',
    params.devExactSymmetryGroup,
    params.devExactTransitionMode,
    params.devExactTrajectorySize,
    params.devExactSource,
    params.devExactTarget,
    params.devExactThird,
    params.devExactFourth,
    roundKey(progress, 5),
    roundKey(quality, 3),
    Math.round(params.devSampleCount),
    Math.round(params.devCrossSamples),
    roundKey(params.devRibbonWidth, 4),
    roundKey(params.devShellRadius, 4),
    roundKey(params.devShellThickness, 4),
    roundKey(params.devLiftAmplitude, 4),
    params.devShowWPassage ? 1 : 0,
    Math.round(params.devExactRelaxationSteps),
    roundKey(params.devExactSymmetrySettle, 4),
    params.devExactSolidSolve ? 1 : 0,
    Math.round(params.devExactSolidPasses),
    roundKey(params.devExactCreaseStrength, 4),
  ].join('|');
}

function roundKey(value: number, digits: number) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clamp01Number(value: number) {
  return Math.max(0, Math.min(1, value));
}

function alignedPhase(sourceKind: KnotKind, targetKind: KnotKind, params: Params) {
  if (params.phaseLockStrength <= 0) return 0;
  const steps = Math.max(8, Math.round(params.phaseSearchSteps));
  const probes = 56;
  const symmetry = Math.max(3, Math.round(params.symmetryOrder));
  let bestPhase = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let s = 0; s < steps; s++) {
    const phase = (s / steps) * Math.PI * 2;
    let score = 0;
    for (let i = 0; i < probes; i++) {
      const t = (i / probes) * Math.PI * 2;
      const a = spherizePoint(knotPoint(sourceKind, t, params.torusP, params.torusQ), 1, params.tipStrength, t).normalize();
      const b = spherizePoint(knotPoint(targetKind, t + phase, params.torusP, params.torusQ), 1, params.tipStrength, t + phase).normalize();
      score += 1 - a.dot(b) + 0.035 * (1 - Math.cos(symmetry * phase));
    }
    if (score < bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }

  return bestPhase * params.phaseLockStrength;
}
