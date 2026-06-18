import { AmbientLight, PointLight, Scene } from 'three';

export function addLights(scene: Scene) {
  scene.add(new AmbientLight(0x4760b8, 0.1));
  const core = new PointLight(0xf4fbff, 3.2, 8, 1.7);
  core.name = 'diamondLight';
  scene.add(core);
  const cool = new PointLight(0x52e9ff, 1.4, 7, 1.5);
  cool.position.set(-2.3, 1.4, 2.2);
  scene.add(cool);
  const rose = new PointLight(0xff4fb8, 1.1, 7, 1.5);
  rose.position.set(2.1, -1.8, 1.4);
  scene.add(rose);
}
