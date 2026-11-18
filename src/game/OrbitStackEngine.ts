import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildBlockArchetype, createBlockVisualGroup, spawnStackedBlock, StackedBlock } from './blocks';
import { createOrbitalPedestal, OrbitalPedestal } from './pedestal';
import { createProceduralTextures, ProceduralTexturePack } from './materials';
import { BLOCK_THEMES, loadCosmeticSave, PEDESTAL_SKINS, saveCosmeticData } from './cosmetics';
import { getLevelConfig } from './levels';
import { orbitAudio } from './audio';
import {
  BlockArchetype,
  BlockModifierKind,
  BlockShapeKind,
  CosmeticSaveData,
  GameMode,
  GamePhase,
  HudSnapshot,
  LevelConfig,
  PedestalSkinId,
  ThemeId,
} from './types';

// Pre-allocated math helpers — zero GC inside the per-frame loop
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _eulerA = new THREE.Euler();
const _mat4A = new THREE.Matrix4();
const _colorA = new THREE.Color();
const _rayOrigin = new THREE.Vector3();
const _rayDirDown = new THREE.Vector3(0, -1, 0);
const _upVec = new THREE.Vector3(0, 1, 0);
const _aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _pointerNdc = new THREE.Vector2();

const _cannonPos = new CANNON.Vec3();
const _cannonQuat = new CANNON.Quaternion();
const _cannonInvQuat = new CANNON.Quaternion();
const _windForce = new CANNON.Vec3();

const STORAGE_BEST_SCORE = 'orbit_stack_best_score_v1';
const STORAGE_BEST_HEIGHT = 'orbit_stack_best_height_v1';

const STABILITY_REQUIRED_SEC = 3.0;
const FREEZE_INTERVAL = 10;
const MAX_INTEGRITY = 3;
const VOID_Y_THRESHOLD = -6.8;
const MAX_AIM_RADIUS = 3.1;
const PERFECT_OFFSET_THRESHOLD = 0.36;

interface Particle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  gravityScale: number;
}

interface ShockwaveRing {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  age: number;
  duration: number;
  startY: number;
  endY: number;
}

export class OrbitStackEngine {
  private container: HTMLElement;
  private onHudChange: (snapshot: HudSnapshot) => void;
  private onCosmeticsChange?: (save: CosmeticSaveData) => void;

  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private envTexture: THREE.Texture;
  private textures: ProceduralTexturePack;

  // Lights
  private keyLight: THREE.DirectionalLight;
  private keyLightTarget: THREE.Object3D;

  // Physics
  private world: CANNON.World;
  private pedestalPhysMat: CANNON.Material;
  private blockPhysMats: Record<BlockModifierKind, CANNON.Material>;
  private pedestal: OrbitalPedestal;

  // Background atmosphere & hazards
  private starMesh: THREE.InstancedMesh;
  private orbitalRingA: THREE.Mesh;
  private orbitalRingB: THREE.Mesh;
  private finishGateGroup: THREE.Group;
  private finishGateMat: THREE.MeshBasicMaterial;
  private laserGroup: THREE.Group;
  private laserBeamMesh: THREE.Mesh;
  private laserSweepX = 0;

  // Cosmetics & Persistent Save
  private saveData: CosmeticSaveData;

  // Gameplay & Progression State
  private phase: GamePhase = 'title';
  private mode: GameMode = 'campaign';
  private currentLevelConfig: LevelConfig = getLevelConfig(1);
  private blocks: StackedBlock[] = [];
  private nextBlockId = 1;
  private score = 0;
  private bestScore = 0;
  private heightMeters = 0;
  private bestHeightMeters = 0;
  private blocksStacked = 0;
  private blocksDropped = 0;
  private integrity = MAX_INTEGRITY;
  private freezePulsesTriggered = 0;
  private comboCount = 0;
  private perfectStreak = 0;
  private precisionSurgeLeft = 0;
  private lastGemsEarned = 0;
  private nextGemHeightMilestone = 5;
  private bannerText: string | null = null;
  private bannerTimer = 0;

  // Environmental Modifier State
  private windX = 0;
  private windZ = 0;
  private windParticleTimer = 0;
  private autoDropTimer: number | null = null;

  // Aim & Preview
  private currentArchetype: BlockArchetype;
  private upcomingArchetype: BlockArchetype;
  private previewVisual: ReturnType<typeof createBlockVisualGroup> | null = null;
  private previewYaw = 0;
  private previewTargetYaw = 0;
  private aimX = 0;
  private aimZ = 0;
  private targetAimX = 0;
  private targetAimZ = 0;
  private dropCooldown = 0;
  private supportCenterMap = new Map<number, { x: number; z: number }>();

  // Projected preview shadow & drop beam
  private shadowReticleGroup: THREE.Group;
  private shadowDiscMesh: THREE.Mesh;
  private reticleRingMesh: THREE.Mesh;
  private reticleMat: THREE.MeshBasicMaterial;
  private dropBeamLine: THREE.Line;
  private dropBeamMat: THREE.LineBasicMaterial;

  // Camera rig
  private orbitYaw = 0.65;
  private targetOrbitYaw = 0.65;
  private orbitPitch = 0.54;
  private targetOrbitPitch = 0.54;
  private cameraDistance = 13.5;
  private targetCameraDistance = 13.5;
  private cameraLookY = 1.4;
  private targetCameraLookY = 1.4;
  private shakeIntensity = 0;
  private hitstopTimer = 0;

  // Input tracking
  private heldKeys = new Set<string>();
  private isDraggingOrbit = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private pointerDownPos = { x: 0, y: 0 };
  private raycaster = new THREE.Raycaster();
  private aimRaycaster = new THREE.Raycaster();

  // Effects pools
  private particles: Particle[] = [];
  private particleMesh: THREE.InstancedMesh;
  private shockwave: ShockwaveRing;

  // Loop & timing
  private frameId = 0;
  private lastTime = performance.now();
  private elapsed = 0;
  private hudSyncTimer = 0;
  private disposed = false;
  private titleShowcaseMeshes: THREE.Group[] = [];

  constructor(
    container: HTMLElement,
    onHudChange: (snapshot: HudSnapshot) => void,
    onCosmeticsChange?: (save: CosmeticSaveData) => void
  ) {
    this.container = container;
    this.onHudChange = onHudChange;
    this.onCosmeticsChange = onCosmeticsChange;

    this.saveData = loadCosmeticSave();
    this.bestScore = Number(localStorage.getItem(STORAGE_BEST_SCORE) || '0') || 0;
    this.bestHeightMeters = Number(localStorage.getItem(STORAGE_BEST_HEIGHT) || '0') || 0;

    this.currentArchetype = buildBlockArchetype('cube', 'standard', this.saveData.selectedTheme);
    this.upcomingArchetype = buildBlockArchetype('pillar', 'standard', this.saveData.selectedTheme);

    // 1. Software WebGL probe
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060a14);
    this.scene.fog = new THREE.FogExp2(0x060a14, 0.0135);

    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(44, aspect, 0.2, 240);

    // 4. Studio RoomEnvironment IBL
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmrem.dispose();

    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());

    // 5. Three-Point Warm/Cool Studio Lighting
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x0b1120, 0.8);
    this.scene.add(hemi);

    this.keyLightTarget = new THREE.Object3D();
    this.scene.add(this.keyLightTarget);

    this.keyLight = new THREE.DirectionalLight(0xfff1dc, 2.1);
    this.keyLight.position.set(10, 18, 11);
    this.keyLight.target = this.keyLightTarget;
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 56;
    const d = 10.5;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.025;
    this.scene.add(this.keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.95);
    rimLight.position.set(-11, 7, -10);
    this.scene.add(rimLight);

    // 6. Cosmic Background
    this.starMesh = this.buildStarfield();
    this.scene.add(this.starMesh);

    const ringGeoA = new THREE.TorusGeometry(28, 0.045, 8, 120);
    const ringMatA = new THREE.MeshBasicMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.45 });
    this.orbitalRingA = new THREE.Mesh(ringGeoA, ringMatA);
    this.orbitalRingA.rotation.set(Math.PI * 0.42, 0.25, 0);
    this.scene.add(this.orbitalRingA);

    const ringGeoB = new THREE.TorusGeometry(38, 0.06, 8, 120);
    const ringMatB = new THREE.MeshBasicMaterial({ color: 0x0f2744, transparent: true, opacity: 0.38 });
    this.orbitalRingB = new THREE.Mesh(ringGeoB, ringMatB);
    this.orbitalRingB.rotation.set(-Math.PI * 0.35, -0.4, 0.2);
    this.scene.add(this.orbitalRingB);

    // 7. Glowing Sky Finish Line Gate (for Campaign levels)
    this.finishGateGroup = new THREE.Group();
    const gateRingGeo = new THREE.TorusGeometry(3.85, 0.075, 12, 64);
    gateRingGeo.rotateX(Math.PI / 2);
    this.finishGateMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.85,
    });
    const gateRing = new THREE.Mesh(gateRingGeo, this.finishGateMat);
    this.finishGateGroup.add(gateRing);

    const beaconGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 10);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const post = new THREE.Mesh(beaconGeo, this.finishGateMat);
      post.position.set(Math.cos(a) * 3.85, 0, Math.sin(a) * 3.85);
      this.finishGateGroup.add(post);
    }
    this.finishGateGroup.visible = false;
    this.scene.add(this.finishGateGroup);

    // 8. Laser Hazard Sweeper (for Boss / Challenge levels)
    this.laserGroup = new THREE.Group();
    const beamMeshGeo = new THREE.CylinderGeometry(0.07, 0.07, 8.6, 12);
    beamMeshGeo.rotateX(Math.PI / 2);
    const beamMeshMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    this.laserBeamMesh = new THREE.Mesh(beamMeshGeo, beamMeshMat);
    this.laserGroup.add(this.laserBeamMesh);

    const emitterGeo = new THREE.SphereGeometry(0.22, 12, 10);
    const emitterMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0xf43f5e, emissiveIntensity: 1.5 });
    const emA = new THREE.Mesh(emitterGeo, emitterMat);
    emA.position.z = 4.3;
    const emB = new THREE.Mesh(emitterGeo, emitterMat);
    emB.position.z = -4.3;
    this.laserGroup.add(emA, emB);
    this.laserGroup.visible = false;
    this.scene.add(this.laserGroup);

    // 9. Physics World & Modular Material Matrix
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -14.5, 0),
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    (this.world.solver as CANNON.GSSolver).iterations = 14;

    this.pedestalPhysMat = new CANNON.Material('pedestal');
    this.blockPhysMats = {
      standard: new CANNON.Material('standard'),
      heavy: new CANNON.Material('heavy'),
      bouncy: new CANNON.Material('bouncy'),
      ice: new CANNON.Material('ice'),
      fragile: new CANNON.Material('fragile'),
    };
    this.setupContactMaterials();

    const activeSkin = PEDESTAL_SKINS[this.saveData.selectedSkin];
    this.pedestal = createOrbitalPedestal(this.textures, this.pedestalPhysMat, activeSkin);
    this.scene.add(this.pedestal.group);
    this.world.addBody(this.pedestal.body);

    // 10. Projected Drop Shadow & Aim Laser Guide
    this.shadowReticleGroup = new THREE.Group();
    const discGeo = new THREE.PlaneGeometry(1.75, 1.75);
    discGeo.rotateX(-Math.PI / 2);
    const discMat = new THREE.MeshBasicMaterial({
      map: this.textures.shadowMap,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    this.shadowDiscMesh = new THREE.Mesh(discGeo, discMat);
    this.shadowReticleGroup.add(this.shadowDiscMesh);

    const reticleGeo = new THREE.RingGeometry(0.54, 0.64, 36);
    reticleGeo.rotateX(-Math.PI / 2);
    this.reticleMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.reticleRingMesh = new THREE.Mesh(reticleGeo, this.reticleMat);
    this.reticleRingMesh.position.y = 0.008;
    this.shadowReticleGroup.add(this.reticleRingMesh);
    this.shadowReticleGroup.visible = false;
    this.scene.add(this.shadowReticleGroup);

    const beamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
    ]);
    this.dropBeamMat = new THREE.LineBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.45,
    });
    this.dropBeamLine = new THREE.Line(beamGeo, this.dropBeamMat);
    this.dropBeamLine.visible = false;
    this.scene.add(this.dropBeamLine);

    // 11. Pooled Particle System (impacts, perfect streaks, shards, wind streaks)
    const pCount = 180;
    for (let i = 0; i < pCount; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.6,
        size: 0.08,
        color: new THREE.Color(0x38bdf8),
        gravityScale: 1,
      });
    }
    const pGeo = new THREE.BoxGeometry(1, 1, 1);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, pCount);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);
    this.syncParticlesToInstancedMesh();

    // 12. Freeze Pulse Shockwave Ring
    const swGeo = new THREE.TorusGeometry(3.7, 0.11, 12, 64);
    swGeo.rotateX(Math.PI / 2);
    const swMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0,
    });
    const swMesh = new THREE.Mesh(swGeo, swMat);
    swMesh.visible = false;
    this.scene.add(swMesh);
    this.shockwave = {
      mesh: swMesh,
      mat: swMat,
      active: false,
      age: 0,
      duration: 0.95,
      startY: -0.2,
      endY: 5,
    };

    // 13. Build Title Showcase
    this.buildTitleShowcase();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.emitHud();
    this.onCosmeticsChange?.({ ...this.saveData });
    this.scheduleNextFrame();
  }

  private setupContactMaterials(): void {
    const props: Record<BlockModifierKind, { friction: number; restitution: number }> = {
      standard: { friction: 0.74, restitution: 0.07 },
      heavy: { friction: 0.82, restitution: 0.04 },
      bouncy: { friction: 0.65, restitution: 0.62 },
      ice: { friction: 0.055, restitution: 0.05 },
      fragile: { friction: 0.48, restitution: 0.1 },
    };

    const kinds = Object.keys(this.blockPhysMats) as BlockModifierKind[];
    for (const k of kinds) {
      const m = this.blockPhysMats[k];
      this.world.addContactMaterial(
        new CANNON.ContactMaterial(m, this.pedestalPhysMat, {
          friction: k === 'ice' ? 0.07 : Math.min(0.9, props[k].friction + 0.1),
          restitution: props[k].restitution,
          contactEquationStiffness: 1e7,
          contactEquationRelaxation: 3,
        })
      );
      for (const k2 of kinds) {
        if (k > k2) continue;
        this.world.addContactMaterial(
          new CANNON.ContactMaterial(m, this.blockPhysMats[k2], {
            friction: Math.min(props[k].friction, props[k2].friction),
            restitution: Math.max(props[k].restitution, props[k2].restitution),
            contactEquationStiffness: 1e7,
            contactEquationRelaxation: 3,
          })
        );
      }
    }
  }

  private buildStarfield(): THREE.InstancedMesh {
    const count = 260;
    const geo = new THREE.OctahedronGeometry(0.11, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geo, mat, count);

    const dummy = new THREE.Object3D();
    const palette = [0xe0f2fe, 0xbae6fd, 0xfef3c7, 0xc7d2fe];

    for (let i = 0; i < count; i++) {
      const radius = 34 + Math.random() * 52;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      dummy.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi) * 0.72 + 4,
        radius * Math.sin(phi) * Math.sin(theta)
      );
      dummy.scale.setScalar(0.45 + Math.random() * 1.4);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      _colorA.setHex(palette[i % palette.length]);
      mesh.setColorAt(i, _colorA);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    return mesh;
  }

  private buildTitleShowcase(): void {
    this.clearTitleShowcase();
    const theme = this.saveData.selectedTheme;
    const layout: Array<{ kind: BlockShapeKind; pos: [number, number, number]; yaw: number }> = [
      { kind: 'slab', pos: [0, 0.46, 0], yaw: 0.15 },
      { kind: 'cube', pos: [-0.55, 1.31, 0.08], yaw: 0.4 },
      { kind: 'pillar', pos: [0.58, 1.48, -0.05], yaw: 0 },
      { kind: 'wedge', pos: [-0.48, 2.35, 0.05], yaw: -0.2 },
      { kind: 'orb', pos: [0.58, 2.77, -0.05], yaw: 0.6 },
    ];
    for (const item of layout) {
      const arch = buildBlockArchetype(item.kind, 'standard', theme, 1.0);
      const vis = createBlockVisualGroup(arch, theme, false);
      vis.group.position.set(item.pos[0], item.pos[1], item.pos[2]);
      vis.group.rotation.y = item.yaw;
      vis.group.userData.dispose = vis.dispose;
      this.scene.add(vis.group);
      this.titleShowcaseMeshes.push(vis.group);
    }
  }

  private clearTitleShowcase(): void {
    for (const g of this.titleShowcaseMeshes) {
      this.scene.remove(g);
      if (typeof g.userData.dispose === 'function') {
        g.userData.dispose();
      }
    }
    this.titleShowcaseMeshes = [];
  }

  public getCosmeticSave(): CosmeticSaveData {
    return { ...this.saveData };
  }

  public selectOrPurchaseTheme(themeId: ThemeId): boolean {
    const def = BLOCK_THEMES[themeId];
    if (!this.saveData.unlockedThemes.includes(themeId)) {
      if (this.saveData.gems < def.costGems) return false;
      this.saveData.gems -= def.costGems;
      this.saveData.unlockedThemes = [...this.saveData.unlockedThemes, themeId];
      orbitAudio.playPurchase();
    } else {
      orbitAudio.playRotate();
    }
    this.saveData.selectedTheme = themeId;
    saveCosmeticData(this.saveData);
    if (this.phase === 'title') {
      this.buildTitleShowcase();
    }
    this.onCosmeticsChange?.({ ...this.saveData });
    this.emitHud();
    return true;
  }

  public selectOrPurchaseSkin(skinId: PedestalSkinId): boolean {
    const def = PEDESTAL_SKINS[skinId];
    if (!this.saveData.unlockedSkins.includes(skinId)) {
      if (this.saveData.gems < def.costGems) return false;
      this.saveData.gems -= def.costGems;
      this.saveData.unlockedSkins = [...this.saveData.unlockedSkins, skinId];
      orbitAudio.playPurchase();
    } else {
      orbitAudio.playRotate();
    }
    this.saveData.selectedSkin = skinId;
    saveCosmeticData(this.saveData);
    this.pedestal.setSkin(def);
    this.onCosmeticsChange?.({ ...this.saveData });
    this.emitHud();
    return true;
  }

  private pickNextArchetype(dropIndex: number): BlockArchetype {
    const theme = this.saveData.selectedTheme;

    if (this.mode === 'endless') {
      const pool: BlockShapeKind[] =
        dropIndex < 2
          ? ['cube', 'slab', 'pillar']
          : dropIndex < 5
          ? ['cube', 'slab', 'pillar', 'wedge']
          : ['cube', 'slab', 'pillar', 'wedge', 'orb'];
      const kind = pool[Math.floor(Math.random() * pool.length)];
      const modPool: BlockModifierKind[] =
        dropIndex < 6
          ? ['standard']
          : dropIndex < 14
          ? ['standard', 'standard', 'heavy']
          : ['standard', 'standard', 'heavy', 'ice', 'bouncy'];
      const mod = modPool[Math.floor(Math.random() * modPool.length)];
      const surgeScale = this.precisionSurgeLeft > 0 ? 1.24 : 1.0;
      return buildBlockArchetype(kind, mod, theme, surgeScale);
    }

    // Campaign mode uses LevelConfig pools & modifiers
    const cfg = this.currentLevelConfig;
    const kind = cfg.shapePool[Math.floor(Math.random() * cfg.shapePool.length)];
    const mod = cfg.blockModifiers[Math.floor(Math.random() * cfg.blockModifiers.length)];

    let scale = cfg.blockScaleMultiplier;
    if (cfg.envModifiers.includes('shrinkingDrop')) {
      const shrinkSteps = Math.floor(dropIndex / 5);
      scale *= Math.max(0.72, 1 - shrinkSteps * 0.045);
    }
    if (this.precisionSurgeLeft > 0) {
      scale *= 1.24;
    }

    return buildBlockArchetype(kind, mod, theme, scale);
  }

  private rebuildPreviewVisual(): void {
    if (this.previewVisual) {
      this.scene.remove(this.previewVisual.group);
      this.previewVisual.dispose();
      this.previewVisual = null;
    }
    if (this.phase !== 'playing' && this.phase !== 'paused') return;

    this.previewVisual = createBlockVisualGroup(this.currentArchetype, this.saveData.selectedTheme, true);
    this.previewVisual.group.position.set(this.aimX, this.getDropSpawnY(), this.aimZ);
    this.previewVisual.group.rotation.y = this.previewYaw;
    this.scene.add(this.previewVisual.group);
  }

  private clearActiveBlocks(): void {
    for (const b of this.blocks) {
      if (!b.frozen) {
        this.world.removeBody(b.body);
        this.scene.remove(b.mesh);
      } else {
        this.pedestal.group.remove(b.mesh);
      }
      b.dispose();
    }
    this.blocks = [];
    this.supportCenterMap.clear();

    this.world.removeBody(this.pedestal.body);
    this.scene.remove(this.pedestal.group);
    this.pedestal.dispose();
    this.pedestal = createOrbitalPedestal(
      this.textures,
      this.pedestalPhysMat,
      PEDESTAL_SKINS[this.saveData.selectedSkin]
    );
    this.scene.add(this.pedestal.group);
    this.world.addBody(this.pedestal.body);
  }

  public startCampaignLevel(levelNum: number): void {
    this.mode = 'campaign';
    this.currentLevelConfig = getLevelConfig(levelNum);
    this.beginRun();
  }

  public startEndlessMode(): void {
    this.mode = 'endless';
    this.currentLevelConfig = {
      level: 0,
      name: 'Endless Orbit',
      subtitle: 'Stack as high as possible into the cosmos.',
      targetHeight: 999,
      maxBlocks: null,
      shapePool: ['cube', 'slab', 'pillar', 'wedge', 'orb'],
      blockModifiers: ['standard', 'heavy', 'ice', 'bouncy'],
      envModifiers: [],
      isChallenge: false,
      blockScaleMultiplier: 1.0,
      windStrength: 0,
      laserAltitude: null,
      rewardGems: 0,
    };
    this.beginRun();
  }

  public restartCurrentRun(): void {
    if (this.mode === 'campaign') {
      this.startCampaignLevel(this.currentLevelConfig.level);
    } else {
      this.startEndlessMode();
    }
  }

  private beginRun(): void {
    orbitAudio.unlock();
    this.clearTitleShowcase();
    this.clearActiveBlocks();

    const cfg = this.currentLevelConfig;
    const isLowGrav = this.mode === 'campaign' && cfg.envModifiers.includes('lowGravity');
    this.world.gravity.set(0, isLowGrav ? -8.4 : -14.5, 0);

    this.phase = 'playing';
    this.score = 0;
    this.heightMeters = 0;
    this.blocksStacked = 0;
    this.blocksDropped = 0;
    this.integrity = MAX_INTEGRITY;
    this.freezePulsesTriggered = 0;
    this.comboCount = 0;
    this.perfectStreak = 0;
    this.precisionSurgeLeft = 0;
    this.lastGemsEarned = 0;
    this.nextGemHeightMilestone = 5;
    this.windX = 0;
    this.windZ = 0;
    this.autoDropTimer =
      this.mode === 'campaign' && cfg.envModifiers.includes('timerPressure') ? 4.0 : null;

    this.bannerText =
      this.mode === 'campaign'
        ? `LEVEL ${cfg.level} · ${cfg.name.toUpperCase()}`
        : 'ENDLESS ORBIT';
    this.bannerTimer = 2.4;

    this.aimX = 0;
    this.aimZ = 0;
    this.targetAimX = 0;
    this.targetAimZ = 0;
    this.previewYaw = 0;
    this.previewTargetYaw = 0;
    this.dropCooldown = 0.2;

    this.targetOrbitYaw = 0.65;
    this.targetOrbitPitch = 0.54;
    this.targetCameraDistance = 13.5;
    this.targetCameraLookY = 1.4;

    // Position Finish Gate & Laser Hazard
    if (this.mode === 'campaign') {
      this.finishGateGroup.visible = true;
      this.finishGateGroup.position.set(0, 0.18 + cfg.targetHeight, 0);
    } else {
      this.finishGateGroup.visible = false;
    }

    if (this.mode === 'campaign' && cfg.laserAltitude !== null) {
      this.laserGroup.visible = true;
      this.laserGroup.position.set(0, 0.18 + cfg.laserAltitude, 0);
    } else {
      this.laserGroup.visible = false;
    }

    this.currentArchetype = this.pickNextArchetype(0);
    this.upcomingArchetype = this.pickNextArchetype(1);
    this.rebuildPreviewVisual();
    this.emitHud();
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.heldKeys.clear();
      this.emitHud();
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.lastTime = performance.now();
      this.emitHud();
    }
  }

  public returnToTitle(): void {
    this.clearActiveBlocks();
    this.ifPreviewDispose();
    this.shadowReticleGroup.visible = false;
    this.dropBeamLine.visible = false;
    this.finishGateGroup.visible = false;
    this.laserGroup.visible = false;
    this.phase = 'title';
    this.buildTitleShowcase();
    this.targetOrbitPitch = 0.48;
    this.targetCameraDistance = 12.6;
    this.targetCameraLookY = 1.65;
    this.emitHud();
  }

  private ifPreviewDispose(): void {
    if (this.previewVisual) {
      this.scene.remove(this.previewVisual.group);
      this.previewVisual.dispose();
      this.previewVisual = null;
    }
  }

  public rotatePreviewBlock(stepRadians = Math.PI / 4): void {
    if (this.phase !== 'playing') return;
    this.previewTargetYaw += stepRadians;
    orbitAudio.playRotate();
  }

  public resetCameraView(): void {
    this.targetOrbitYaw = 0.65;
    this.targetOrbitPitch = 0.54;
    this.targetCameraDistance = 13.5;
  }

  public setMuted(muted: boolean): void {
    orbitAudio.setMuted(muted);
    this.emitHud();
  }

  public dropCurrentBlock(): void {
    if (this.phase !== 'playing' || this.dropCooldown > 0) return;

    if (this.mode === 'campaign' && this.currentLevelConfig.maxBlocks !== null) {
      if (this.blocksDropped >= this.currentLevelConfig.maxBlocks) return;
    }

    // Raycast directly below aim point to record the exact center of the support object for Perfect Drop check
    const spawnY = this.getDropSpawnY();
    _rayOrigin.set(this.aimX, spawnY - 0.1, this.aimZ);
    this.aimRaycaster.set(_rayOrigin, _rayDirDown);
    const targets: THREE.Object3D[] = [this.pedestal.raycastTarget];
    for (const b of this.blocks) targets.push(b.mesh);
    const hits = this.aimRaycaster.intersectObjects(targets, true);

    let supportCenter = { x: 0, z: 0 };
    if (hits.length > 0) {
      let obj: THREE.Object3D | null = hits[0].object;
      const matched = this.blocks.find((b) => {
        let cur: THREE.Object3D | null = obj;
        while (cur) {
          if (cur === b.mesh) return true;
          cur = cur.parent;
        }
        return false;
      });
      if (matched) {
        matched.mesh.getWorldPosition(_vec3C);
        supportCenter = { x: _vec3C.x, z: _vec3C.z };
      }
    }

    const physMat = this.blockPhysMats[this.currentArchetype.modifier];
    const spawnPos = _vec3A.set(this.aimX, spawnY, this.aimZ);
    const block = spawnStackedBlock(
      this.nextBlockId++,
      this.currentArchetype,
      this.saveData.selectedTheme,
      spawnPos,
      this.previewTargetYaw,
      physMat
    );

    if (this.precisionSurgeLeft > 0) {
      block.body.angularDamping = 0.55;
      this.precisionSurgeLeft = Math.max(0, this.precisionSurgeLeft - 1);
    }

    this.supportCenterMap.set(block.id, supportCenter);
    block.body.velocity.set(0, -2.5, 0);

    block.body.addEventListener('collide', (evt: { contact: CANNON.ContactEquation }) => {
      if (this.disposed || this.phase !== 'playing') return;
      const impactVel = Math.abs(evt.contact.getImpactVelocityAlongNormal());
      if (impactVel > 0.35) {
        block.hasCollided = true;
      }

      // Check Fragile Glass shattering on heavy slamming impact
      if (block.archetype.modifier === 'fragile' && impactVel > 8.2 && !block.shattered && !block.frozen) {
        block.shattered = true;
        return;
      }

      if (impactVel > 1.0) {
        orbitAudio.playImpact(impactVel, block.archetype.mass);
      }
      if (impactVel > 4.2) {
        block.squashTimer = 0.16;
        this.shakeIntensity = Math.min(0.28, this.shakeIntensity + impactVel * 0.014);
        if (impactVel > 6.6) {
          this.hitstopTimer = 0.03;
        }
        this.spawnParticleBurst(
          _vec3B.set(block.body.position.x, block.body.position.y - block.halfHeight * 0.6, block.body.position.z),
          block.archetype.edgeHex,
          10,
          3.2
        );
      }
    });

    this.scene.add(block.mesh);
    this.world.addBody(block.body);
    this.blocks.push(block);

    this.blocksDropped += 1;
    this.dropCooldown = 0.4;
    if (this.mode === 'campaign' && this.currentLevelConfig.envModifiers.includes('timerPressure')) {
      this.autoDropTimer = 4.0;
    }

    orbitAudio.playDrop(block.archetype.mass);

    // Advance queue
    this.currentArchetype = this.upcomingArchetype;
    this.upcomingArchetype = this.pickNextArchetype(this.blocksDropped + 1);
    this.rebuildPreviewVisual();
    this.emitHud();
  }

  private getTowerTopY(): number {
    let maxY = 0.18;
    for (const b of this.blocks) {
      if (b.scored || b.frozen || b.hasCollided) {
        const y = b.frozen
          ? b.mesh.getWorldPosition(_vec3C).y + b.halfHeight
          : b.body.position.y + b.halfHeight;
        if (y > maxY) maxY = y;
      }
    }
    return maxY;
  }

  private getDropSpawnY(): number {
    return Math.max(4.4, this.getTowerTopY() + 3.25);
  }

  private computeTowerHeightMeters(): number {
    let top = 0.18;
    for (const b of this.blocks) {
      if (b.scored || b.frozen) {
        const y = b.frozen
          ? b.mesh.getWorldPosition(_vec3C).y + b.halfHeight
          : b.body.position.y + b.halfHeight;
        if (y > top) top = y;
      }
    }
    return Math.max(0, Number((top - 0.18).toFixed(2)));
  }

  private awardGems(amount: number): void {
    if (amount <= 0) return;
    this.saveData.gems += amount;
    this.lastGemsEarned += amount;
    saveCosmeticData(this.saveData);
    this.onCosmeticsChange?.({ ...this.saveData });
  }

  private triggerFreezePulse(): void {
    this.freezePulsesTriggered += 1;

    const candidates = this.blocks
      .filter((b) => !b.frozen && (b.scored || b.hasCollided) && b.body.position.y > -2.0)
      .sort((a, b) => a.body.position.y - b.body.position.y);

    const maxToFreeze = Math.max(1, Math.min(7, candidates.length - 2));
    const toFreeze = candidates.length <= 3 ? candidates : candidates.slice(0, maxToFreeze);

    for (const b of toFreeze) {
      b.frozen = true;
      b.scored = true;

      this.pedestal.body.pointToLocalFrame(b.body.position, _cannonPos);
      this.pedestal.body.quaternion.conjugate(_cannonInvQuat);
      _cannonInvQuat.mult(b.body.quaternion, _cannonQuat);

      this.world.removeBody(b.body);
      this.pedestal.body.addShape(
        b.shapeRef,
        new CANNON.Vec3(_cannonPos.x, _cannonPos.y, _cannonPos.z),
        new CANNON.Quaternion(_cannonQuat.x, _cannonQuat.y, _cannonQuat.z, _cannonQuat.w)
      );

      this.pedestal.group.attach(b.mesh);
      b.primaryMat.emissive.setHex(0x06b6d4);
      b.primaryMat.emissiveIntensity = 0.36;
      b.primaryMat.roughness = 0.22;
      b.edgeMat.color.setHex(0x67e8f9);
      b.edgeMat.opacity = 0.95;

      this.spawnParticleBurst(b.mesh.getWorldPosition(_vec3C), 0x67e8f9, 8, 2.5);
    }

    this.shockwave.active = true;
    this.shockwave.age = 0;
    this.shockwave.startY = -0.2;
    this.shockwave.endY = Math.max(3.5, this.getTowerTopY() + 1.4);
    this.shockwave.mesh.visible = true;

    this.pedestal.pulseRim(0x67e8f9, 3.2);
    this.hitstopTimer = 0.045;
    this.shakeIntensity = Math.min(0.35, this.shakeIntensity + 0.18);
    orbitAudio.playFreezePulse();

    this.bannerText = `FREEZE PULSE · ${toFreeze.length} LAYER LOCKED`;
    this.bannerTimer = 2.6;
  }

  private spawnParticleBurst(
    origin: THREE.Vector3,
    colorHex: number,
    count: number,
    speed: number,
    gravityScale = 1
  ): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.pos.copy(origin);
        const theta = Math.random() * Math.PI * 2;
        const elev = (Math.random() - 0.15) * Math.PI * 0.65;
        const spd = speed * (0.5 + Math.random() * 0.8);
        p.vel.set(
          Math.cos(theta) * Math.cos(elev) * spd,
          Math.sin(elev) * spd + 1.2,
          Math.sin(theta) * Math.cos(elev) * spd
        );
        p.life = 0;
        p.maxLife = 0.42 + Math.random() * 0.35;
        p.size = 0.065 + Math.random() * 0.07;
        p.color.setHex(colorHex);
        p.gravityScale = gravityScale;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  private spawnWindParticle(): void {
    const mag = Math.hypot(this.windX, this.windZ);
    if (mag < 0.8) return;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        const baseY = Math.max(1.2, this.getTowerTopY() + (Math.random() - 0.3) * 4.5);
        p.pos.set(
          -Math.sign(this.windX || 1) * 5.2 + (Math.random() - 0.5) * 3,
          baseY,
          (Math.random() - 0.5) * 6.5
        );
        p.vel.set(this.windX * 1.45, (Math.random() - 0.5) * 0.4, this.windZ * 1.45);
        p.life = 0;
        p.maxLife = 0.75;
        p.size = 0.055;
        p.color.setHex(0xbae6fd);
        p.gravityScale = 0;
        break;
      }
    }
  }

  private syncParticlesToInstancedMesh(): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        _mat4A.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, _mat4A);
      } else {
        const t = 1 - p.life / p.maxLife;
        const s = p.size * Math.max(0, t);
        _vec3C.set(s, s, s);
        _eulerA.set(p.life * 6, p.life * 4, 0);
        _quatA.setFromEuler(_eulerA);
        _mat4A.compose(p.pos, _quatA, _vec3C);
        this.particleMesh.setMatrixAt(i, _mat4A);
        this.particleMesh.setColorAt(i, p.color);
      }
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
  }

  private updateParticles(dt: number): void {
    let anyActive = false;
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      anyActive = true;
      p.vel.y -= 9.5 * p.gravityScale * dt;
      p.pos.addScaledVector(p.vel, dt);
    }
    if (anyActive || this.elapsed < 0.1) {
      this.syncParticlesToInstancedMesh();
    }
  }

  private updateProjectedShadow(): void {
    if (this.phase !== 'playing' || !this.previewVisual) {
      this.shadowReticleGroup.visible = false;
      this.dropBeamLine.visible = false;
      return;
    }

    const spawnY = this.previewVisual.group.position.y;
    _rayOrigin.set(this.aimX, spawnY - 0.1, this.aimZ);
    this.aimRaycaster.set(_rayOrigin, _rayDirDown);

    const targets: THREE.Object3D[] = [this.pedestal.raycastTarget];
    for (const b of this.blocks) {
      targets.push(b.mesh);
    }

    const hits = this.aimRaycaster.intersectObjects(targets, true);
    let hitY = 0.2;
    let onTarget = false;

    if (hits.length > 0) {
      hitY = hits[0].point.y;
      onTarget = true;
      if (hits[0].face) {
        _vec3B.copy(hits[0].face.normal).transformDirection(hits[0].object.matrixWorld).normalize();
        this.shadowReticleGroup.quaternion.setFromUnitVectors(_upVec, _vec3B);
      } else {
        this.shadowReticleGroup.quaternion.identity();
      }
    } else {
      this.shadowReticleGroup.quaternion.identity();
    }

    this.shadowReticleGroup.position.set(this.aimX, hitY + 0.025, this.aimZ);
    this.shadowReticleGroup.visible = true;

    const radiusScale = Math.max(0.75, (this.currentArchetype.kind === 'slab' ? 1.35 : 1.0) * this.currentArchetype.scaleFactor);
    this.shadowReticleGroup.scale.setScalar(radiusScale);

    if (onTarget) {
      this.reticleMat.color.setHex(this.currentArchetype.edgeHex);
      this.reticleMat.opacity = 0.92;
      this.dropBeamMat.color.setHex(this.currentArchetype.edgeHex);
      this.dropBeamMat.opacity = 0.42;
    } else {
      this.reticleMat.color.setHex(0xf43f5e);
      this.reticleMat.opacity = 0.85;
      this.dropBeamMat.color.setHex(0xf43f5e);
      this.dropBeamMat.opacity = 0.48;
    }

    const posAttr = this.dropBeamLine.geometry.attributes.position as THREE.BufferAttribute;
    posAttr.setXYZ(0, this.aimX, spawnY - this.previewVisual.halfHeight, this.aimZ);
    posAttr.setXYZ(1, this.aimX, hitY + 0.03, this.aimZ);
    posAttr.needsUpdate = true;
    this.dropBeamLine.visible = true;
  }

  private handleHeldInputs(dt: number): void {
    if (this.phase !== 'playing') return;

    const orbitSpeed = 1.95;
    if (this.heldKeys.has('KeyQ') || this.heldKeys.has('ArrowLeft')) {
      this.targetOrbitYaw -= orbitSpeed * dt;
    }
    if (this.heldKeys.has('KeyE') || this.heldKeys.has('ArrowRight')) {
      this.targetOrbitYaw += orbitSpeed * dt;
    }

    let moveForward = 0;
    let moveRight = 0;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) moveForward += 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) moveForward -= 1;
    if (this.heldKeys.has('KeyD')) moveRight += 1;
    if (this.heldKeys.has('KeyA')) moveRight -= 1;

    if (moveForward !== 0 || moveRight !== 0) {
      const aimSpeed = 3.6 * dt;
      const fx = -Math.sin(this.orbitYaw);
      const fz = -Math.cos(this.orbitYaw);
      const rx = Math.cos(this.orbitYaw);
      const rz = -Math.sin(this.orbitYaw);

      this.targetAimX += (fx * moveForward + rx * moveRight) * aimSpeed;
      this.targetAimZ += (fz * moveForward + rz * moveRight) * aimSpeed;
      this.clampAimTarget();
    }
  }

  private clampAimTarget(): void {
    const r = Math.hypot(this.targetAimX, this.targetAimZ);
    if (r > MAX_AIM_RADIUS) {
      const scale = MAX_AIM_RADIUS / r;
      this.targetAimX *= scale;
      this.targetAimZ *= scale;
    }
  }

  private updateAimFromPointer(clientX: number, clientY: number): void {
    if (this.phase !== 'playing') return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(_pointerNdc, this.camera);
    const planeY = Math.min(this.getTowerTopY() + 0.4, this.getDropSpawnY() - 1.5);
    _aimPlane.constant = -planeY;

    if (this.raycaster.ray.intersectPlane(_aimPlane, _vec3C)) {
      this.targetAimX = _vec3C.x;
      this.targetAimZ = _vec3C.z;
      this.clampAimTarget();
    }
  }

  private stepSimulation(rawDt: number): void {
    const dt = Math.min(rawDt, 0.05);
    this.elapsed += dt;

    this.starMesh.rotation.y += dt * 0.012;
    this.orbitalRingA.rotation.z += dt * 0.035;
    this.orbitalRingB.rotation.z -= dt * 0.022;

    if (this.finishGateGroup.visible) {
      this.finishGateGroup.rotation.y += dt * 0.4;
      this.finishGateMat.opacity = 0.72 + Math.sin(this.elapsed * 3.0) * 0.16;
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - dt);
      if (this.bannerTimer === 0) {
        this.bannerText = null;
      }
    }

    if (this.phase === 'title') {
      this.orbitYaw += dt * 0.22;
      this.targetOrbitYaw = this.orbitYaw;
      this.pedestal.updateVisuals(dt, this.elapsed);
      for (let i = 0; i < this.titleShowcaseMeshes.length; i++) {
        this.titleShowcaseMeshes[i].rotation.y += dt * (0.08 + i * 0.02);
      }
      this.updateCamera(dt);
      return;
    }

    if (this.phase === 'paused' || this.phase === 'level_complete') {
      this.updateCamera(dt);
      this.updateParticles(dt);
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.updateCamera(dt);
      return;
    }

    this.handleHeldInputs(dt);

    if (this.dropCooldown > 0) {
      this.dropCooldown = Math.max(0, this.dropCooldown - dt);
    }

    // Timer Pressure auto-drop
    if (this.phase === 'playing' && this.autoDropTimer !== null) {
      const canDropMore =
        this.currentLevelConfig.maxBlocks === null ||
        this.blocksDropped < this.currentLevelConfig.maxBlocks;
      if (canDropMore && this.dropCooldown <= 0) {
        this.autoDropTimer -= dt;
        if (this.autoDropTimer <= 0) {
          this.dropCurrentBlock();
        }
      }
    }

    // Crosswind periodic gusts
    if (this.mode === 'campaign' && this.currentLevelConfig.envModifiers.includes('crosswind')) {
      const gustWave = Math.sin(this.elapsed * 0.78);
      const activeFactor = Math.abs(gustWave) > 0.35 ? Math.sign(gustWave) * ((Math.abs(gustWave) - 0.35) / 0.65) : 0;
      const strength = this.currentLevelConfig.windStrength;
      this.windX = activeFactor * strength * Math.cos(this.elapsed * 0.14);
      this.windZ = activeFactor * strength * 0.45 * Math.sin(this.elapsed * 0.14);

      this.windParticleTimer += dt;
      if (this.windParticleTimer > 0.045 && Math.abs(activeFactor) > 0.15) {
        this.windParticleTimer = 0;
        this.spawnWindParticle();
      }
    } else {
      this.windX = 0;
      this.windZ = 0;
    }

    // Sweeping Laser Hazard
    if (this.laserGroup.visible && this.currentLevelConfig.laserAltitude !== null) {
      this.laserSweepX = Math.sin(this.elapsed * 1.45) * 3.35;
      this.laserGroup.position.x = this.laserSweepX;
    }

    // Smooth aim & preview rotation
    this.aimX = THREE.MathUtils.damp(this.aimX, this.targetAimX, 18, dt);
    this.aimZ = THREE.MathUtils.damp(this.aimZ, this.targetAimZ, 18, dt);
    this.previewYaw = THREE.MathUtils.damp(this.previewYaw, this.previewTargetYaw, 16, dt);

    // Moving Pedestal oscillation target
    const isMovingBase =
      this.mode === 'campaign' && this.currentLevelConfig.envModifiers.includes('movingPedestal');
    const targetPitch = isMovingBase ? Math.sin(this.elapsed * 0.8) * 0.085 : 0;
    const targetRoll = isMovingBase ? Math.cos(this.elapsed * 0.6) * 0.075 : 0;

    // Physics sub-steps
    const stiffnessBoost = this.freezePulsesTriggered * 0.14;
    const subSteps = 3;
    const subDt = dt / subSteps;
    for (let s = 0; s < subSteps; s++) {
      this.pedestal.applyGimbalPhysics(stiffnessBoost, targetPitch, targetRoll);

      // Apply crosswind to falling blocks
      if (this.windX !== 0 || this.windZ !== 0) {
        for (const b of this.blocks) {
          if (!b.frozen && !b.hasCollided) {
            _windForce.set(this.windX * b.archetype.mass, 0, this.windZ * b.archetype.mass);
            b.body.applyForce(_windForce);
          }
        }
      }

      this.world.step(1 / 60, subDt, 2);
    }

    this.pedestal.updateVisuals(dt, this.elapsed);

    // Danger Lean creak audio + rim alert
    const tiltDeg = this.pedestal.getTiltDegrees();
    if (tiltDeg > 9.5 && this.phase === 'playing') {
      orbitAudio.playLeanCreak((tiltDeg - 9.5) / 10);
    }

    // Update blocks, laser collision, fragile shattering, 3s stability, & void checks
    let needFreezePulse = false;
    let hudDirty = false;
    const removedIndices: number[] = [];

    for (let i = 0; i < this.blocks.length; i++) {
      const b = this.blocks[i];
      if (b.frozen) continue;

      if (b.shattered) {
        removedIndices.push(i);
        orbitAudio.playShatter();
        this.spawnParticleBurst(
          _vec3C.set(b.body.position.x, b.body.position.y, b.body.position.z),
          0xe0f2fe,
          18,
          4.5
        );
        this.bannerText = 'GLASS BLOCK SHATTERED';
        this.bannerTimer = 1.6;
        continue;
      }

      // Check sweeping laser vs falling blocks
      if (this.laserGroup.visible && !b.hasCollided && this.phase === 'playing') {
        const ly = this.laserGroup.position.y;
        if (Math.abs(b.body.position.y - ly) < b.halfHeight + 0.35) {
          if (Math.abs(b.body.position.x - this.laserSweepX) < b.footprintRadius + 0.25) {
            b.body.applyImpulse(
              new CANNON.Vec3(Math.sign(b.body.position.x - this.laserSweepX || 1) * 14, 3, 0)
            );
            b.hasCollided = true;
            orbitAudio.playLaserZap();
            this.shakeIntensity = Math.min(0.32, this.shakeIntensity + 0.16);
            this.spawnParticleBurst(
              _vec3C.set(b.body.position.x, b.body.position.y, b.body.position.z),
              0xf43f5e,
              14,
              4.2
            );
          }
        }
      }

      b.mesh.position.set(b.body.position.x, b.body.position.y, b.body.position.z);
      b.mesh.quaternion.set(
        b.body.quaternion.x,
        b.body.quaternion.y,
        b.body.quaternion.z,
        b.body.quaternion.w
      );

      if (b.squashTimer > 0) {
        b.squashTimer = Math.max(0, b.squashTimer - dt);
        const st = Math.sin((b.squashTimer / 0.16) * Math.PI);
        b.mesh.scale.set(1 + st * 0.08, 1 - st * 0.09, 1 + st * 0.08);
      } else {
        b.mesh.scale.set(1, 1, 1);
      }

      if (b.body.position.y < VOID_Y_THRESHOLD) {
        removedIndices.push(i);
        continue;
      }

      if (!b.hasCollided && performance.now() - b.dropTimestamp > 1400 && b.body.velocity.length() < 0.6) {
        b.hasCollided = true;
      }

      // 3-Second Stability Tracker
      if (!b.scored && b.hasCollided && this.phase === 'playing') {
        const speed = b.body.velocity.length();
        const angSpeed = b.body.angularVelocity.length();

        if (speed < 0.36 && angSpeed < 0.48 && b.body.position.y > -1.5) {
          b.stableTime += dt;
          const progress = Math.min(1, b.stableTime / STABILITY_REQUIRED_SEC);
          b.edgeMat.color.setHex(b.archetype.edgeHex).lerp(_colorA.setHex(0xffffff), progress * 0.85);
          b.primaryMat.emissiveIntensity = 0.14 + progress * 0.42;

          if (b.stableTime >= STABILITY_REQUIRED_SEC) {
            b.scored = true;
            b.primaryMat.emissiveIntensity = 0.22;
            b.edgeMat.color.setHex(b.archetype.edgeHex);

            this.blocksStacked += 1;
            this.comboCount += 1;
            this.heightMeters = this.computeTowerHeightMeters();

            // Check Perfect Drop alignment against support center
            const support = this.supportCenterMap.get(b.id) ?? { x: 0, z: 0 };
            const offsetXZ = Math.hypot(b.body.position.x - support.x, b.body.position.z - support.z);
            const isPerfect = offsetXZ <= PERFECT_OFFSET_THRESHOLD;

            if (isPerfect) {
              this.perfectStreak += 1;
              const mult = Math.min(5, 1 + this.perfectStreak);
              const bonusPts = (120 + Math.floor(this.heightMeters * 30)) * mult;
              this.score += bonusPts;
              this.awardGems(2 + Math.floor(mult / 2));
              orbitAudio.playPerfectDrop(this.perfectStreak);
              this.pedestal.pulseRim(0xfbbf24, 2.8);
              this.spawnParticleBurst(
                _vec3C.set(b.body.position.x, b.body.position.y, b.body.position.z),
                0xfde047,
                18,
                4.2
              );

              if (this.perfectStreak % 5 === 0) {
                this.precisionSurgeLeft = 2;
                this.bannerText = `5x PRECISION SURGE · NEXT 2 BLOCKS WIDENED!`;
                this.bannerTimer = 2.6;
              } else {
                this.bannerText = `PERFECT DROP · ${mult}x MULTIPLIER`;
                this.bannerTimer = 1.6;
              }
            } else {
              this.perfectStreak = 0;
              const pts = 100 + Math.floor(this.heightMeters * 28) + Math.min(this.comboCount, 12) * 15;
              this.score += pts;
              orbitAudio.playStabilize(this.blocksStacked);
              this.pedestal.pulseRim(b.archetype.colorHex, 2.0);
              this.spawnParticleBurst(
                _vec3C.set(b.body.position.x, b.body.position.y, b.body.position.z),
                b.archetype.edgeHex,
                12,
                3.4
              );
            }

            // Height milestone gems every 5m
            while (this.heightMeters >= this.nextGemHeightMilestone) {
              this.awardGems(10);
              this.nextGemHeightMilestone += 5;
            }

            if (this.score > this.bestScore) {
              this.bestScore = this.score;
              localStorage.setItem(STORAGE_BEST_SCORE, String(this.bestScore));
            }
            if (this.heightMeters > this.bestHeightMeters) {
              this.bestHeightMeters = this.heightMeters;
              localStorage.setItem(STORAGE_BEST_HEIGHT, String(this.bestHeightMeters));
            }

            if (this.blocksStacked % FREEZE_INTERVAL === 0) {
              needFreezePulse = true;
            }

            // Check Campaign Level Completion!
            if (
              this.mode === 'campaign' &&
              this.heightMeters >= this.currentLevelConfig.targetHeight
            ) {
              this.completeCurrentLevel();
              return;
            }

            hudDirty = true;
          }
        } else if (speed > 0.85 || angSpeed > 1.2) {
          b.stableTime = Math.max(0, b.stableTime - dt * 1.4);
          b.primaryMat.emissiveIntensity = 0.14;
        }
      }
    }

    // Remove lost / shattered blocks
    if (removedIndices.length > 0) {
      for (let k = removedIndices.length - 1; k >= 0; k--) {
        const idx = removedIndices[k];
        const lost = this.blocks[idx];
        this.world.removeBody(lost.body);
        this.scene.remove(lost.mesh);
        lost.dispose();
        this.blocks.splice(idx, 1);

        if (this.phase === 'playing') {
          this.integrity = Math.max(0, this.integrity - 1);
          this.comboCount = 0;
          this.perfectStreak = 0;
          this.shakeIntensity = Math.min(0.45, this.shakeIntensity + 0.25);
          this.pedestal.pulseRim(0xf43f5e, 3.0);
          if (!lost.shattered) {
            orbitAudio.playVoidLoss();
          }

          if (this.integrity <= 0) {
            this.triggerGameOver('TOWER COLLAPSED');
          } else if (!lost.shattered) {
            this.bannerText = `BLOCK LOST · ${this.integrity} INTEGRITY LEFT`;
            this.bannerTimer = 1.8;
          }
          hudDirty = true;
        }
      }
      this.heightMeters = this.computeTowerHeightMeters();
    }

    // Check Out-of-Blocks failure in Campaign budget levels
    if (
      this.phase === 'playing' &&
      this.mode === 'campaign' &&
      this.currentLevelConfig.maxBlocks !== null &&
      this.blocksDropped >= this.currentLevelConfig.maxBlocks
    ) {
      const anyActiveSettling = this.blocks.some((b) => !b.frozen && !b.scored);
      if (!anyActiveSettling && this.heightMeters < this.currentLevelConfig.targetHeight) {
        this.triggerGameOver('OUT OF BLOCKS');
        hudDirty = true;
      }
    }

    if (needFreezePulse && this.phase === 'playing') {
      this.triggerFreezePulse();
      hudDirty = true;
    }

    // Update hovering preview block
    if (this.previewVisual && this.phase === 'playing') {
      const canDropMore =
        this.mode !== 'campaign' ||
        this.currentLevelConfig.maxBlocks === null ||
        this.blocksDropped < this.currentLevelConfig.maxBlocks;
      this.previewVisual.group.visible = canDropMore;
      const targetY = this.getDropSpawnY() + Math.sin(this.elapsed * 3.2) * 0.08;
      this.previewVisual.group.position.set(this.aimX, targetY, this.aimZ);
      this.previewVisual.group.rotation.y = this.previewYaw;
    }

    this.updateProjectedShadow();
    this.updateShockwave(dt);
    this.updateParticles(dt);

    const topY = this.getTowerTopY();
    this.targetCameraLookY = Math.max(1.25, topY * 0.54 + 0.8);
    this.targetCameraDistance = Math.max(this.targetCameraDistance, 12.2 + topY * 0.44);
    this.updateCamera(dt);

    this.keyLightTarget.position.set(0, topY * 0.5, 0);
    this.keyLight.position.set(10, topY * 0.5 + 17, 11);

    this.hudSyncTimer += dt;
    if (hudDirty || this.hudSyncTimer >= 0.1) {
      this.hudSyncTimer = 0;
      this.emitHud();
    }
  }

  private completeCurrentLevel(): void {
    this.phase = 'level_complete';
    this.ifPreviewDispose();
    this.shadowReticleGroup.visible = false;
    this.dropBeamLine.visible = false;
    this.autoDropTimer = null;

    const reward = this.currentLevelConfig.rewardGems;
    this.awardGems(reward);

    if (this.currentLevelConfig.level >= this.saveData.highestUnlockedLevel) {
      this.saveData.highestUnlockedLevel = this.currentLevelConfig.level + 1;
      saveCosmeticData(this.saveData);
      this.onCosmeticsChange?.({ ...this.saveData });
    }

    this.pedestal.pulseRim(0x34d399, 3.4);
    this.spawnParticleBurst(_vec3C.set(0, this.getTowerTopY(), 0), 0x34d399, 36, 5.5);
    orbitAudio.playLevelComplete();

    this.bannerText = `LEVEL ${this.currentLevelConfig.level} CLEARED!`;
    this.bannerTimer = 3.5;
    this.emitHud();
  }

  private triggerGameOver(reason: string): void {
    this.phase = 'gameover';
    this.ifPreviewDispose();
    this.shadowReticleGroup.visible = false;
    this.dropBeamLine.visible = false;
    this.autoDropTimer = null;
    orbitAudio.playGameOver();
    this.bannerText = reason;
    this.bannerTimer = 3.0;
  }

  private updateShockwave(dt: number): void {
    if (!this.shockwave.active) return;
    this.shockwave.age += dt;
    const t = this.shockwave.age / this.shockwave.duration;
    if (t >= 1) {
      this.shockwave.active = false;
      this.shockwave.mesh.visible = false;
      return;
    }
    const eased = 1 - Math.pow(1 - t, 3);
    this.shockwave.mesh.position.y = THREE.MathUtils.lerp(this.shockwave.startY, this.shockwave.endY, eased);
    this.shockwave.mesh.scale.setScalar(0.85 + eased * 0.65);
    this.shockwave.mat.opacity = (1 - t) * 0.85;
  }

  private updateCamera(dt: number): void {
    this.orbitYaw = THREE.MathUtils.damp(this.orbitYaw, this.targetOrbitYaw, 10, dt);
    this.orbitPitch = THREE.MathUtils.damp(this.orbitPitch, this.targetOrbitPitch, 10, dt);
    this.cameraDistance = THREE.MathUtils.damp(this.cameraDistance, this.targetCameraDistance, 8, dt);
    this.cameraLookY = THREE.MathUtils.damp(this.cameraLookY, this.targetCameraLookY, 5, dt);

    const cosPitch = Math.cos(this.orbitPitch);
    const camX = Math.sin(this.orbitYaw) * cosPitch * this.cameraDistance;
    const camY = Math.sin(this.orbitPitch) * this.cameraDistance + this.cameraLookY * 0.55;
    const camZ = Math.cos(this.orbitYaw) * cosPitch * this.cameraDistance;

    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeIntensity > 0.002) {
      shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 12, dt);
    } else {
      this.shakeIntensity = 0;
    }

    this.camera.position.set(camX + shakeX, camY + shakeY, camZ);
    this.camera.lookAt(0, this.cameraLookY, 0);
  }

  private emitHud(): void {
    let settlingCount = 0;
    let maxStableRatio = 0;
    for (const b of this.blocks) {
      if (!b.scored && !b.frozen && b.hasCollided) {
        settlingCount++;
        const ratio = Math.min(1, b.stableTime / STABILITY_REQUIRED_SEC);
        if (ratio > maxStableRatio) maxStableRatio = ratio;
      }
    }

    const cfg = this.currentLevelConfig;
    const blocksRemaining =
      this.mode === 'campaign' && cfg.maxBlocks !== null
        ? Math.max(0, cfg.maxBlocks - this.blocksDropped)
        : null;

    this.onHudChange({
      phase: this.phase,
      mode: this.mode,
      level: cfg.level,
      levelName: cfg.name,
      levelSubtitle: cfg.subtitle,
      isChallenge: cfg.isChallenge,
      targetHeightMeters: this.mode === 'campaign' ? cfg.targetHeight : null,
      blocksRemaining,
      activeEnvModifiers: this.mode === 'campaign' ? cfg.envModifiers : [],
      score: this.score,
      bestScore: this.bestScore,
      heightMeters: this.heightMeters,
      bestHeightMeters: this.bestHeightMeters,
      blocksStacked: this.blocksStacked,
      blocksDropped: this.blocksDropped,
      integrity: this.integrity,
      maxIntegrity: MAX_INTEGRITY,
      freezeProgress: this.blocksStacked % FREEZE_INTERVAL,
      freezeInterval: FREEZE_INTERVAL,
      freezePulsesTriggered: this.freezePulsesTriggered,
      nextBlock: this.currentArchetype,
      upcomingBlock: this.upcomingArchetype,
      settlingCount,
      settlingProgress: maxStableRatio,
      pedestalTiltDeg: Number(this.pedestal.getTiltDegrees().toFixed(1)),
      comboCount: this.comboCount,
      perfectStreak: this.perfectStreak,
      scoreMultiplier: Math.min(5, 1 + this.perfectStreak),
      precisionSurgeLeft: this.precisionSurgeLeft,
      gems: this.saveData.gems,
      lastGemsEarned: this.lastGemsEarned,
      windX: Number(this.windX.toFixed(1)),
      windZ: Number(this.windZ.toFixed(1)),
      autoDropRemaining: this.autoDropTimer !== null ? Math.max(0, Number(this.autoDropTimer.toFixed(1))) : null,
      lastEventBanner: this.bannerText,
      muted: orbitAudio.isMuted(),
    });
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.stepSimulation(rawDt);
    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  };

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private onResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    this.heldKeys.add(e.code);

    if (e.repeat) return;

    if (this.phase === 'title') {
      if (e.code === 'Enter' || e.code === 'Space') {
        this.startCampaignLevel(this.saveData.highestUnlockedLevel);
      }
      return;
    }

    if (this.phase === 'level_complete') {
      if (e.code === 'Enter' || e.code === 'Space') {
        this.startCampaignLevel(this.currentLevelConfig.level + 1);
      }
      return;
    }

    if (this.phase === 'gameover') {
      if (e.code === 'Enter' || e.code === 'Space') {
        this.restartCurrentRun();
      }
      return;
    }

    if (e.code === 'Escape' || e.code === 'KeyP') {
      this.togglePause();
      return;
    }

    if (this.phase === 'playing') {
      if (e.code === 'Space') {
        this.dropCurrentBlock();
      } else if (e.code === 'KeyR') {
        this.rotatePreviewBlock();
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private onBlur = (): void => {
    this.heldKeys.clear();
    this.isDraggingOrbit = false;
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.phase !== 'playing') return;
    orbitAudio.unlock();

    this.pointerDownPos = { x: e.clientX, y: e.clientY };

    if (e.button === 2 || e.button === 1) {
      this.isDraggingOrbit = true;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
    } else if (e.button === 0) {
      this.updateAimFromPointer(e.clientX, e.clientY);
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.phase !== 'playing') return;
    if (this.isDraggingOrbit) {
      const dx = e.clientX - this.lastDragX;
      const dy = e.clientY - this.lastDragY;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
      this.targetOrbitYaw -= dx * 0.008;
      this.targetOrbitPitch = THREE.MathUtils.clamp(this.targetOrbitPitch + dy * 0.005, 0.22, 1.15);
    } else {
      this.updateAimFromPointer(e.clientX, e.clientY);
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.button === 2 || e.button === 1) {
      this.isDraggingOrbit = false;
      return;
    }
    if (e.button === 0 && this.phase === 'playing') {
      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (dist < 14) {
        this.updateAimFromPointer(e.clientX, e.clientY);
        this.dropCurrentBlock();
      }
    }
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    this.targetCameraDistance = THREE.MathUtils.clamp(
      this.targetCameraDistance + e.deltaY * 0.008,
      9.2,
      26.0
    );
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private bindEvents(): void {
    const dom = this.renderer.domElement;
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: true });
    dom.addEventListener('contextmenu', this.onContextMenu);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    const dom = this.renderer.domElement;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('pointermove', this.onPointerMove);
    dom.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('wheel', this.onWheel);
    dom.removeEventListener('contextmenu', this.onContextMenu);

    this.clearTitleShowcase();
    this.clearActiveBlocks();
    this.ifPreviewDispose();

    this.pedestal.dispose();
    this.textures.dispose();
    this.envTexture.dispose();

    this.starMesh.geometry.dispose();
    (this.starMesh.material as THREE.Material).dispose();
    this.orbitalRingA.geometry.dispose();
    (this.orbitalRingA.material as THREE.Material).dispose();
    this.orbitalRingB.geometry.dispose();
    (this.orbitalRingB.material as THREE.Material).dispose();
    this.finishGateGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry.dispose();
      }
    });
    this.finishGateMat.dispose();
    this.laserGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry.dispose();
        const m = (obj as THREE.Mesh).material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.shockwave.mesh.geometry.dispose();
    this.shockwave.mat.dispose();
    this.shadowDiscMesh.geometry.dispose();
    (this.shadowDiscMesh.material as THREE.Material).dispose();
    this.reticleRingMesh.geometry.dispose();
    this.reticleMat.dispose();
    this.dropBeamLine.geometry.dispose();
    this.dropBeamMat.dispose();

    if (dom.parentNode === this.container) {
      this.container.removeChild(dom);
    }
    this.renderer.dispose();
  }
}
