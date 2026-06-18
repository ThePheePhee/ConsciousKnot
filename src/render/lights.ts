import { AmbientLight, PointLight, Scene } from 'three';

export function addLights(scene: Scene) {
  scene.add(new AmbientLight(0x5f7cff, 0.2));
  const core = new PointLight(0xffffff, 7, 9, 1.4);
  core.name = 'diamondLight';
  scene.add(core);
  const cool = new PointLight(0x52e9ff, 3, 7, 1.5);
  cool.position.set(-2.3, 1.4, 2.2);
  scene.add(cool);
  const rose = new PointLight(0xff4fb8, 2.5, 7, 1.5);
  rose.position.set(2.1, -1.8, 1.4);
  scene.add(rose);
}
