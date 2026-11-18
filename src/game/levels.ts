import { BlockModifierKind, BlockShapeKind, EnvModifierKind, LevelConfig } from './types';

const HANDCRAFTED_LEVELS: LevelConfig[] = [
  {
    level: 1,
    name: 'First Orbit',
    subtitle: 'Standard cubes & cylinders. Learn 3D aim and balance.',
    targetHeight: 10,
    maxBlocks: null,
    shapePool: ['cube', 'pillar'],
    blockModifiers: ['standard'],
    envModifiers: [],
    isChallenge: false,
    blockScaleMultiplier: 1.0,
    windStrength: 0,
    laserAltitude: null,
    rewardGems: 25,
  },
  {
    level: 2,
    name: 'Twin Foundations',
    subtitle: 'Cubes, beams & cylinders within an 18-block budget.',
    targetHeight: 10,
    maxBlocks: 18,
    shapePool: ['cube', 'slab', 'pillar'],
    blockModifiers: ['standard'],
    envModifiers: [],
    isChallenge: false,
    blockScaleMultiplier: 1.0,
    windStrength: 0,
    laserAltitude: null,
    rewardGems: 30,
  },
  {
    level: 3,
    name: 'Angled Traps',
    subtitle: 'Prism Wedges enter the drop pool — watch the slopes!',
    targetHeight: 15,
    maxBlocks: null,
    shapePool: ['cube', 'slab', 'pillar', 'wedge'],
    blockModifiers: ['standard'],
    envModifiers: [],
    isChallenge: false,
    blockScaleMultiplier: 1.0,
    windStrength: 0,
    laserAltitude: null,
    rewardGems: 35,
  },
  {
    level: 4,
    name: 'Slope Precision',
    subtitle: 'Pair wedges together or counter-balance wide beams.',
    targetHeight: 15,
    maxBlocks: 22,
    shapePool: ['cube', 'slab', 'pillar', 'wedge'],
    blockModifiers: ['standard'],
    envModifiers: [],
    isChallenge: false,
    blockScaleMultiplier: 1.0,
    windStrength: 0,
    laserAltitude: null,
    rewardGems: 40,
  },
  {
    level: 5,
    name: 'Heavy Metal',
    subtitle: '3x weight Heavy Alloy blocks tilt off-center towers fast.',
    targetHeight: 18,
    maxBlocks: null,
    shapePool: ['cube', 'slab', 'pillar', 'wedge'],
    blockModifiers: ['standard', 'heavy'],
    envModifiers: [],
    isChallenge: true,
    blockScaleMultiplier: 1.0,
    windStrength: 0,
    laserAltitude: null,
    rewardGems: 55,
  },
  {
    level: 6,
    name: 'Solar Gusts',
    subtitle: 'Periodic crosswinds push falling blocks mid-air.',
    targetHeight: 22,
    maxBlocks: null,
    shapePool: ['cube', 'slab', 'pillar', 'wedge'],
    blockModifiers: ['standard', 'heavy'],
    envModifiers: ['crosswind'],
    isChallenge: false,
    blockScaleMultiplier: 1.0,
    windStrength: 5.5,
    laserAltitude: null,
    rewardGems: 50,
  },
  {
    level: 7,
    name: 'Gale Corridor',
    subtitle: 'Lead your drops as stronger gusts sweep across the sky.',
    targetHeight: 22,
    maxBlocks: 28,
    shapePool: ['cube', 'slab', 'pillar', 'wedge', 'orb'],
    blockModifiers: ['standard', 'heavy'],
    envModifiers: ['crosswind'],
    isChallenge: false,
    blockScaleMultiplier: 1.0,
    windStrength: 7.5,
    laserAltitude: null,
    rewardGems: 55,
  },
  {
    level: 8,
    name: 'Glacial Drift',
    subtitle: 'Low-friction Ice Blocks slide off any tilted surface.',
    targetHeight: 25,
    maxBlocks: null,
    shapePool: ['cube', 'slab', 'pillar', 'wedge'],
    blockModifiers: ['standard', 'ice'],
    envModifiers: [],
    isChallenge: false,
    blockScaleMultiplier: 1.0,
    windStrength: 0,
    laserAltitude: null,
    rewardGems: 65,
  },
  {
    level: 9,
    name: 'Tidal Gimbal',
    subtitle: 'The orbital pedestal slowly rocks back and forth.',
    targetHeight: 28,
    maxBlocks: null,
    shapePool: ['cube', 'slab', 'pillar', 'wedge', 'orb'],
    blockModifiers: ['standard', 'heavy', 'ice'],
    envModifiers: ['movingPedestal'],
    isChallenge: false,
    blockScaleMultiplier: 1.0,
    windStrength: 0,
    laserAltitude: null,
    rewardGems: 75,
  },
  {
    level: 10,
    name: 'Apex Horizon',
    subtitle: 'BOSS: Heavy + Ice + Crosswinds + 20m Sweeping Laser!',
    targetHeight: 35,
    maxBlocks: null,
    shapePool: ['cube', 'slab', 'pillar', 'wedge', 'orb'],
    blockModifiers: ['standard', 'heavy', 'ice'],
    envModifiers: ['crosswind', 'laserHazard'],
    isChallenge: true,
    blockScaleMultiplier: 1.0,
    windStrength: 7.5,
    laserAltitude: 20,
    rewardGems: 120,
  },
];

export function getLevelConfig(levelNum: number): LevelConfig {
  const clamped = Math.max(1, Math.floor(levelNum));
  if (clamped <= HANDCRAFTED_LEVELS.length) {
    return HANDCRAFTED_LEVELS[clamped - 1];
  }

  // Deterministic procedural scaling for Levels 11–50+
  const isChallenge = clamped % 5 === 0;
  const tier = clamped - 10; // 1+

  const allShapes: BlockShapeKind[] = ['cube', 'slab', 'pillar', 'wedge', 'orb'];
  const modifierCombos: BlockModifierKind[][] = [
    ['standard', 'ice', 'bouncy'],
    ['standard', 'heavy', 'fragile'],
    ['standard', 'bouncy', 'heavy'],
    ['standard', 'ice', 'fragile'],
    ['standard', 'heavy', 'ice', 'bouncy', 'fragile'],
  ];
  const envCombos: EnvModifierKind[][] = [
    ['crosswind', 'lowGravity'],
    ['movingPedestal', 'crosswind'],
    ['shrinkingDrop', 'timerPressure'],
    ['crosswind', 'timerPressure'],
    ['movingPedestal', 'laserHazard'],
  ];

  const blockModifiers = modifierCombos[clamped % modifierCombos.length];
  const envModifiers = [...envCombos[(clamped + 2) % envCombos.length]];

  // Levels 21–30+ tighten block budgets
  const targetHeight = Math.min(55, 30 + Math.floor(tier * 1.15));
  const maxBlocks = clamped >= 21 && !isChallenge ? Math.ceil(targetHeight * 1.15) + 4 : null;

  let name = `Sector ${clamped}`;
  let subtitle = 'Dual orbital modifiers engaged.';
  let blockScaleMultiplier = 1.0;

  if (isChallenge) {
    if (clamped % 10 === 5) {
      name = `Giant Surge · Stage ${clamped}`;
      subtitle = 'Challenge: Giant 1.3x monoliths + Low Gravity!';
      blockScaleMultiplier = 1.3;
      if (!envModifiers.includes('lowGravity')) envModifiers.push('lowGravity');
    } else {
      name = `Omega Gauntlet · Stage ${clamped}`;
      subtitle = 'Challenge: Sweeping Laser + Timer Pressure!';
      if (!envModifiers.includes('laserHazard')) envModifiers.push('laserHazard');
      if (!envModifiers.includes('timerPressure')) envModifiers.push('timerPressure');
    }
  } else {
    const labels: Record<EnvModifierKind, string> = {
      crosswind: 'Crosswinds',
      movingPedestal: 'Moving Base',
      shrinkingDrop: 'Shrinking Blocks',
      lowGravity: 'Low Gravity',
      timerPressure: '4s Auto-Drop',
      laserHazard: 'Laser Sweep',
    };
    subtitle = envModifiers.map((m) => labels[m]).join(' + ') + (maxBlocks ? ` · ${maxBlocks} Block Limit` : '');
  }

  return {
    level: clamped,
    name,
    subtitle,
    targetHeight,
    maxBlocks,
    shapePool: allShapes,
    blockModifiers,
    envModifiers,
    isChallenge,
    blockScaleMultiplier,
    windStrength: envModifiers.includes('crosswind') ? Math.min(11, 6.5 + tier * 0.2) : 0,
    laserAltitude: envModifiers.includes('laserHazard') ? Math.round(targetHeight * 0.58) : null,
    rewardGems: isChallenge ? 110 + tier * 3 : 65 + tier * 2,
  };
}
