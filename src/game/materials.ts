import * as THREE from 'three';

export interface ProceduralTexturePack {
  deckMap: THREE.CanvasTexture;
  deckRoughnessMap: THREE.CanvasTexture;
  shadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

/**
 * Generates crisp, zero-404 procedural CanvasTextures for the orbital landing deck,
 * brushed surface roughness, and soft contact shadow halo.
 */
export function createProceduralTextures(maxAnisotropy: number): ProceduralTexturePack {
  // 1. Orbital Landing Deck Albedo (SRGBColorSpace)
  const deckCanvas = document.createElement('canvas');
  deckCanvas.width = 512;
  deckCanvas.height = 512;
  const ctx = deckCanvas.getContext('2d')!;

  // Slate-indigo metallic base
  const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 260);
  grad.addColorStop(0, '#222c42');
  grad.addColorStop(0.65, '#182032');
  grad.addColorStop(1, '#101624');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle concentric precision target rings
  ctx.strokeStyle = 'rgba(110, 224, 255, 0.24)';
  ctx.lineWidth = 2;
  for (const r of [64, 128, 192, 232]) {
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Crosshair axis ticks
  ctx.strokeStyle = 'rgba(148, 197, 255, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(256, 24);
  ctx.lineTo(256, 488);
  ctx.moveTo(24, 256);
  ctx.lineTo(488, 256);
  ctx.stroke();

  // Outer degree ticks
  ctx.strokeStyle = 'rgba(110, 224, 255, 0.42)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r0 = i % 6 === 0 ? 214 : 224;
    const r1 = 236;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0);
    ctx.lineTo(256 + Math.cos(a) * r1, 256 + Math.sin(a) * r1);
    ctx.stroke();
  }

  const deckMap = new THREE.CanvasTexture(deckCanvas);
  deckMap.colorSpace = THREE.SRGBColorSpace;
  deckMap.anisotropy = maxAnisotropy;

  // 2. Brushed Metallic Roughness Map (Linear / NoColorSpace)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 256;
  roughCanvas.height = 256;
  const rctx = roughCanvas.getContext('2d')!;
  rctx.fillStyle = '#888888';
  rctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 64; i++) {
    const shade = 105 + Math.floor(Math.random() * 55);
    rctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
    rctx.lineWidth = 2;
    rctx.beginPath();
    rctx.arc(128, 128, 8 + i * 2, 0, Math.PI * 2);
    rctx.stroke();
  }
  const deckRoughnessMap = new THREE.CanvasTexture(roughCanvas);
  deckRoughnessMap.anisotropy = maxAnisotropy;

  // 3. Soft Radial Contact / Drop Glow Texture
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sctx = shadowCanvas.getContext('2d')!;
  const sgrad = sctx.createRadialGradient(128, 128, 12, 128, 128, 124);
  sgrad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  sgrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.3)');
  sgrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sctx.fillStyle = sgrad;
  sctx.fillRect(0, 0, 256, 256);
  const shadowMap = new THREE.CanvasTexture(shadowCanvas);

  return {
    deckMap,
    deckRoughnessMap,
    shadowMap,
    dispose: () => {
      deckMap.dispose();
      deckRoughnessMap.dispose();
      shadowMap.dispose();
    },
  };
}
