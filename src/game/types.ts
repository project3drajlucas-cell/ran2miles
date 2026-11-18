export type GamePhase = 'title' | 'playing' | 'paused' | 'level_complete' | 'gameover';

export type GameMode = 'campaign' | 'endless';

export type BlockShapeKind = 'cube' | 'slab' | 'pillar' | 'wedge' | 'orb';

export type BlockModifierKind = 'standard' | 'heavy' | 'bouncy' | 'ice' | 'fragile';

export type EnvModifierKind =
  | 'crosswind'
  | 'movingPedestal'
  | 'shrinkingDrop'
  | 'lowGravity'
  | 'timerPressure'
  | 'laserHazard';

export type ThemeId = 'cyber' | 'wooden' | 'sushi' | 'ruins';

export type PedestalSkinId = 'slate' | 'gold' | 'cryo';

export interface LevelConfig {
  level: number;
  name: string;
  subtitle: string;
  targetHeight: number;
  maxBlocks: number | null; // null = unlimited
  shapePool: BlockShapeKind[];
  blockModifiers: BlockModifierKind[];
  envModifiers: EnvModifierKind[];
  isChallenge: boolean;
  blockScaleMultiplier: number;
  windStrength: number;
  laserAltitude: number | null;
  rewardGems: number;
}

export interface BlockArchetype {
  kind: BlockShapeKind;
  modifier: BlockModifierKind;
  label: string;
  mass: number;
  weightLabel: 'Light' | 'Medium' | 'Heavy';
  colorHex: number;
  emissiveHex: number;
  edgeHex: number;
  accentColorCss: string;
  scaleFactor: number;
}

export interface CosmeticSaveData {
  gems: number;
  unlockedThemes: ThemeId[];
  selectedTheme: ThemeId;
  unlockedSkins: PedestalSkinId[];
  selectedSkin: PedestalSkinId;
  highestUnlockedLevel: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  mode: GameMode;
  level: number;
  levelName: string;
  levelSubtitle: string;
  isChallenge: boolean;
  targetHeightMeters: number | null;
  blocksRemaining: number | null;
  activeEnvModifiers: EnvModifierKind[];

  score: number;
  bestScore: number;
  heightMeters: number;
  bestHeightMeters: number;
  blocksStacked: number;
  blocksDropped: number;
  integrity: number;
  maxIntegrity: number;
  freezeProgress: number;
  freezeInterval: number;
  freezePulsesTriggered: number;

  nextBlock: BlockArchetype;
  upcomingBlock: BlockArchetype;
  settlingCount: number;
  settlingProgress: number;
  pedestalTiltDeg: number;

  comboCount: number;
  perfectStreak: number;
  scoreMultiplier: number;
  precisionSurgeLeft: number;

  gems: number;
  lastGemsEarned: number;
  windX: number;
  windZ: number;
  autoDropRemaining: number | null;

  lastEventBanner: string | null;
  muted: boolean;
}
