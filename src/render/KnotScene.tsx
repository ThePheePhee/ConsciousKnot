import { useEffect, useRef } from 'react';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
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
import { sampleCurve3D } from '../math/frames3';
import { buildRibbonMesh3D } from '../geometry/buildRibbonMesh3D';
import { buildRibbonMesh4D } from '../geometry/buildRibbonMesh4D';
import { createControlPanel } from '../controls/ControlPanel';
import { defaultParams } from '../controls/defaultParams';
import { createCore, createRibbonMaterial } from './materials';
import { addLights } from './lights';
import type { Params } from '../math/types';

export function KnotScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    const params: Params = { ...defaultParams };
    let dirty = true;
    let time = 0;

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
    const material = createRibbonMaterial(params);
    const knot = new Mesh(new BufferGeometry(), material);
    scene.add(knot);

    const core = createCore(params.coreSize);
    core.visible = false;
    scene.add(core);
    const sparkleMaterial = new MeshBasicMaterial({ color: 0xeef8ff, transparent: true, opacity: 0.48, blending: AdditiveBlending });
    const sparkles = Array.from({ length: 6 }, (_, i) => {
      const s = new Mesh(new SphereGeometry(0.012, 12, 8), sparkleMaterial);
      const a = (i / 10) * Math.PI * 2;
      s.position.set(Math.cos(a) * 1.75, Math.sin(a) * 1.75, 0.12 * Math.sin(5 * a));
      scene.add(s);
      return s;
    });

    const updateGeometry = () => {
      const old = knot.geometry;
      const samples = Math.round(params.sampleCount);
      const common = {
        knot: params.knotType,
        torusP: params.torusP,
        torusQ: params.torusQ,
        samples,
        time,
        slitherAmplitude: params.slitherAmplitude,
        slitherSpeed: params.slitherSpeed,
        slitherWaveCount: params.slitherWaveCount,
        spherizeAmount: params.spherizeAmount,
        tipStrength: params.tipStrength,
      };
      knot.geometry =
        params.mode === '4D Transition'
          ? buildRibbonMesh4D(
              {
                ...common,
                sourceKnot: params.sourceKnot,
                midKnot: params.midKnot,
                targetKnot: params.targetKnot,
                transitionPath: params.transitionPath,
                transitionProgress: params.transitionProgress,
                liftAmplitude: params.liftAmplitude,
                liftFrequency: params.liftFrequency,
                sphereEnvelopeStrength: params.sphereEnvelopeStrength,
                projectedSphereStrength: params.projectedSphereStrength,
                localCrossingCenter: params.localCrossingCenter,
                localCrossingWidth: params.localCrossingWidth,
                localCrossingStrength: params.localCrossingStrength,
                localFocusZoom: params.localFocusZoom,
                projectionDistance4D: params.projectionDistance4D,
                rotations: {
                  xy: time * params.rotateXY,
                  xz: time * params.rotateXZ,
                  xw: time * params.rotateXW,
                  yz: time * params.rotateYZ,
                  yw: time * params.rotateYW,
                  zw: time * params.rotateZW,
                },
              },
              params.ribbonWidth,
              params.edgeFlare,
              Math.round(params.crossSamples),
            )
          : buildRibbonMesh3D(sampleCurve3D(common), params.ribbonWidth, params.edgeFlare, Math.round(params.crossSamples));
      old.dispose();
      dirty = false;
    };

    const gui = createControlPanel(params, () => {
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

    let frame = 0;
    let raf = 0;
    let lastNow = performance.now();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      const speed = params.paused ? 0 : params.globalSpeed;
      time += delta * speed;
      frame++;
      if (params.mode === '4D Transition' && params.autoTransitionSpeed > 0) {
        params.transitionProgress = 0.5 + 0.5 * Math.sin(time * params.autoTransitionSpeed);
        dirty = dirty || speed > 0;
      }
      if (speed > 0 && params.slitherAmplitude > 0.001 && frame % 2 === 0) dirty = true;
      if (speed > 0 && params.mode === '4D Transition') dirty = true;
      if (dirty) updateGeometry();

      knot.rotation.x += params.rotationX * 0.62 * delta * speed;
      knot.rotation.y += params.rotationY * 0.62 * delta * speed;
      knot.rotation.z += params.rotationZ * 0.62 * delta * speed;
      core.rotation.y -= 0.5 * delta * speed;
      core.scale.setScalar(params.coreSize / 0.42);
      material.uniforms.time.value = time;
      material.uniforms.oilSlickStrength.value = params.oilSlickStrength;
      material.uniforms.fractalStrength.value = params.fractalStrength;
      material.uniforms.fibreDensity.value = params.fibreDensity;
      material.uniforms.fibreStrength.value = params.fibreStrength;
      material.uniforms.lightStrength.value = params.diamondLightStrength;
      material.uniforms.corePosition.value = core.position;
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
      camera.position.x = Math.sin(time * params.cameraOrbit) * 0.65;
      camera.position.y = Math.cos(time * params.cameraOrbit * 0.7) * 0.25;
      camera.lookAt(0, 0, 0);
      composer.render();
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      gui.destroy();
      renderer.dispose();
      composer.dispose();
      knot.geometry.dispose();
      material.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <>
      <div className="brand">
        <h1>ConsciousKnot</h1>
        <p>Procedural framed ribbon knots in 3D and projected 4D, tuned for dense luminous oil-slick geometry.</p>
      </div>
      <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
    </>
  );
}
