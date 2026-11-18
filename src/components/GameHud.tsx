import React, { useState } from 'react';
import {
  Pause,
  Play,
  RotateCw,
  RotateCcw,
  Volume2,
  VolumeX,
  Compass,
  ChevronDown,
  ChevronUp,
  Gem,
  Wind,
  Timer,
  Flame,
  Sparkles,
  Layers,
  Infinity as InfinityIcon,
  ArrowRight,
} from 'lucide-react';
import { CosmeticSaveData, HudSnapshot, PedestalSkinId, ThemeId } from '../game/types';
import { ShopModal } from './ShopModal';

interface GameHudProps {
  hud: HudSnapshot;
  cosmetics: CosmeticSaveData;
  onStartLevel: (level: number) => void;
  onStartEndless: () => void;
  onRestart: () => void;
  onTogglePause: () => void;
  onReturnTitle: () => void;
  onToggleMute: () => void;
  onRotateBlock: () => void;
  onResetCamera: () => void;
  onSelectTheme: (id: ThemeId) => void;
  onSelectSkin: (id: PedestalSkinId) => void;
}

function ShapeGlyph({ kind, color }: { kind: string; color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {kind === 'cube' && (
        <path
          d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z"
          stroke={color}
          strokeWidth="2"
          fill={color}
          fillOpacity="0.22"
        />
      )}
      {kind === 'slab' && (
        <rect
          x="3"
          y="8"
          width="18"
          height="8"
          rx="1.5"
          stroke={color}
          strokeWidth="2"
          fill={color}
          fillOpacity="0.22"
        />
      )}
      {kind === 'pillar' && (
        <rect
          x="8"
          y="3"
          width="8"
          height="18"
          rx="2"
          stroke={color}
          strokeWidth="2"
          fill={color}
          fillOpacity="0.22"
        />
      )}
      {kind === 'wedge' && (
        <path
          d="M9 5H15L20 19H4L9 5Z"
          stroke={color}
          strokeWidth="2"
          fill={color}
          fillOpacity="0.22"
        />
      )}
      {kind === 'orb' && (
        <>
          <circle
            cx="12"
            cy="12"
            r="8"
            stroke={color}
            strokeWidth="2"
            fill={color}
            fillOpacity="0.22"
          />
          <ellipse cx="12" cy="12" rx="8" ry="3" stroke={color} strokeWidth="1.5" />
        </>
      )}
    </svg>
  );
}

function OrbitTitleLockup() {
  return (
    <svg
      viewBox="0 0 460 118"
      className="w-[320px] sm:w-[440px] h-auto select-none"
      role="img"
      aria-label="Orbit Stack"
    >
      <defs>
        <linearGradient id="orbitTitleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="60%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <ellipse
        cx="46"
        cy="62"
        rx="34"
        ry="12"
        transform="rotate(-18 46 62)"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2.2"
        strokeOpacity="0.85"
      />
      <rect x="33" y="47" width="26" height="14" rx="2" fill="#0f172a" stroke="#7dd3fc" strokeWidth="2" />
      <rect x="37" y="33" width="18" height="12" rx="2" fill="#3b82f6" fillOpacity="0.35" stroke="#93c5fd" strokeWidth="1.8" />
      <polygon points="46,18 54,30 38,30" fill="#f59e0b" fillOpacity="0.45" stroke="#fde68a" strokeWidth="1.8" />

      <text
        x="98"
        y="62"
        fill="url(#orbitTitleGrad)"
        fontSize="50"
        fontWeight="800"
        letterSpacing="4"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        ORBIT
      </text>
      <text
        x="101"
        y="99"
        fill="#94a3b8"
        fontSize="25"
        fontWeight="700"
        letterSpacing="12"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        STACK
      </text>
    </svg>
  );
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  cosmetics,
  onStartLevel,
  onStartEndless,
  onRestart,
  onTogglePause,
  onReturnTitle,
  onToggleMute,
  onRotateBlock,
  onResetCamera,
  onSelectTheme,
  onSelectSkin,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [shopTab, setShopTab] = useState<'themes' | 'levels' | null>(null);

  // TITLE SCREEN
  if (hud.phase === 'title') {
    return (
      <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-6 sm:p-10 z-10">
        {/* Top bar: Best Records, Gems, Mute */}
        <div className="flex items-start justify-between gap-3">
          <div
            className="pointer-events-auto flex flex-wrap items-center gap-3 px-3.5 py-2 rounded-lg border border-sky-400/20 text-xs tracking-wider uppercase text-slate-300"
            style={{ backgroundColor: 'rgba(10, 16, 32, 0.86)' }}
          >
            <div>
              <span className="text-slate-400 mr-1.5">Best</span>
              <span className="font-semibold text-sky-300 tabular-nums">
                {hud.bestHeightMeters.toFixed(1)}m
              </span>
            </div>
            <span className="text-slate-600">|</span>
            <div>
              <span className="text-slate-400 mr-1.5">Score</span>
              <span className="font-semibold text-slate-100 tabular-nums">
                {hud.bestScore.toLocaleString()}
              </span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="inline-flex items-center gap-1 text-amber-300 font-bold tabular-nums">
              <Gem className="w-3.5 h-3.5" />
              {cosmetics.gems.toLocaleString()}
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={hud.muted ? 'Unmute audio' : 'Mute audio'}
            className="pointer-events-auto p-2.5 rounded-lg border border-slate-700/80 text-slate-200 hover:border-sky-400/60 hover:text-sky-300 transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(10, 16, 32, 0.86)' }}
          >
            {hud.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Left Title Lockup over calm negative space */}
        <div className="my-auto max-w-md pointer-events-none">
          <OrbitTitleLockup />
          <p className="mt-3 text-sm sm:text-base text-slate-300/90 leading-relaxed max-w-sm">
            Reach the orbital sky gate across 50 escalating sectors or push endless heights. Chain dead-center drops for 5x multipliers and unlock cosmic themes.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 pointer-events-auto">
            <button
              type="button"
              onClick={() => onStartLevel(cosmetics.highestUnlockedLevel)}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-bold text-sm tracking-wider uppercase shadow-lg shadow-sky-500/20 transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              Play Level {cosmetics.highestUnlockedLevel}
            </button>

            <button
              type="button"
              onClick={onStartEndless}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-lg border border-slate-700 hover:border-sky-400/60 text-slate-200 hover:text-sky-300 font-semibold text-sm transition-colors cursor-pointer"
              style={{ backgroundColor: 'rgba(10, 16, 32, 0.86)' }}
            >
              <InfinityIcon className="w-4 h-4" />
              Endless
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => setShopTab('levels')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-600 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              style={{ backgroundColor: 'rgba(10, 16, 32, 0.82)' }}
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Sector Map (1–50)
            </button>
            <button
              type="button"
              onClick={() => setShopTab('themes')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-600 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              style={{ backgroundColor: 'rgba(10, 16, 32, 0.82)' }}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Themes &amp; Skins
            </button>
          </div>
        </div>

        <div className="text-center text-xs tracking-wide text-slate-400/90">
          Mouse Aim · Click / Space Drop · R Rotate · Q/E or Right-Drag Orbit · Esc Pause
        </div>

        {shopTab && (
          <ShopModal
            save={cosmetics}
            initialTab={shopTab}
            onClose={() => setShopTab(null)}
            onSelectTheme={onSelectTheme}
            onSelectSkin={onSelectSkin}
            onSelectLevel={onStartLevel}
          />
        )}
      </div>
    );
  }

  // ACTIVE GAMEPLAY / PAUSE / LEVEL COMPLETE / GAME OVER HUD
  const freezeRemaining = hud.freezeInterval - hud.freezeProgress;
  const windMag = Math.hypot(hud.windX, hud.windZ);

  return (
    <div className="fixed inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 sm:p-5">
      {/* Top Perimeter Status Clusters */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div
            className="pointer-events-auto flex flex-wrap items-center gap-4 sm:gap-5 px-4 py-2.5 rounded-xl border border-slate-700/75"
            style={{ backgroundColor: 'rgba(10, 16, 32, 0.86)' }}
          >
            {hud.mode === 'campaign' && (
              <>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">
                    {hud.isChallenge ? 'Challenge' : `Level ${hud.level}`}
                  </div>
                  <div className="text-sm font-bold text-slate-100 leading-tight">
                    {hud.levelName}
                  </div>
                </div>
                <div className="h-7 w-px bg-slate-700/70" />
              </>
            )}

            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">
                {hud.targetHeightMeters ? 'Height / Goal' : 'Height'}
              </div>
              <div className="text-lg sm:text-xl font-bold text-sky-300 tabular-nums leading-tight">
                {hud.heightMeters.toFixed(1)}m
                {hud.targetHeightMeters !== null && (
                  <span className="text-xs font-semibold text-emerald-300 ml-1.5">
                    / {hud.targetHeightMeters}m
                  </span>
                )}
              </div>
            </div>

            <div className="h-7 w-px bg-slate-700/70" />

            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Score</div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-bold text-slate-100 tabular-nums leading-tight">
                  {hud.score.toLocaleString()}
                </span>
                {hud.scoreMultiplier > 1 && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-extrabold text-amber-300 tabular-nums">
                    <Flame className="w-3 h-3" />
                    {hud.scoreMultiplier}x
                  </span>
                )}
              </div>
            </div>

            {hud.blocksRemaining !== null && (
              <>
                <div className="h-7 w-px bg-slate-700/70" />
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">Blocks Left</div>
                  <div
                    className={`text-lg font-bold tabular-nums leading-tight ${
                      hud.blocksRemaining <= 4 ? 'text-rose-400' : 'text-slate-100'
                    }`}
                  >
                    {hud.blocksRemaining}
                  </div>
                </div>
              </>
            )}

            <div className="h-7 w-px bg-slate-700/70 hidden md:block" />

            <div className="hidden md:block">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Freeze Pulse</div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-16 h-1.5 rounded-sm bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-200"
                    style={{ width: `${(hud.freezeProgress / hud.freezeInterval) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-cyan-300 tabular-nums">
                  {hud.freezeProgress}/{hud.freezeInterval}
                </span>
              </div>
            </div>

            <div className="h-7 w-px bg-slate-700/70" />

            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Integrity</div>
              <div className="flex items-center gap-1.5 mt-1" aria-label={`Integrity ${hud.integrity} of ${hud.maxIntegrity}`}>
                {Array.from({ length: hud.maxIntegrity }).map((_, idx) => {
                  const active = idx < hud.integrity;
                  return (
                    <svg key={idx} width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
                      <polygon
                        points="7,1 13,7 7,13 1,7"
                        fill={active ? '#38bdf8' : 'rgba(51, 65, 85, 0.5)'}
                        stroke={active ? '#bae6fd' : '#475569'}
                        strokeWidth="1.2"
                      />
                    </svg>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Active Environmental Hazards Sub-strip (only shown when relevant) */}
          {(windMag > 0.3 || hud.autoDropRemaining !== null || hud.precisionSurgeLeft > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {windMag > 0.3 && (
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-sky-400/35 text-xs font-semibold text-sky-200 tabular-nums"
                  style={{ backgroundColor: 'rgba(10, 16, 32, 0.86)' }}
                >
                  <Wind className="w-3.5 h-3.5 text-sky-400" />
                  Gust {hud.windX >= 0 ? '→' : '←'} {windMag.toFixed(1)}
                </div>
              )}
              {hud.autoDropRemaining !== null && (
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold tabular-nums ${
                    hud.autoDropRemaining <= 1.5
                      ? 'border-rose-400/60 text-rose-300'
                      : 'border-amber-400/35 text-amber-200'
                  }`}
                  style={{ backgroundColor: 'rgba(10, 16, 32, 0.86)' }}
                >
                  <Timer className="w-3.5 h-3.5" />
                  Auto-Drop {hud.autoDropRemaining.toFixed(1)}s
                </div>
              )}
              {hud.precisionSurgeLeft > 0 && (
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-amber-400/50 text-xs font-bold text-amber-300 tabular-nums"
                  style={{ backgroundColor: 'rgba(10, 16, 32, 0.86)' }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Surge Active ({hud.precisionSurgeLeft})
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top-Right Compact Utility Buttons + Gems */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-400/25 text-amber-300 text-xs font-bold tabular-nums"
            style={{ backgroundColor: 'rgba(10, 16, 32, 0.86)' }}
          >
            <Gem className="w-3.5 h-3.5" />
            {hud.gems.toLocaleString()}
          </div>
          <button
            type="button"
            onClick={onResetCamera}
            title="Reset camera angle"
            aria-label="Reset camera angle"
            className="p-2.5 rounded-lg border border-slate-700/75 text-slate-300 hover:border-sky-400/60 hover:text-sky-300 transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(10, 16, 32, 0.86)' }}
          >
            <Compass className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            title={hud.muted ? 'Unmute audio' : 'Mute audio'}
            aria-label={hud.muted ? 'Unmute audio' : 'Mute audio'}
            className="p-2.5 rounded-lg border border-slate-700/75 text-slate-300 hover:border-sky-400/60 hover:text-sky-300 transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(10, 16, 32, 0.86)' }}
          >
            {hud.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onTogglePause}
            title="Pause (Esc)"
            aria-label="Pause game"
            className="p-2.5 rounded-lg border border-slate-700/75 text-slate-300 hover:border-sky-400/60 hover:text-sky-300 transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(10, 16, 32, 0.86)' }}
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transient Event Banner */}
      {hud.lastEventBanner && hud.phase === 'playing' && (
        <div className="mx-auto my-auto pointer-events-none -translate-y-24">
          <div
            className="px-4 py-1.5 rounded-lg border border-cyan-400/40 text-xs font-bold tracking-[0.18em] uppercase text-cyan-200"
            style={{ backgroundColor: 'rgba(8, 22, 42, 0.9)' }}
          >
            {hud.lastEventBanner}
          </div>
        </div>
      )}

      {/* Collapsible Bottom Control & Queue Dock */}
      {hud.phase === 'playing' && (
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="pointer-events-auto inline-flex items-center gap-1 px-3 py-1 rounded-t-lg border border-b-0 border-slate-700/75 text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-200 cursor-pointer"
            style={{ backgroundColor: 'rgba(10, 16, 32, 0.88)' }}
          >
            {dockCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {dockCollapsed ? 'Show Dock' : 'Hide Dock'}
          </button>

          {!dockCollapsed && (
            <div
              className="pointer-events-auto flex flex-wrap items-center justify-center gap-4 px-4 py-2.5 rounded-xl border border-slate-700/75 max-w-[94vw]"
              style={{ backgroundColor: 'rgba(10, 16, 32, 0.88)' }}
            >
              <div className="flex items-center gap-2.5">
                <ShapeGlyph kind={hud.nextBlock.kind} color={hud.nextBlock.accentColorCss} />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Dropping</div>
                  <div className="text-xs font-semibold text-slate-100">
                    {hud.nextBlock.label}{' '}
                    <span className="text-slate-400 font-normal">({hud.nextBlock.weightLabel})</span>
                  </div>
                </div>
              </div>

              <div className="h-6 w-px bg-slate-700/70" />

              <div className="flex items-center gap-2 opacity-85">
                <ShapeGlyph kind={hud.upcomingBlock.kind} color={hud.upcomingBlock.accentColorCss} />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Next</div>
                  <div className="text-xs font-medium text-slate-300">{hud.upcomingBlock.label}</div>
                </div>
              </div>

              <div className="h-6 w-px bg-slate-700/70" />

              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  {hud.settlingCount > 0 ? `Stabilizing (${hud.settlingCount})` : `Freeze in ${freezeRemaining}`}
                </div>
                <div className="w-24 h-1.5 mt-1 rounded-sm bg-slate-800 overflow-hidden">
                  <div
                    className="h-full transition-all duration-100"
                    style={{
                      width: `${
                        hud.settlingCount > 0
                          ? hud.settlingProgress * 100
                          : (hud.freezeProgress / hud.freezeInterval) * 100
                      }%`,
                      backgroundColor: hud.settlingCount > 0 ? '#34d399' : '#38bdf8',
                    }}
                  />
                </div>
              </div>

              <div className="h-6 w-px bg-slate-700/70" />

              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-300 tabular-nums">
                  <span className="text-slate-400 mr-1">Tilt</span>
                  <span className={hud.pedestalTiltDeg > 9.5 ? 'text-rose-400 font-semibold' : 'text-slate-200'}>
                    {hud.pedestalTiltDeg.toFixed(1)}°
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onRotateBlock}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-600/80 hover:border-sky-400/70 text-xs font-medium text-slate-200 hover:text-sky-300 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Rotate (R)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PAUSE MODAL */}
      {hud.phase === 'paused' && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-auto z-20" style={{ backgroundColor: 'rgba(6, 10, 20, 0.72)' }}>
          <div
            className="w-full max-w-sm mx-4 p-6 rounded-2xl border border-slate-700/80 shadow-2xl"
            style={{ backgroundColor: 'rgba(12, 19, 36, 0.96)' }}
          >
            <div className="text-xs uppercase tracking-[0.2em] text-sky-400 font-semibold">Simulation Paused</div>
            <h2 className="mt-1 text-2xl font-bold text-slate-100">
              {hud.mode === 'campaign' ? `Level ${hud.level}: ${hud.levelName}` : 'Endless Orbit'}
            </h2>
            <p className="mt-2 text-xs text-slate-400">{hud.levelSubtitle}</p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onTogglePause}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm tracking-wide uppercase cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Resume
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-200 font-semibold text-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Restart Stage
              </button>
              <button
                type="button"
                onClick={onReturnTitle}
                className="w-full px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Return to Title
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEVEL COMPLETE MODAL */}
      {hud.phase === 'level_complete' && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-auto z-20" style={{ backgroundColor: 'rgba(6, 10, 20, 0.74)' }}>
          <div
            className="w-full max-w-md mx-4 p-6 sm:p-7 rounded-2xl border border-emerald-400/45 shadow-2xl"
            style={{ backgroundColor: 'rgba(12, 19, 36, 0.96)' }}
          >
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-400 font-semibold">
              Sector {hud.level} Cleared
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-100">{hud.levelName}</h2>

            <div className="mt-5 grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/70">
                <div className="text-[10px] uppercase tracking-widest text-slate-400">Height</div>
                <div className="mt-0.5 text-lg font-bold text-sky-300 tabular-nums">{hud.heightMeters.toFixed(1)}m</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/70">
                <div className="text-[10px] uppercase tracking-widest text-slate-400">Score</div>
                <div className="mt-0.5 text-lg font-bold text-slate-100 tabular-nums">{hud.score.toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
                <div className="text-[10px] uppercase tracking-widest text-amber-300">Gems</div>
                <div className="mt-0.5 text-lg font-bold text-amber-200 tabular-nums">+{hud.lastGemsEarned}</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => onStartLevel(hud.level + 1)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-sm tracking-wide uppercase cursor-pointer"
              >
                Next Level ({hud.level + 1})
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShopTab('themes')}
                className="px-4 py-3 rounded-lg border border-slate-700 hover:border-amber-400/60 text-amber-300 font-semibold text-sm cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                Shop
              </button>
              <button
                type="button"
                onClick={onReturnTitle}
                className="px-4 py-3 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-300 font-semibold text-sm cursor-pointer"
              >
                Title
              </button>
            </div>
          </div>

          {shopTab && (
            <ShopModal
              save={cosmetics}
              initialTab={shopTab}
              onClose={() => setShopTab(null)}
              onSelectTheme={onSelectTheme}
              onSelectSkin={onSelectSkin}
              onSelectLevel={onStartLevel}
            />
          )}
        </div>
      )}

      {/* GAME OVER MODAL */}
      {hud.phase === 'gameover' && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-auto z-20" style={{ backgroundColor: 'rgba(6, 10, 20, 0.76)' }}>
          <div
            className="w-full max-w-md mx-4 p-6 sm:p-7 rounded-2xl border border-rose-500/35 shadow-2xl"
            style={{ backgroundColor: 'rgba(12, 19, 36, 0.96)' }}
          >
            <div className="text-xs uppercase tracking-[0.2em] text-rose-400 font-semibold">
              {hud.lastEventBanner || 'Tower Toppled'}
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-100">Run Complete</h2>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/70">
                <div className="text-[10px] uppercase tracking-widest text-slate-400">Final Height</div>
                <div className="mt-0.5 text-xl font-bold text-sky-300 tabular-nums">{hud.heightMeters.toFixed(1)}m</div>
                <div className="text-[11px] text-slate-500 tabular-nums">Best {hud.bestHeightMeters.toFixed(1)}m</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/70">
                <div className="text-[10px] uppercase tracking-widest text-slate-400">Score</div>
                <div className="mt-0.5 text-xl font-bold text-slate-100 tabular-nums">{hud.score.toLocaleString()}</div>
                <div className="text-[11px] text-slate-500 tabular-nums">Best {hud.bestScore.toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/70">
                <div className="text-[10px] uppercase tracking-widest text-slate-400">Blocks Stacked</div>
                <div className="mt-0.5 text-lg font-bold text-emerald-300 tabular-nums">{hud.blocksStacked}</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/70">
                <div className="text-[10px] uppercase tracking-widest text-slate-400">Gems Earned</div>
                <div className="mt-0.5 text-lg font-bold text-amber-300 tabular-nums">+{hud.lastGemsEarned}</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={onRestart}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm tracking-wide uppercase cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
              <button
                type="button"
                onClick={onReturnTitle}
                className="px-4 py-3 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-300 font-semibold text-sm cursor-pointer"
              >
                Title
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
