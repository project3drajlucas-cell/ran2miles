import React, { useState } from 'react';
import { Check, Gem, Lock, X, Layers, Shield, Sparkles } from 'lucide-react';
import { BLOCK_THEMES, PEDESTAL_SKINS } from '../game/cosmetics';
import { getLevelConfig } from '../game/levels';
import { CosmeticSaveData, PedestalSkinId, ThemeId } from '../game/types';

interface ShopModalProps {
  save: CosmeticSaveData;
  initialTab: 'themes' | 'levels';
  onClose: () => void;
  onSelectTheme: (id: ThemeId) => void;
  onSelectSkin: (id: PedestalSkinId) => void;
  onSelectLevel: (level: number) => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  save,
  initialTab,
  onClose,
  onSelectTheme,
  onSelectSkin,
  onSelectLevel,
}) => {
  const [tab, setTab] = useState<'themes' | 'levels'>(initialTab);
  const themeList = Object.values(BLOCK_THEMES);
  const skinList = Object.values(PEDESTAL_SKINS);
  const levels = Array.from({ length: 50 }, (_, idx) => getLevelConfig(idx + 1));

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(6, 10, 20, 0.82)' }}
    >
      <div
        className="w-full max-w-2xl max-h-[86vh] flex flex-col rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'rgba(11, 18, 34, 0.98)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTab('themes')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                tab === 'themes'
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200 border border-slate-700/80'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Cosmetics
            </button>
            <button
              type="button"
              onClick={() => setTab('levels')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                tab === 'levels'
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200 border border-slate-700/80'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Sector Map (1–50)
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-300 text-xs font-bold tabular-nums">
              <Gem className="w-3.5 h-3.5" />
              {save.gems.toLocaleString()}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {tab === 'themes' ? (
            <>
              <div>
                <h3 className="text-xs uppercase tracking-[0.18em] text-slate-400 font-semibold mb-3">
                  Block Themes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {themeList.map((theme) => {
                    const unlocked = save.unlockedThemes.includes(theme.id);
                    const selected = save.selectedTheme === theme.id;
                    const canAfford = save.gems >= theme.costGems;
                    const swatches = [
                      theme.palette.cube.css,
                      theme.palette.slab.css,
                      theme.palette.pillar.css,
                      theme.palette.wedge.css,
                      theme.palette.orb.css,
                    ];
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => onSelectTheme(theme.id)}
                        disabled={!unlocked && !canAfford}
                        className={`text-left p-4 rounded-xl border transition-colors cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${
                          selected
                            ? 'border-sky-400 bg-sky-500/10'
                            : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-100">{theme.name}</span>
                          {selected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-300">
                              <Check className="w-3.5 h-3.5" /> Equipped
                            </span>
                          ) : unlocked ? (
                            <span className="text-[11px] text-slate-400">Unlocked</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 tabular-nums">
                              <Gem className="w-3 h-3" /> {theme.costGems}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{theme.description}</p>
                        <div className="mt-3 flex items-center gap-1.5">
                          {swatches.map((hex, i) => (
                            <span
                              key={i}
                              className="w-4 h-4 rounded-sm border border-white/20"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-[0.18em] text-slate-400 font-semibold mb-3 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  Pedestal Skins
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {skinList.map((skin) => {
                    const unlocked = save.unlockedSkins.includes(skin.id);
                    const selected = save.selectedSkin === skin.id;
                    const canAfford = save.gems >= skin.costGems;
                    return (
                      <button
                        key={skin.id}
                        type="button"
                        onClick={() => onSelectSkin(skin.id)}
                        disabled={!unlocked && !canAfford}
                        className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${
                          selected
                            ? 'border-sky-400 bg-sky-500/10'
                            : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-slate-100">{skin.name}</span>
                          {selected ? (
                            <Check className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                          ) : !unlocked ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 tabular-nums shrink-0">
                              <Gem className="w-3 h-3" /> {skin.costGems}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">{skin.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-[0.18em] text-slate-400 font-semibold">
                  Select Orbital Stage
                </h3>
                <span className="text-xs text-slate-400 tabular-nums">
                  Unlocked up to Level {save.highestUnlockedLevel}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {levels.map((lvl) => {
                  const unlocked = lvl.level <= save.highestUnlockedLevel;
                  return (
                    <button
                      key={lvl.level}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => {
                        onSelectLevel(lvl.level);
                        onClose();
                      }}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                        lvl.isChallenge
                          ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-400'
                          : 'border-slate-800 bg-slate-900/70 hover:border-sky-400/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-100 tabular-nums">
                          LVL {lvl.level}
                        </span>
                        {!unlocked && <Lock className="w-3 h-3 text-slate-500" />}
                      </div>
                      <div className="mt-1 text-[11px] text-sky-300 font-semibold tabular-nums">
                        {lvl.targetHeight}m
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400 truncate">
                        {lvl.isChallenge ? 'Challenge' : lvl.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
