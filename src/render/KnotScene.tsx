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
  Vector2,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { buildDeveloperRibbonMesh } from '../geometry/buildDeveloperRibbonMesh';
import { buildExactSymmetricWeaveMesh } from '../symmetric-weave/mesh';
import { createControlPanel } from '../controls/ControlPanel';
import { defaultParams } from '../controls/defaultParams';
import { createClassicRibbonMaterial, createCore } from './materials';
import { addLights } from './lights';
import type { Params } from '../math/types';

export function KnotScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    const params: Params = { ...defaultParams };
    let dirty = true;
    let time = 0;
    let transitionClock = params.transitionProgress;
    let dragging = false;

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
    const material = createClassicRibbonMaterial(params);
    const ribbon = new Mesh(new BufferGeometry(), material);
    interactionRig.add(ribbon);
    const exactGeometryCache = new Map<string, BufferGeometry>();
    const cachedExactGeometries = new Set<BufferGeometry>();
    const maxExactGeometryCacheEntries = 48;

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

    const disposeRibbonGeometry = (geometry: BufferGeometry) => {
      if (!cachedExactGeometries.has(geometry)) geometry.dispose();
    };

    const setRibbonGeometry = (geometry: BufferGeometry) => {
      const old = ribbon.geometry;
      ribbon.geometry = geometry;
      if (old !== geometry) disposeRibbonGeometry(old);
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
        if (ribbon.geometry !== oldestGeometry) oldestGeometry.dispose();
      }
    };

    const clearExactGeometryCache = () => {
      for (const geometry of exactGeometryCache.values()) {
        if (ribbon.geometry !== geometry) geometry.dispose();
      }
      exactGeometryCache.clear();
      cachedExactGeometries.clear();
    };

    const buildExactGeometry = () => {
      const livePlayback = params.adaptivePlayback && !params.paused && !dragging && params.autoTransitionSpeed > 0 && params.globalSpeed > 0;
      const quality = clamp01Number(params.playbackQuality);
      const sampleScale = livePlayback ? 0.65 + 0.35 * quality : 1;
      const crossScale = livePlayback ? 0.55 + 0.45 * quality : 1;
      const relaxationScale = livePlayback ? 0.45 + 0.45 * quality : 1;
      const solidScale = livePlayback ? 0.16 + 0.46 * quality : 1;
      const relaxationSteps = params.exactRelaxationSteps > 0
        ? Math.max(livePlayback ? 1 : 0, Math.round(params.exactRelaxationSteps * relaxationScale))
        : 0;
      const solidPasses = params.exactSolidSolve && params.exactSolidPasses > 0
        ? Math.max(livePlayback ? 1 : 0, Math.round(params.exactSolidPasses * solidScale))
        : 0;
      const progress = livePlayback
        ? quantizeProgress(params.transitionProgress, Math.round(params.playbackCacheFrames))
        : params.transitionProgress;
      const cacheKey = livePlayback ? exactGeometryCacheKey(params, progress, quality) : '';
      const cached = livePlayback ? exactGeometryCache.get(cacheKey) : undefined;
      if (cached) {
        exactGeometryCache.delete(cacheKey);
        exactGeometryCache.set(cacheKey, cached);
        return cached;
      }

      const geometry = buildExactSymmetricWeaveMesh({
        group: params.exactSymmetryGroup,
        sourcePattern: params.exactSource,
        targetPattern: params.exactTarget,
        trajectoryPatterns: [
          params.exactSource,
          params.exactTarget,
          params.exactThird,
          params.exactFourth,
        ].slice(0, Math.round(params.exactTrajectorySize)),
        transitionMode: params.exactTransitionMode,
        progress,
        samples: Math.max(180, Math.round(params.sampleCount * sampleScale)),
        crossSamples: Math.max(6, Math.round(params.crossSamples * crossScale)),
        width: params.ribbonWidth,
        shellRadius: params.shellRadius,
        shellThickness: params.shellThickness,
        liftAmplitude: params.liftAmplitude,
        showWPassage: params.showWPassage,
        relaxationSteps,
        symmetrySettle: params.exactSymmetrySettle,
        solidSolve: params.exactSolidSolve,
        solidPasses,
        creaseStrength: params.exactCreaseStrength,
      });
      if (livePlayback) cacheExactGeometry(cacheKey, geometry);
      return geometry;
    };

    const buildSimpleGeometry = () => buildDeveloperRibbonMesh({
      knots: [
        params.simpleSourceKnot,
        params.simpleMidKnot,
        params.simpleTargetKnot,
        params.simpleFourthKnot,
      ].slice(0, Math.round(params.simpleTrajectorySize)),
      progress: params.transitionProgress,
      samples: Math.round(params.sampleCount),
      crossSamples: Math.round(params.crossSamples),
      width: params.ribbonWidth,
      liftAmplitude: params.liftAmplitude,
      projectionDistance4D: params.simpleProjectionDistance4D,
      simultaneousUncrossings: params.simpleSimultaneousUncrossings,
      crossingMode: params.simpleCrossingMode,
      showWPassage: params.showWPassage,
      sphereMode: params.simpleSphereMode,
      sphereStrength: params.simpleSphereStrength,
      sphereRadius: params.simpleSphereRadius,
      sphereSymmetry: params.simpleSphereSymmetry,
      selfAvoidance: params.simpleSelfAvoidance,
      selfAvoidanceStrength: params.simpleSelfAvoidanceStrength,
      selfAvoidanceIterations: params.simpleSelfAvoidanceIterations,
      tubeClearance: params.simpleTubeClearance,
      hideDuringUncrossing: params.simpleHideDuringUncrossing,
      fourthDimensionDuty: params.simpleFourthDimensionDuty,
      twistTurns: params.simpleTwistEnabled ? params.simpleTwistTurns : 0,
    });

    const updateGeometry = () => {
      const geometry = params.mainMode === 'exact symmetric shell weave'
        ? buildExactGeometry()
        : buildSimpleGeometry();
      setRibbonGeometry(geometry);
    };

    const updateUniforms = () => {
      const uniforms = material.uniforms;
      uniforms.time.value = 0;
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

    let raf = 0;
    let lastNow = performance.now();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      const speed = params.paused || dragging ? 0 : params.globalSpeed;
      time += delta * speed;
      if (params.paused) {
        transitionClock = inversePingPong(params.transitionProgress);
      } else if (params.autoTransitionSpeed > 0 && speed > 0) {
        transitionClock = (transitionClock + delta * speed * params.autoTransitionSpeed) % 1;
        params.transitionProgress = pingPong(transitionClock);
        dirty = true;
      } else if (params.autoTransitionSpeed === 0) {
        transitionClock = params.transitionProgress;
      }
      if (dirty) updateGeometry();

      const rotationSpeed = params.autoRotate ? speed : 0;
      ribbon.rotation.x += params.rotationX * 0.62 * delta * rotationSpeed;
      ribbon.rotation.y += params.rotationY * 0.62 * delta * rotationSpeed;
      ribbon.rotation.z += params.rotationZ * 0.62 * delta * rotationSpeed;
      core.rotation.y -= 0.5 * delta * speed;
      core.scale.setScalar(params.coreSize / 0.42);
      updateUniforms();
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
      clearExactGeometryCache();
      ribbon.geometry.dispose();
      material.dispose();
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
    params.exactSymmetryGroup,
    params.exactTransitionMode,
    params.exactTrajectorySize,
    params.exactSource,
    params.exactTarget,
    params.exactThird,
    params.exactFourth,
    roundKey(progress, 5),
    roundKey(quality, 3),
    Math.round(params.sampleCount),
    Math.round(params.crossSamples),
    roundKey(params.ribbonWidth, 4),
    roundKey(params.shellRadius, 4),
    roundKey(params.shellThickness, 4),
    roundKey(params.liftAmplitude, 4),
    params.showWPassage ? 1 : 0,
    Math.round(params.exactRelaxationSteps),
    roundKey(params.exactSymmetrySettle, 4),
    params.exactSolidSolve ? 1 : 0,
    Math.round(params.exactSolidPasses),
    roundKey(params.exactCreaseStrength, 4),
  ].join('|');
}

function roundKey(value: number, digits: number) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clamp01Number(value: number) {
  return Math.max(0, Math.min(1, value));
}
