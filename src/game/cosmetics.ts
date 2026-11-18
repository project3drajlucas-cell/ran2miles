import { CosmeticSaveData, PedestalSkinId, ThemeId } from './types';

export interface BlockThemeDef {
  id: ThemeId;
  name: string;
  description: string;
  costGems: number;
  roughness: number;
  metalness: number;
  trimColor: number;
  trimMetalness: number;
  trimRoughness: number;
  palette: {
    cube: { color: number; emissive: number; edge: number; css: string };
    slab: { color: number; emissive: number; edge: number; css: string };
    pillar: { color: number; emissive: number; edge: number; css: string };
    wedge: { color: number; emissive: number; edge: number; css: string };
    orb: { color: number; emissive: number; edge: number; css: string };
  };
}

export interface PedestalSkinDef {
  id: PedestalSkinId;
  name: string;
  description: string;
  costGems: number;
  deckTint: number;
  collarColor: number;
  collarMetalness: number;
  collarRoughness: number;
  hullColor: number;
  rimColor: number;
  coreColor: number;
}

export const BLOCK_THEMES: Record<ThemeId, BlockThemeDef> = {
  cyber: {
    id: 'cyber',
    name: 'Neon Cyber',
    description: 'Anodized slate alloy with luminous orbital edge traces.',
    costGems: 0,
    roughness: 0.36,
    metalness: 0.38,
    trimColor: 0xcbd5e1,
    trimMetalness: 0.85,
    trimRoughness: 0.2,
    palette: {
      cube: { color: 0x3b82f6, emissive: 0x1d4ed8, edge: 0x93c5fd, css: '#60a5fa' },
      slab: { color: 0xf59e0b, emissive: 0xb45309, edge: 0xfde68a, css: '#fbbf24' },
      pillar: { color: 0x10b981, emissive: 0x047857, edge: 0x6ee7b7, css: '#34d399' },
      wedge: { color: 0xf43f5e, emissive: 0xbe123c, edge: 0xfda4af, css: '#fb7185' },
      orb: { color: 0xa855f7, emissive: 0x7e22ce, edge: 0xe9d5ff, css: '#c084fc' },
    },
  },
  wooden: {
    id: 'wooden',
    name: 'Wooden Toys',
    description: 'Hand-painted matte beech, walnut, and warm nursery timber.',
    costGems: 60,
    roughness: 0.78,
    metalness: 0.04,
    trimColor: 0x78350f,
    trimMetalness: 0.05,
    trimRoughness: 0.72,
    palette: {
      cube: { color: 0xd97706, emissive: 0x451a03, edge: 0xfef3c7, css: '#f59e0b' },
      slab: { color: 0xe2c799, emissive: 0x574124, edge: 0xfef9c3, css: '#e2c799' },
      pillar: { color: 0x4d7c0f, emissive: 0x1a2e05, edge: 0xbef264, css: '#84cc16' },
      wedge: { color: 0xdc2626, emissive: 0x450a0a, edge: 0xfecaca, css: '#ef4444' },
      orb: { color: 0x0284c7, emissive: 0x082f49, edge: 0xbae6fd, css: '#38bdf8' },
    },
  },
  sushi: {
    id: 'sushi',
    name: 'Sushi Rolls',
    description: 'Glazed salmon nigiri, nori maki, tamago gold, and rice.',
    costGems: 120,
    roughness: 0.34,
    metalness: 0.08,
    trimColor: 0x14261c,
    trimMetalness: 0.05,
    trimRoughness: 0.65,
    palette: {
      cube: { color: 0xf8fafc, emissive: 0x334155, edge: 0x86efac, css: '#f8fafc' },
      slab: { color: 0xf97316, emissive: 0x7c2d12, edge: 0xfed7aa, css: '#fb923c' },
      pillar: { color: 0x166534, emissive: 0x052e16, edge: 0x4ade80, css: '#22c55e' },
      wedge: { color: 0xfacc15, emissive: 0x713f12, edge: 0xfef08a, css: '#fde047' },
      orb: { color: 0xf43f5e, emissive: 0x881337, edge: 0xfda4af, css: '#fb7185' },
    },
  },
  ruins: {
    id: 'ruins',
    name: 'Ancient Ruins',
    description: 'Carved sandstone, mossy jade monoliths, and gilded bronze.',
    costGems: 180,
    roughness: 0.86,
    metalness: 0.14,
    trimColor: 0xd4af37,
    trimMetalness: 0.82,
    trimRoughness: 0.28,
    palette: {
      cube: { color: 0xc2a373, emissive: 0x3b2d18, edge: 0xfde68a, css: '#d6b888' },
      slab: { color: 0x64748b, emissive: 0x1e293b, edge: 0xcbd5e1, css: '#94a3b8' },
      pillar: { color: 0x0d9488, emissive: 0x134e4a, edge: 0x5eead4, css: '#2dd4bf' },
      wedge: { color: 0xb45309, emissive: 0x451a03, edge: 0xfcd34d, css: '#f59e0b' },
      orb: { color: 0x334155, emissive: 0x0f172a, edge: 0xfbbf24, css: '#fbbf24' },
    },
  },
};

export const PEDESTAL_SKINS: Record<PedestalSkinId, PedestalSkinDef> = {
  slate: {
    id: 'slate',
    name: 'Orbital Slate',
    description: 'Standard issue titanium-rimmed cosmic landing deck.',
    costGems: 0,
    deckTint: 0xffffff,
    collarColor: 0x94a3b8,
    collarMetalness: 0.88,
    collarRoughness: 0.2,
    hullColor: 0x161f33,
    rimColor: 0x0ea5e9,
    coreColor: 0x38bdf8,
  },
  gold: {
    id: 'gold',
    name: 'Solar Gold',
    description: 'Brushed celestial gold collar with amber plasma core.',
    costGems: 90,
    deckTint: 0xfef3c7,
    collarColor: 0xfbbf24,
    collarMetalness: 0.94,
    collarRoughness: 0.16,
    hullColor: 0x292018,
    rimColor: 0xf59e0b,
    coreColor: 0xfcd34d,
  },
  cryo: {
    id: 'cryo',
    name: 'Cryo Obsidian',
    description: 'Sub-zero obsidian hull with radiant glacial halo.',
    costGems: 150,
    deckTint: 0xcffafe,
    collarColor: 0x38bdf8,
    collarMetalness: 0.82,
    collarRoughness: 0.15,
    hullColor: 0x0b1220,
    rimColor: 0x22d3ee,
    coreColor: 0x67e8f9,
  },
};

const SAVE_KEY = 'orbit_stack_cosmetics_v2';

const DEFAULT_SAVE: CosmeticSaveData = {
  gems: 30, // Starter gems so players feel close to first unlock
  unlockedThemes: ['cyber'],
  selectedTheme: 'cyber',
  unlockedSkins: ['slate'],
  selectedSkin: 'slate',
  highestUnlockedLevel: 1,
};

export function loadCosmeticSave(): CosmeticSaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const parsed = JSON.parse(raw) as Partial<CosmeticSaveData>;
    return {
      gems: typeof parsed.gems === 'number' ? parsed.gems : DEFAULT_SAVE.gems,
      unlockedThemes: Array.isArray(parsed.unlockedThemes) && parsed.unlockedThemes.length > 0
        ? parsed.unlockedThemes
        : ['cyber'],
      selectedTheme: parsed.selectedTheme && BLOCK_THEMES[parsed.selectedTheme] ? parsed.selectedTheme : 'cyber',
      unlockedSkins: Array.isArray(parsed.unlockedSkins) && parsed.unlockedSkins.length > 0
        ? parsed.unlockedSkins
        : ['slate'],
      selectedSkin: parsed.selectedSkin && PEDESTAL_SKINS[parsed.selectedSkin] ? parsed.selectedSkin : 'slate',
      highestUnlockedLevel: typeof parsed.highestUnlockedLevel === 'number' ? Math.max(1, parsed.highestUnlockedLevel) : 1,
    };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function saveCosmeticData(data: CosmeticSaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}
