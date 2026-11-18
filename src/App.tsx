/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { buildBlockArchetype } from './game/blocks';
import { loadCosmeticSave } from './game/cosmetics';
import { OrbitStackEngine } from './game/OrbitStackEngine';
import { CosmeticSaveData, HudSnapshot } from './game/types';
import { GameHud } from './components/GameHud';

const INITIAL_COSMETICS = loadCosmeticSave();

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  mode: 'campaign',
  level: INITIAL_COSMETICS.highestUnlockedLevel,
  levelName: 'First Orbit',
  levelSubtitle: '',
  isChallenge: false,
  targetHeightMeters: 10,
  blocksRemaining: null,
  activeEnvModifiers: [],
  score: 0,
  bestScore: 0,
  heightMeters: 0,
  bestHeightMeters: 0,
  blocksStacked: 0,
  blocksDropped: 0,
  integrity: 3,
  maxIntegrity: 3,
  freezeProgress: 0,
  freezeInterval: 10,
  freezePulsesTriggered: 0,
  nextBlock: buildBlockArchetype('cube', 'standard', INITIAL_COSMETICS.selectedTheme),
  upcomingBlock: buildBlockArchetype('pillar', 'standard', INITIAL_COSMETICS.selectedTheme),
  settlingCount: 0,
  settlingProgress: 0,
  pedestalTiltDeg: 0,
  comboCount: 0,
  perfectStreak: 0,
  scoreMultiplier: 1,
  precisionSurgeLeft: 0,
  gems: INITIAL_COSMETICS.gems,
  lastGemsEarned: 0,
  windX: 0,
  windZ: 0,
  autoDropRemaining: null,
  lastEventBanner: null,
  muted: false,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<OrbitStackEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [cosmetics, setCosmetics] = useState<CosmeticSaveData>(INITIAL_COSMETICS);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new OrbitStackEngine(
      mount,
      (snapshot) => setHud(snapshot),
      (save) => setCosmetics(save)
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#060a14]">
      {/* Isolated WebGL mount container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
      />

      {/* World-matched, low-occlusion HUD overlay */}
      <GameHud
        hud={hud}
        cosmetics={cosmetics}
        onStartLevel={(lvl) => engineRef.current?.startCampaignLevel(lvl)}
        onStartEndless={() => engineRef.current?.startEndlessMode()}
        onRestart={() => engineRef.current?.restartCurrentRun()}
        onTogglePause={() => engineRef.current?.togglePause()}
        onReturnTitle={() => engineRef.current?.returnToTitle()}
        onToggleMute={() => engineRef.current?.setMuted(!hud.muted)}
        onRotateBlock={() => engineRef.current?.rotatePreviewBlock()}
        onResetCamera={() => engineRef.current?.resetCameraView()}
        onSelectTheme={(id) => engineRef.current?.selectOrPurchaseTheme(id)}
        onSelectSkin={(id) => engineRef.current?.selectOrPurchaseSkin(id)}
      />
    </main>
  );
}
