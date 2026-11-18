import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BLOCK_THEMES } from './cosmetics';
import { BlockArchetype, BlockModifierKind, BlockShapeKind, ThemeId } from './types';

const BASE_LABELS: Record<BlockShapeKind, string> = {
  cube: 'Cube',
  slab: 'Beam',
  pillar: 'Pillar',
  wedge: 'Wedge',
  orb: 'Sphere',
};

const BASE_MASSES: Record<BlockShapeKind, number> = {
  cube: 3.0,
  slab: 2.2,
  pillar: 2.4,
  wedge: 1.7,
  orb: 2.6,
};

export function buildBlockArchetype(
  kind: BlockShapeKind,
  modifier: BlockModifierKind,
  themeId: ThemeId,
  scaleFactor = 1.0
): BlockArchetype {
  const theme = BLOCK_THEMES[themeId];
  const pal = theme.palette[kind];

  let colorHex = pal.color;
  let emissiveHex = pal.emissive;
  let edgeHex = pal.edge;
  let accentColorCss = pal.css;
  let mass = BASE_MASSES[kind] * scaleFactor;
  let label = BASE_LABELS[kind];
  let weightLabel: 'Light' | 'Medium' | 'Heavy' =
    mass >= 2.8 ? 'Heavy' : mass >= 2.0 ? 'Medium' : 'Light';

  if (modifier === 'heavy') {
    mass *= 2.8;
    weightLabel = 'Heavy';
    label = `Heavy ${label}`;
    colorHex = 0x334155;
    emissiveHex = 0x0f172a;
    edgeHex = 0xf59e0b;
    accentColorCss = '#f59e0b';
  } else if (modifier === 'ice') {
    label = `Ice ${label}`;
    colorHex = 0x67e8f9;
    emissiveHex = 0x0891b2;
    edgeHex = 0xe0f2fe;
    accentColorCss = '#67e8f9';
  } else if (modifier === 'bouncy') {
    mass *= 0.85;
    label = `Rubber ${label}`;
    colorHex = 0xd946ef;
    emissiveHex = 0x86198f;
    edgeHex = 0xf5d0fe;
    accentColorCss = '#e879f9';
  } else if (modifier === 'fragile') {
    mass *= 0.7;
    weightLabel = 'Light';
    label = `Glass ${label}`;
    colorHex = 0xe2e8f0;
    emissiveHex = 0x38bdf8;
    edgeHex = 0xffffff;
    accentColorCss = '#e0f2fe';
  }

  return {
    kind,
    modifier,
    label,
    mass,
    weightLabel,
    colorHex,
    emissiveHex,
    edgeHex,
    accentColorCss,
    scaleFactor,
  };
}

export interface StackedBlock {
  id: number;
  archetype: BlockArchetype;
  mesh: THREE.Group;
  body: CANNON.Body;
  shapeRef: CANNON.Shape;
  primaryMat: THREE.MeshStandardMaterial;
  edgeMat: THREE.LineBasicMaterial;
  halfHeight: number;
  footprintRadius: number;
  hasCollided: boolean;
  stableTime: number;
  scored: boolean;
  frozen: boolean;
  shattered: boolean;
  dropTimestamp: number;
  squashTimer: number;
  dispose: () => void;
}

function createWedgeGeometryAndCollider(
  bottomW: number,
  topW: number,
  height: number,
  depth: number
): { geometry: THREE.BufferGeometry; shape: CANNON.ConvexPolyhedron } {
  const hb = bottomW / 2;
  const ht = topW / 2;
  const hh = height / 2;
  const hd = depth / 2;

  const shape2d = new THREE.Shape();
  shape2d.moveTo(-hb, -hh);
  shape2d.lineTo(hb, -hh);
  shape2d.lineTo(ht, hh);
  shape2d.lineTo(-ht, hh);
  shape2d.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape2d, {
    depth,
    bevelEnabled: false,
    steps: 1,
  });
  geometry.translate(0, 0, -hd);
  geometry.computeVertexNormals();

  const vertices = [
    new CANNON.Vec3(-hb, -hh, -hd),
    new CANNON.Vec3(hb, -hh, -hd),
    new CANNON.Vec3(ht, hh, -hd),
    new CANNON.Vec3(-ht, hh, -hd),
    new CANNON.Vec3(-hb, -hh, hd),
    new CANNON.Vec3(hb, -hh, hd),
    new CANNON.Vec3(ht, hh, hd),
    new CANNON.Vec3(-ht, hh, hd),
  ];

  const rawFaces = [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [3, 7, 6, 2],
    [0, 4, 7, 3],
    [1, 2, 6, 5],
  ];

  const e1 = new CANNON.Vec3();
  const e2 = new CANNON.Vec3();
  const n = new CANNON.Vec3();
  const center = new CANNON.Vec3();

  const faces = rawFaces.map((f) => {
    center.set(0, 0, 0);
    for (const idx of f) center.vadd(vertices[idx], center);
    center.scale(1 / f.length, center);

    vertices[f[1]].vsub(vertices[f[0]], e1);
    vertices[f[2]].vsub(vertices[f[0]], e2);
    e1.cross(e2, n);
    return n.dot(center) >= 0 ? f : [...f].reverse();
  });

  const shape = new CANNON.ConvexPolyhedron({ vertices, faces });
  return { geometry, shape };
}

export function createBlockVisualGroup(
  archetype: BlockArchetype,
  themeId: ThemeId,
  isPreview = false
): {
  group: THREE.Group;
  primaryMat: THREE.MeshStandardMaterial;
  edgeMat: THREE.LineBasicMaterial;
  halfHeight: number;
  footprintRadius: number;
  createCollider: () => CANNON.Shape;
  dispose: () => void;
} {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const theme = BLOCK_THEMES[themeId];
  const sc = archetype.scaleFactor;

  let roughness = theme.roughness;
  let metalness = theme.metalness;
  let opacity = isPreview ? 0.45 : 1.0;
  let transparent = isPreview;

  if (archetype.modifier === 'heavy') {
    roughness = 0.24;
    metalness = 0.9;
  } else if (archetype.modifier === 'ice') {
    roughness = 0.1;
    metalness = 0.12;
    if (!isPreview) {
      transparent = true;
      opacity = 0.86;
    }
  } else if (archetype.modifier === 'bouncy') {
    roughness = 0.44;
    metalness = 0.08;
  } else if (archetype.modifier === 'fragile') {
    roughness = 0.08;
    metalness = 0.18;
    if (!isPreview) {
      transparent = true;
      opacity = 0.68;
    }
  }

  const primaryMat = new THREE.MeshStandardMaterial({
    color: archetype.colorHex,
    emissive: archetype.emissiveHex,
    emissiveIntensity: isPreview ? 0.45 : archetype.modifier === 'bouncy' ? 0.25 : 0.14,
    roughness,
    metalness,
    transparent,
    opacity,
    depthWrite: !isPreview,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: archetype.modifier === 'heavy' ? 0xf59e0b : theme.trimColor,
    roughness: theme.trimRoughness,
    metalness: archetype.modifier === 'heavy' ? 0.9 : theme.trimMetalness,
    transparent: isPreview,
    opacity: isPreview ? 0.35 : 1.0,
    depthWrite: !isPreview,
  });

  const edgeMat = new THREE.LineBasicMaterial({
    color: archetype.edgeHex,
    transparent: true,
    opacity: isPreview ? 0.9 : archetype.modifier === 'ice' || archetype.modifier === 'fragile' ? 0.95 : 0.65,
  });

  materials.push(primaryMat, trimMat, edgeMat);

  let halfHeight = 0.5 * sc;
  let footprintRadius = 0.6 * sc;
  let createCollider: () => CANNON.Shape;

  if (archetype.kind === 'cube') {
    const s = 1.14 * sc;
    halfHeight = s / 2;
    footprintRadius = 0.64 * sc;

    const boxGeo = new THREE.BoxGeometry(s, s, s);
    const bandGeo = new THREE.BoxGeometry(s + 0.03, 0.16 * sc, s + 0.03);
    const edgesGeo = new THREE.EdgesGeometry(boxGeo, 15);
    geometries.push(boxGeo, bandGeo, edgesGeo);

    const main = new THREE.Mesh(boxGeo, primaryMat);
    main.castShadow = !isPreview;
    main.receiveShadow = !isPreview;
    group.add(main);

    const band = new THREE.Mesh(bandGeo, trimMat);
    band.castShadow = !isPreview;
    group.add(band);

    group.add(new THREE.LineSegments(edgesGeo, edgeMat));
    createCollider = () => new CANNON.Box(new CANNON.Vec3(s / 2, s / 2, s / 2));
  } else if (archetype.kind === 'slab') {
    const w = 2.16 * sc;
    const h = 0.56 * sc;
    const d = 1.02 * sc;
    halfHeight = h / 2;
    footprintRadius = 1.08 * sc;

    const slabGeo = new THREE.BoxGeometry(w, h, d);
    const clampGeo = new THREE.BoxGeometry(0.42 * sc, h + 0.03, d + 0.03);
    const edgesGeo = new THREE.EdgesGeometry(slabGeo, 15);
    geometries.push(slabGeo, clampGeo, edgesGeo);

    const main = new THREE.Mesh(slabGeo, primaryMat);
    main.castShadow = !isPreview;
    main.receiveShadow = !isPreview;
    group.add(main);

    const clamp = new THREE.Mesh(clampGeo, trimMat);
    clamp.castShadow = !isPreview;
    group.add(clamp);

    group.add(new THREE.LineSegments(edgesGeo, edgeMat));
    createCollider = () => new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
  } else if (archetype.kind === 'pillar') {
    const r = 0.56 * sc;
    const h = 1.48 * sc;
    halfHeight = h / 2;
    footprintRadius = r;

    const cylGeo = new THREE.CylinderGeometry(r, r, h, 24);
    const capGeo = new THREE.CylinderGeometry(r + 0.035, r + 0.035, 0.14 * sc, 24);
    const edgesGeo = new THREE.EdgesGeometry(cylGeo, 24);
    geometries.push(cylGeo, capGeo, edgesGeo);

    const main = new THREE.Mesh(cylGeo, primaryMat);
    main.castShadow = !isPreview;
    main.receiveShadow = !isPreview;
    group.add(main);

    const topCap = new THREE.Mesh(capGeo, trimMat);
    topCap.position.y = h / 2 - 0.08 * sc;
    topCap.castShadow = !isPreview;
    group.add(topCap);

    const botCap = new THREE.Mesh(capGeo, trimMat);
    botCap.position.y = -h / 2 + 0.08 * sc;
    botCap.castShadow = !isPreview;
    group.add(botCap);

    group.add(new THREE.LineSegments(edgesGeo, edgeMat));
    createCollider = () => new CANNON.Cylinder(r, r, h, 16);
  } else if (archetype.kind === 'wedge') {
    const bottomW = 1.38 * sc;
    const topW = 0.38 * sc;
    const h = 0.94 * sc;
    const d = 1.1 * sc;
    halfHeight = h / 2;
    footprintRadius = 0.7 * sc;

    const { geometry: wedgeGeo } = createWedgeGeometryAndCollider(bottomW, topW, h, d);
    const ridgeGeo = new THREE.BoxGeometry(topW + 0.04, 0.1 * sc, d + 0.04);
    const edgesGeo = new THREE.EdgesGeometry(wedgeGeo, 15);
    geometries.push(wedgeGeo, ridgeGeo, edgesGeo);

    const main = new THREE.Mesh(wedgeGeo, primaryMat);
    main.castShadow = !isPreview;
    main.receiveShadow = !isPreview;
    group.add(main);

    const ridge = new THREE.Mesh(ridgeGeo, trimMat);
    ridge.position.y = h / 2 - 0.04 * sc;
    group.add(ridge);

    group.add(new THREE.LineSegments(edgesGeo, edgeMat));
    createCollider = () => createWedgeGeometryAndCollider(bottomW, topW, h, d).shape;
  } else {
    const r = 0.55 * sc;
    halfHeight = r;
    footprintRadius = r;

    const sphereGeo = new THREE.SphereGeometry(r, 26, 20);
    const ringGeo = new THREE.TorusGeometry(r + 0.01, 0.045 * sc, 10, 32);
    ringGeo.rotateX(Math.PI / 2);
    geometries.push(sphereGeo, ringGeo);

    const main = new THREE.Mesh(sphereGeo, primaryMat);
    main.castShadow = !isPreview;
    main.receiveShadow = !isPreview;
    group.add(main);

    group.add(new THREE.Mesh(ringGeo, trimMat));
    createCollider = () => new CANNON.Sphere(r);
  }

  return {
    group,
    primaryMat,
    edgeMat,
    halfHeight,
    footprintRadius,
    createCollider,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

export function spawnStackedBlock(
  id: number,
  archetype: BlockArchetype,
  themeId: ThemeId,
  position: THREE.Vector3,
  yawRadians: number,
  physicsMaterial: CANNON.Material
): StackedBlock {
  const visual = createBlockVisualGroup(archetype, themeId, false);
  visual.group.position.copy(position);
  visual.group.rotation.y = yawRadians;

  const shapeRef = visual.createCollider();
  const body = new CANNON.Body({
    mass: archetype.mass,
    material: physicsMaterial,
    position: new CANNON.Vec3(position.x, position.y, position.z),
    linearDamping: archetype.modifier === 'bouncy' ? 0.08 : 0.14,
    angularDamping: archetype.modifier === 'ice' ? 0.12 : 0.28,
    sleepSpeedLimit: 0.18,
    sleepTimeLimit: 1.0,
  });
  body.quaternion.setFromEuler(0, yawRadians, 0);
  body.addShape(shapeRef);

  return {
    id,
    archetype,
    mesh: visual.group,
    body,
    shapeRef,
    primaryMat: visual.primaryMat,
    edgeMat: visual.edgeMat,
    halfHeight: visual.halfHeight,
    footprintRadius: visual.footprintRadius,
    hasCollided: false,
    stableTime: 0,
    scored: false,
    frozen: false,
    shattered: false,
    dropTimestamp: performance.now(),
    squashTimer: 0,
    dispose: visual.dispose,
  };
}
