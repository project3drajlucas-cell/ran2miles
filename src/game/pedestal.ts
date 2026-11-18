import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ProceduralTexturePack } from './materials';
import { PedestalSkinDef } from './cosmetics';

export interface OrbitalPedestal {
  group: THREE.Group;
  body: CANNON.Body;
  rimMaterial: THREE.MeshStandardMaterial;
  coreLightMaterial: THREE.MeshStandardMaterial;
  raycastTarget: THREE.Mesh;
  setSkin: (skin: PedestalSkinDef) => void;
  applyGimbalPhysics: (stiffnessBoost: number, targetPitch?: number, targetRoll?: number) => void;
  resetTilt: () => void;
  getTiltDegrees: () => number;
  pulseRim: (colorHex: number, intensity: number) => void;
  updateVisuals: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

const _upWorld = new CANNON.Vec3(0, 1, 0);
const _targetUp = new CANNON.Vec3(0, 1, 0);
const _upLocal = new CANNON.Vec3();
const _axis = new CANNON.Vec3();
const _torque = new CANNON.Vec3();

export function createOrbitalPedestal(
  textures: ProceduralTexturePack,
  physicsMaterial: CANNON.Material,
  initialSkin: PedestalSkinDef
): OrbitalPedestal {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // 1. Primary Landing Deck
  const deckGeo = new THREE.CylinderGeometry(3.2, 3.28, 0.36, 40);
  geometries.push(deckGeo);

  const deckSideMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.65,
  });
  const deckTopMat = new THREE.MeshStandardMaterial({
    color: initialSkin.deckTint,
    map: textures.deckMap,
    roughnessMap: textures.deckRoughnessMap,
    roughness: 0.62,
    metalness: 0.24,
  });
  const deckBottomMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.6,
    metalness: 0.5,
  });
  materials.push(deckSideMat, deckTopMat, deckBottomMat);

  const deckMesh = new THREE.Mesh(deckGeo, [deckSideMat, deckTopMat, deckBottomMat]);
  deckMesh.position.y = 0;
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  group.add(deckMesh);

  // 2. Secondary Brushed Metal Rim Collar
  const collarGeo = new THREE.TorusGeometry(3.26, 0.11, 14, 48);
  collarGeo.rotateX(Math.PI / 2);
  geometries.push(collarGeo);

  const collarMat = new THREE.MeshStandardMaterial({
    color: initialSkin.collarColor,
    roughness: initialSkin.collarRoughness,
    metalness: initialSkin.collarMetalness,
  });
  materials.push(collarMat);

  const collarMesh = new THREE.Mesh(collarGeo, collarMat);
  collarMesh.position.y = 0.08;
  collarMesh.castShadow = true;
  collarMesh.receiveShadow = true;
  group.add(collarMesh);

  // 3. Under-Chassis Tapered Hull (LatheGeometry)
  const lathePoints = [
    new THREE.Vector2(0.0, -1.32),
    new THREE.Vector2(0.85, -1.25),
    new THREE.Vector2(1.45, -0.95),
    new THREE.Vector2(2.4, -0.45),
    new THREE.Vector2(3.05, -0.18),
    new THREE.Vector2(0.0, -0.18),
  ];
  const hullGeo = new THREE.LatheGeometry(lathePoints, 32);
  geometries.push(hullGeo);

  const hullMat = new THREE.MeshStandardMaterial({
    color: initialSkin.hullColor,
    roughness: 0.54,
    metalness: 0.52,
  });
  materials.push(hullMat);

  const hullMesh = new THREE.Mesh(hullGeo, hullMat);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  group.add(hullMesh);

  // 4. Glowing Gyro-Stabilizer Ring
  const rimGeo = new THREE.TorusGeometry(2.68, 0.06, 12, 48);
  rimGeo.rotateX(Math.PI / 2);
  geometries.push(rimGeo);

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: initialSkin.coreColor,
    emissive: initialSkin.rimColor,
    emissiveIntensity: 1.35,
    roughness: 0.25,
    metalness: 0.2,
  });
  materials.push(rimMaterial);

  const rimMesh = new THREE.Mesh(rimGeo, rimMaterial);
  rimMesh.position.y = -0.34;
  group.add(rimMesh);

  // 5. Four Radial Stabilizer Fins & Thruster Pods
  const finGeo = new THREE.BoxGeometry(0.32, 0.52, 1.05);
  const nozzleGeo = new THREE.CylinderGeometry(0.14, 0.2, 0.22, 12);
  geometries.push(finGeo, nozzleGeo);

  const finMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.28,
    metalness: 0.82,
  });
  const coreLightMaterial = new THREE.MeshStandardMaterial({
    color: initialSkin.coreColor,
    emissive: initialSkin.rimColor,
    emissiveIntensity: 1.6,
    roughness: 0.2,
    metalness: 0.1,
  });
  materials.push(finMat, coreLightMaterial);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const finHolder = new THREE.Group();
    finHolder.rotation.y = angle;

    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.set(0, -0.58, 2.35);
    fin.rotation.x = 0.24;
    fin.castShadow = true;
    finHolder.add(fin);

    const nozzle = new THREE.Mesh(nozzleGeo, coreLightMaterial);
    nozzle.position.set(0, -0.84, 2.25);
    finHolder.add(nozzle);

    group.add(finHolder);
  }

  // 6. Central Gravity Core Emitter
  const coreGeo = new THREE.SphereGeometry(0.55, 20, 14);
  geometries.push(coreGeo);
  const coreMesh = new THREE.Mesh(coreGeo, coreLightMaterial);
  coreMesh.position.y = -1.25;
  coreMesh.scale.set(1, 0.6, 1);
  group.add(coreMesh);

  // Physics RigidBody
  const body = new CANNON.Body({
    mass: 85,
    material: physicsMaterial,
    position: new CANNON.Vec3(0, 0, 0),
    linearFactor: new CANNON.Vec3(0, 0, 0),
    angularFactor: new CANNON.Vec3(1, 0, 1),
    angularDamping: 0.68,
    allowSleep: false,
  });
  body.addShape(new CANNON.Cylinder(3.24, 3.24, 0.36, 24), new CANNON.Vec3(0, 0, 0));

  let rimFlashTimer = 0;
  const rimFlashTargetColor = new THREE.Color(initialSkin.rimColor);
  const baseRimColor = new THREE.Color(initialSkin.rimColor);

  const setSkin = (skin: PedestalSkinDef) => {
    deckTopMat.color.setHex(skin.deckTint);
    collarMat.color.setHex(skin.collarColor);
    collarMat.metalness = skin.collarMetalness;
    collarMat.roughness = skin.collarRoughness;
    hullMat.color.setHex(skin.hullColor);
    baseRimColor.setHex(skin.rimColor);
    rimMaterial.color.setHex(skin.coreColor);
    rimMaterial.emissive.setHex(skin.rimColor);
    coreLightMaterial.color.setHex(skin.coreColor);
    coreLightMaterial.emissive.setHex(skin.rimColor);
  };

  const applyGimbalPhysics = (stiffnessBoost: number, targetPitch = 0, targetRoll = 0) => {
    body.quaternion.vmult(_upWorld, _upLocal);

    // Desired up vector based on optional moving-pedestal pitch/roll oscillation
    _targetUp.set(Math.sin(targetRoll), Math.cos(targetPitch) * Math.cos(targetRoll), Math.sin(targetPitch));
    _targetUp.normalize();

    _upLocal.cross(_targetUp, _axis);
    const sinAngle = _axis.length();
    if (sinAngle > 1e-5) {
      _axis.scale(1 / sinAngle, _axis);
    }
    const angle = Math.asin(Math.min(1, sinAngle));
    const stiffness = 680 * (1 + stiffnessBoost);
    const damping = 95 * (1 + stiffnessBoost * 0.5);

    _torque.set(
      _axis.x * angle * stiffness - body.angularVelocity.x * damping,
      0,
      _axis.z * angle * stiffness - body.angularVelocity.z * damping
    );
    body.torque.vadd(_torque, body.torque);
  };

  const resetTilt = () => {
    body.position.set(0, 0, 0);
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.quaternion.set(0, 0, 0, 1);
    group.position.set(0, 0, 0);
    group.quaternion.set(0, 0, 0, 1);
  };

  const getTiltDegrees = (): number => {
    body.quaternion.vmult(_upWorld, _upLocal);
    const dot = Math.max(-1, Math.min(1, _upLocal.dot(_upWorld)));
    return THREE.MathUtils.radToDeg(Math.acos(dot));
  };

  const pulseRim = (colorHex: number, intensity: number) => {
    rimFlashTargetColor.setHex(colorHex);
    rimFlashTimer = 0.65;
    rimMaterial.emissiveIntensity = intensity;
  };

  const updateVisuals = (dt: number, elapsed: number) => {
    group.position.set(body.position.x, body.position.y, body.position.z);
    group.quaternion.set(
      body.quaternion.x,
      body.quaternion.y,
      body.quaternion.z,
      body.quaternion.w
    );

    if (rimFlashTimer > 0) {
      rimFlashTimer = Math.max(0, rimFlashTimer - dt);
      const t = rimFlashTimer / 0.65;
      rimMaterial.emissive.copy(baseRimColor).lerp(rimFlashTargetColor, t);
      rimMaterial.emissiveIntensity = THREE.MathUtils.lerp(1.35, 2.8, t);
    } else {
      rimMaterial.emissive.copy(baseRimColor);
      rimMaterial.emissiveIntensity = 1.25 + Math.sin(elapsed * 2.2) * 0.18;
    }

    coreLightMaterial.emissiveIntensity = 1.45 + Math.sin(elapsed * 3.1) * 0.22;
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  };

  return {
    group,
    body,
    rimMaterial,
    coreLightMaterial,
    raycastTarget: deckMesh,
    setSkin,
    applyGimbalPhysics,
    resetTilt,
    getTiltDegrees,
    pulseRim,
    updateVisuals,
    dispose,
  };
}
