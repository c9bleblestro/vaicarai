import { createCanvas, loadImage, GlobalFonts, GifEncoder } from '@napi-rs/canvas';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { drawAvatarRing } from './shopData.js';
import {timeLeft,dailyMilestones,workProgressValue} from './economyProgress.js';

const __ecoFilename = fileURLToPath(import.meta.url);
const __ecoDir      = dirname(__ecoFilename);
const _bjDir   = join(__ecoDir, '../assets');
const _ecoDir  = join(__ecoDir, '../../assets');
const _fontsDir = join(__ecoDir, '../../fonts');
const _rankingBackgroundPath = join(_ecoDir, 'ranking-background.jpg');
const _rankingTemplatePath = join(_ecoDir, 'ranking-card-template.png');
const _walletTemplatePath = join(_ecoDir, 'wallet-card-template.png');
const _blackjackDesignPath = join(_bjDir, 'blackjack-design.png');

GlobalFonts.register(readFileSync(join(_fontsDir, 'Roboto-Regular.ttf')), 'BotFont');
GlobalFonts.register(readFileSync(join(_fontsDir, 'Roboto-Bold.ttf')),    'BotFont');

const FONT = 'BotFont';

function fmt(n) { return Number(n).toLocaleString('pt-BR'); }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Sparkle / star decoration ────────────────────────────────────────────────

function drawSparkle(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(x, y);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.ellipse(0, size * 0.5, size * 0.12, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── Angel feather ────────────────────────────────────────────────────────────
function drawFeather(ctx, x, y, dir, alpha = 0.18) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const quillLen = 80;
  const barbs    = 12;
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth   = 1;
  // Central quill
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dir * 14, y + quillLen);
  ctx.stroke();
  for (let i = 1; i <= barbs; i++) {
    const t  = i / barbs;
    const qx = x + dir * 14 * t;
    const qy = y + quillLen * t;
    const sp = 6 + t * 22;
    // Leading barb
    ctx.beginPath();
    ctx.moveTo(qx, qy);
    ctx.quadraticCurveTo(qx + dir * sp * 0.7, qy - 4, qx + dir * sp, qy + 4);
    ctx.stroke();
    // Trailing barb (shorter)
    ctx.beginPath();
    ctx.moveTo(qx, qy);
    ctx.quadraticCurveTo(qx - dir * sp * 0.3, qy - 3, qx - dir * sp * 0.45, qy + 3);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Divine light rays from top ───────────────────────────────────────────────
function drawDivineRays(ctx, W, H) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const cx = W / 2, cy = -30;
  const rays = 10;
  for (let i = 0; i < rays; i++) {
    const angle  = -Math.PI / 2 + (i - (rays - 1) / 2) * 0.19;
    const spread = 0.045;
    const grad   = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * H * 1.8, cy + Math.sin(angle) * H * 1.8);
    grad.addColorStop(0,   'rgba(200,185,255,0.18)');
    grad.addColorStop(0.5, 'rgba(160,130,230,0.06)');
    grad.addColorStop(1,   'rgba(100,80,200,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle - spread) * H * 2.2, cy + Math.sin(angle - spread) * H * 2.2);
    ctx.lineTo(cx + Math.cos(angle + spread) * H * 2.2, cy + Math.sin(angle + spread) * H * 2.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// ─── Tiny stars ───────────────────────────────────────────────────────────────
function drawStars(ctx, W, H) {
  const stars = [
    [55,28],[W-50,22],[80,H-30],[W-70,H-28],[W/2+160,18],[W/2-155,20],
    [W/2,15],[30,H/2-40],[W-30,H/2+20],[W/2+280,H-22],[W/2-260,H-18],
    [140,38],[W-140,35],[W/2+80,H-12],[W/2-90,H-14]
  ];
  for (const [sx, sy] of stars) {
    ctx.save();
    ctx.fillStyle = 'rgba(220,210,255,0.55)';
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── Playing card (clean realistic style matching reference) ─────────────────

// ─── Suit shape drawn with canvas paths (no Unicode dependency) ───────────────
function drawSuit(ctx, cx, cy, suit, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  if (suit === '♥') {
    const s = size * 0.52;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(cx - s * 1.5, cy, cx - s * 1.5, cy - s * 1.1, cx, cy - s * 0.3);
    ctx.bezierCurveTo(cx + s * 1.5, cy - s * 1.1, cx + s * 1.5, cy, cx, cy + s * 0.9);
    ctx.fill();
  } else if (suit === '♦') {
    const s = size * 0.55;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.65, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s * 0.65, cy);
    ctx.closePath();
    ctx.fill();
  } else if (suit === '♠') {
    const s = size * 0.48;
    // Inverted heart (top bulb)
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.4);
    ctx.bezierCurveTo(cx - s * 1.5, cy - s * 0.3, cx - s * 1.5, cy - s * 1.4, cx, cy - s * 0.6);
    ctx.bezierCurveTo(cx + s * 1.5, cy - s * 1.4, cx + s * 1.5, cy - s * 0.3, cx, cy + s * 0.4);
    ctx.fill();
    // Stem + base
    const stemW = s * 0.25, stemH = s * 0.65;
    ctx.fillRect(cx - stemW / 2, cy + s * 0.4, stemW, stemH);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.7, cy + s * 0.4 + stemH);
    ctx.lineTo(cx + s * 0.7, cy + s * 0.4 + stemH);
    ctx.lineTo(cx, cy + s * 0.4 + stemH - s * 0.2);
    ctx.closePath();
    ctx.fill();
  } else if (suit === '♣') {
    const r = size * 0.3;
    // Three circles
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.85, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - r * 0.9, cy + r * 0.3, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.9, cy + r * 0.3, r, 0, Math.PI * 2); ctx.fill();
    // Stem
    const sw = r * 0.38;
    ctx.fillRect(cx - sw / 2, cy + r * 0.6, sw, r * 0.85);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7, cy + r * 1.45);
    ctx.lineTo(cx + r * 0.7, cy + r * 1.45);
    ctx.lineTo(cx, cy + r * 1.1);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawCard(ctx, x, y, rank, suit, scale = 1) {
  const cw = Math.round(78 * scale), ch = Math.round(108 * scale), cr = Math.round(10 * scale);
  const isRed = suit === '♥' || suit === '♦';
  const col   = isRed ? '#CC2222' : '#111111';

  // Drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 4;

  // White card body
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, x, y, cw, ch, cr); ctx.fill();

  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

  // Border
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
  roundRect(ctx, x, y, cw, ch, cr); ctx.stroke();

  const fs = Math.round(15 * scale);

  // Top-left rank
  ctx.fillStyle = col;
  ctx.font = `bold ${fs}px ${FONT}`; ctx.textAlign = 'left';
  ctx.fillText(rank, x + Math.round(6 * scale), y + Math.round(18 * scale));
  // Top-left suit (small path)
  drawSuit(ctx, x + Math.round(10 * scale), y + Math.round(28 * scale), suit, Math.round(7 * scale), col);

  // Center large suit
  drawSuit(ctx, x + cw / 2, y + ch / 2, suit, Math.round(22 * scale), col);

  // Bottom-right (rotated 180°)
  ctx.save();
  ctx.translate(x + cw, y + ch);
  ctx.rotate(Math.PI);
  ctx.fillStyle = col;
  ctx.font = `bold ${fs}px ${FONT}`; ctx.textAlign = 'left';
  ctx.fillText(rank, Math.round(6 * scale), Math.round(18 * scale));
  drawSuit(ctx, Math.round(10 * scale), Math.round(28 * scale), suit, Math.round(7 * scale), col);
  ctx.restore();
}

// ─── Cute background helper ───────────────────────────────────────────────────

function drawCuteBg(ctx, W, H, colors) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, colors[0]);
  g.addColorStop(0.5, colors[1]);
  g.addColorStop(1, colors[2]);
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, W, H, 20);
  ctx.fill();

  // Polka dot decoration
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let dx = 20; dx < W; dx += 40) {
    for (let dy = 20; dy < H; dy += 40) {
      ctx.beginPath(); ctx.arc(dx, dy, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawCuteHeader(ctx, W, text, textColor, bgColor) {
  const g = ctx.createLinearGradient(0, 0, W, 52);
  g.addColorStop(0, bgColor);
  g.addColorStop(1, bgColor + 'bb');
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, W, 52, 20); ctx.fill();
  ctx.fillRect(0, 30, W, 22);

  ctx.fillStyle = textColor;
  ctx.font = `bold 17px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, 33);
}

function drawResultBanner(ctx, W, cy, text, bgFrom, bgTo, textColor) {
  const bw = 320, bh = 52, bx = W / 2 - bw / 2;
  const g = ctx.createLinearGradient(bx, cy, bx + bw, cy + bh);
  g.addColorStop(0, bgFrom);
  g.addColorStop(1, bgTo);
  ctx.fillStyle = g;
  roundRect(ctx, bx, cy, bw, bh, 26); ctx.fill();

  ctx.fillStyle = textColor;
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, cy + 33);
}

function drawFooterStats(ctx, W, H, line1, line2) {
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, 20, H - 50, W - 40, 34, 17); ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(line1, W / 2, H - 35);

  if (line2) {
    ctx.font = `11px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(line2, W / 2, H - 20);
  }
}

// ─── Short number formatter ───────────────────────────────────────────────────

function fmtShort(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'K';
  return fmt(n);
}

// ─── Card back (for active blackjack) ────────────────────────────────────────

function drawCardBack(ctx, x, y, scale = 1) {
  const cw = Math.round(70 * scale), ch = Math.round(98 * scale), cr = Math.round(10 * scale);
  ctx.shadowColor = 'rgba(100,50,180,0.4)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
  const g = ctx.createLinearGradient(x, y, x + cw, y + ch);
  g.addColorStop(0, '#5B2EA0'); g.addColorStop(1, '#3A1A6A');
  ctx.fillStyle = g;
  roundRect(ctx, x, y, cw, ch, cr); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(200,150,255,0.6)'; ctx.lineWidth = 1.5;
  roundRect(ctx, x + 5, y + 5, cw - 10, ch - 10, cr - 2); ctx.stroke();
  for (let dy = 14; dy < ch - 8; dy += 12) {
    for (let dx = 10; dx < cw - 4; dx += 12) {
      ctx.beginPath(); ctx.arc(x + dx, y + dy, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,150,255,0.2)'; ctx.fill();
    }
  }
}

// ─── Gem / Bomb icons for Mines (cute redesign) ──────────────────────────────

function drawGem(ctx, cx, cy, r) {
  ctx.save();
  // Glow aura
  const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.4);
  aura.addColorStop(0, 'rgba(103,232,249,0.45)');
  aura.addColorStop(1, 'rgba(103,232,249,0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2); ctx.fill();

  // Main diamond body
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  g.addColorStop(0, '#E0F9FF');
  g.addColorStop(0.3, '#67E8F9');
  g.addColorStop(0.7, '#22D3EE');
  g.addColorStop(1, '#0891B2');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx,           cy - r);
  ctx.lineTo(cx + r * 0.6, cy - r * 0.2);
  ctx.lineTo(cx + r * 0.8, cy + r * 0.2);
  ctx.lineTo(cx,           cy + r);
  ctx.lineTo(cx - r * 0.8, cy + r * 0.2);
  ctx.lineTo(cx - r * 0.6, cy - r * 0.2);
  ctx.closePath(); ctx.fill();

  // Inner facet lines
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy - r * 0.2); ctx.lineTo(cx + r * 0.6, cy - r * 0.2); ctx.stroke();

  // Top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.moveTo(cx,           cy - r);
  ctx.lineTo(cx + r * 0.6, cy - r * 0.2);
  ctx.lineTo(cx,           cy - r * 0.05);
  ctx.lineTo(cx - r * 0.6, cy - r * 0.2);
  ctx.closePath(); ctx.fill();

  // Sparkle dot
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(cx + r * 0.3, cy - r * 0.55, r * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBomb(ctx, cx, cy, r) {
  ctx.save();
  // Fuse stem
  ctx.strokeStyle = '#92400E'; ctx.lineWidth = r * 0.13; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.42, cy - r * 0.6);
  ctx.quadraticCurveTo(cx + r * 0.8, cy - r * 1.05, cx + r * 0.55, cy - r * 1.25);
  ctx.stroke();
  // Fuse spark
  ctx.fillStyle = '#FDE68A';
  ctx.shadowColor = '#F59E0B'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(cx + r * 0.55, cy - r * 1.25, r * 0.13, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(cx + 2, cy + r * 0.85, r * 0.68, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();

  // Body gradient
  const bg = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.2, r * 0.05, cx, cy + r * 0.1, r * 0.72);
  bg.addColorStop(0, '#374151');
  bg.addColorStop(0.6, '#1F2937');
  bg.addColorStop(1, '#111827');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.08, r * 0.72, 0, Math.PI * 2); ctx.fill();

  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.arc(cx - r * 0.24, cy - r * 0.12, r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ─── Mines result card (cute redesign) ───────────────────────────────────────

export function generateMinesCard({ grid, revealed, bombs, bet, payout, memberName, status }) {
  const GRID = 4, CELL = 90, GAP = 10;
  const GW  = GRID * CELL + (GRID - 1) * GAP;
  const PAD = 22;
  const W   = GW + PAD * 2;   // 426
  const H   = W + 100;        // header + footer
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── Background ──────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#052e16');
  bg.addColorStop(0.5, '#064e3b');
  bg.addColorStop(1, '#052e16');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 24); ctx.fill();

  // Radial centre glow
  const glow = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, W * 0.7);
  glow.addColorStop(0, 'rgba(52,211,153,0.12)');
  glow.addColorStop(1, 'rgba(52,211,153,0)');
  ctx.fillStyle = glow;
  roundRect(ctx, 0, 0, W, H, 24); ctx.fill();

  // Sparkles
  const sp = [[38,30],[W-38,28],[22,H-40],[W-24,H-38],[W/2-60,18],[W/2+55,22],[30,H/2],[W-28,H/2+10]];
  for (const [sx,sy] of sp) drawSparkle(ctx, sx, sy, 7, 'rgba(167,243,208,0.55)');

  // ── Header pill ─────────────────────────────────────────────────────────────
  const isLost   = status === 'lost';
  const hText    = isLost ? '💥  Você perdeu!' : '✅  Você ganhou!';
  const hColor   = isLost ? ['#991B1B','#7F1D1D'] : ['#065F46','#064E3B'];

  const hg = ctx.createLinearGradient(PAD, 14, PAD + GW, 58);
  hg.addColorStop(0, hColor[0]); hg.addColorStop(1, hColor[1]);
  ctx.fillStyle = hg;
  roundRect(ctx, PAD, 14, GW, 44, 22); ctx.fill();
  ctx.strokeStyle = isLost ? 'rgba(252,165,165,0.4)' : 'rgba(110,231,183,0.4)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, PAD, 14, GW, 44, 22); ctx.stroke();

  ctx.fillStyle = '#FFFFFF'; ctx.font = `bold 18px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(hText, W / 2, 42);

  // ── Grid wrapper ─────────────────────────────────────────────────────────────
  const gridY = 72;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, PAD - 7, gridY - 7, GW + 14, GW + 14, 20); ctx.fill();

  // Inner grid rim
  ctx.strokeStyle = 'rgba(52,211,153,0.2)'; ctx.lineWidth = 1.5;
  roundRect(ctx, PAD - 7, gridY - 7, GW + 14, GW + 14, 20); ctx.stroke();

  // ── Cells ────────────────────────────────────────────────────────────────────
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const idx  = row * GRID + col;
      const cx   = PAD + col * (CELL + GAP);
      const cy   = gridY + row * (CELL + GAP);
      const rev  = revealed[idx];
      const bomb = grid[idx];

      // Shadow beneath cell
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      roundRect(ctx, cx + 3, cy + 5, CELL, CELL, 18); ctx.fill();

      // Cell background
      const cg = ctx.createLinearGradient(cx, cy, cx, cy + CELL);
      if (rev && bomb) {
        cg.addColorStop(0, '#FCA5A5'); cg.addColorStop(1, '#F87171');
      } else if (rev) {
        cg.addColorStop(0, '#A7F3D0'); cg.addColorStop(1, '#6EE7B7');
      } else {
        cg.addColorStop(0, '#34D399'); cg.addColorStop(1, '#10B981');
      }
      ctx.fillStyle = cg;
      roundRect(ctx, cx, cy, CELL, CELL, 18); ctx.fill();

      // Top gloss
      const gloss = ctx.createLinearGradient(cx, cy, cx, cy + CELL * 0.45);
      gloss.addColorStop(0, 'rgba(255,255,255,0.28)');
      gloss.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gloss;
      roundRect(ctx, cx, cy, CELL, CELL * 0.45, 18); ctx.fill();

      // Border
      ctx.strokeStyle = rev && bomb
        ? 'rgba(239,68,68,0.5)'
        : rev
          ? 'rgba(52,211,153,0.5)'
          : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, cx, cy, CELL, CELL, 18); ctx.stroke();

      // Icon
      const iconX = cx + CELL / 2, iconY = cy + CELL / 2 + 2;
      if (rev && bomb) drawBomb(ctx, iconX, iconY, 26);
      else if (rev)    drawGem(ctx, iconX, iconY, 26);
    }
  }

  // ── Footer pill ──────────────────────────────────────────────────────────────
  const footerY = gridY + GW + 14;
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  roundRect(ctx, PAD, footerY, GW, 54, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  roundRect(ctx, PAD, footerY, GW, 54, 18); ctx.stroke();

  ctx.fillStyle = '#FFFFFF'; ctx.font = `bold 14px ${FONT}`; ctx.textAlign = 'center';
  const gainTxt = isLost ? '0' : fmtShort(payout);
  ctx.fillText(`Aposta: ${fmtShort(bet)}   •   Ganhos: ${gainTxt}`, W / 2, footerY + 22);
  ctx.fillStyle = 'rgba(167,243,208,0.7)'; ctx.font = `12px ${FONT}`;
  ctx.fillText(`💣 ${bombs} minas  •  ${memberName}`, W / 2, footerY + 41);

  return canvas.toBuffer('image/png');
}

// ─── Blackjack card ───────────────────────────────────────────────────────────
// The attached design is the fixed board. Only the cards and totals are redrawn
// on each action so the game keeps the user's visual layout throughout the hand.

import {scene as bjScene,table as bjTable,txt as bjText,box as bjBox,avatar as bjAvatar,cardBack as bjBack,png as bjPng,coins as bjCoins} from './gameArt.js';
export async function generateBlackjackCard({playerCards,dealerCards,pTotal,dTotal,hideDealer=false,status='playing',result=null,payout=0,bet=0,name='',avatar=null}){
 const [canvas,ctx]=bjScene();bjTable(ctx,'green');
 bjText(ctx,'Substancy',34,25,20,'#d3bd93');bjText(ctx,'BLACKJACK',34,65,40,'#f6e6ca');
 bjBox(ctx,895,23,270,65,12,'#171918','#aa8854');bjText(ctx,'Aposta',914,44,15,'#d8c5a3',false);bjText(ctx,bjCoins(bet)+' coins',914,67,24);
 bjText(ctx,'DEALER',600,106,19,'#f2dbb0',true,'center');
 function hand(cards,y,hide){
  const n=cards.length,scale=Math.min(1.42,660/(Math.max(1,n)*78+Math.max(0,n-1)*13)),w=78*scale,h=108*scale,gap=13;
  const x=600-(n*w+(n-1)*gap)/2;
  cards.forEach((card,i)=>{const xx=x+i*(w+gap);if(hide&&i>0)bjBack(ctx,xx,y,w,h,'#c6a16a');else drawCard(ctx,xx,y,card.rank,card.suit,scale);});
  return y+h;
 }
 const d=hand(dealerCards,130,hideDealer);
 bjBox(ctx,544,d+9,112,37,18,'#101a16','#be9a61');bjText(ctx,hideDealer?'?':dTotal,600,d+27,24,'#fff',true,'center');
 bjText(ctx,'SUA MÃO',600,363,19,'#f2dbb0',true,'center');
 const p=hand(playerCards,382,false);bjBox(ctx,544,p+9,112,37,18,'#101a16','#be9a61');bjText(ctx,pTotal,600,p+27,24,'#fff',true,'center');
 await bjAvatar(ctx,avatar,125,356,50,name,'#d1a76a');bjText(ctx,name||'Jogador',190,343,22,'#fff',true,'left',240);bjText(ctx,'Sua mão',190,371,16,'#d6c7a8',false);
 if(status!=='playing'){
  const label={blackjack:'BLACKJACK!',win:'VITÓRIA',tie:'EMPATE',bust:'ESTOUROU',dealer_blackjack:'BLACKJACK DO DEALER'}[result]??'DERROTA';
  bjBox(ctx,822,320,340,97,14,'#101818ed','#be9a61');bjText(ctx,label,992,351,23,'#f5dfb5',true,'center',310);bjText(ctx,'Retorno: '+bjCoins(payout)+' coins',992,389,19,'#fff',false,'center');
 }
 return bjPng(canvas);
}

// ─── Canvas-drawn economy icons ───────────────────────────────────────────────

function drawEconomyIcon(ctx, cx, cy, type) {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle   = '#FFFFFF';
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  if (type === 'wallet') {
    // Wallet body
    ctx.lineWidth = 2.5;
    roundRect(ctx, cx - 13, cy - 9, 26, 18, 3); ctx.stroke();
    // Flap on top
    ctx.lineWidth = 2;
    roundRect(ctx, cx - 13, cy - 9, 14, 7, 2); ctx.stroke();
    // Coin slot circle
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx + 7, cy + 1, 5, 0, Math.PI * 2); ctx.stroke();
    // Dollar in slot
    ctx.font = `bold 7px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('$', cx + 7, cy + 4);

  } else if (type === 'bank') {
    // Roof triangle
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 14); ctx.lineTo(cx + 15, cy - 5); ctx.lineTo(cx - 15, cy - 5);
    ctx.closePath(); ctx.stroke();
    // Three columns
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 9, cy - 4);
      ctx.lineTo(cx + i * 9, cy + 8);
      ctx.stroke();
    }
    // Base
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx - 16, cy + 9); ctx.lineTo(cx + 16, cy + 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 13, cy + 13); ctx.lineTo(cx + 13, cy + 13); ctx.stroke();

  } else if (type === 'coins') {
    // Three stacked coin circles (offset)
    const coins = [{ x: cx - 4, y: cy + 8 }, { x: cx + 2, y: cy + 1 }, { x: cx - 1, y: cy - 7 }];
    ctx.lineWidth = 2;
    for (const c of coins) {
      ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, Math.PI * 2); ctx.stroke();
    }
    // Dollar on top coin
    ctx.font = `bold 8px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('$', coins[2].x, coins[2].y + 3);
  }

  ctx.restore();
}

// ─── Balance card (matches reference design) ──────────────────────────────────

function fmtDouble(n) {
  if (n >= 1_000_000) return `${fmt(n)} (${(n / 1_000_000).toFixed(2)}M)`;
  if (n >= 1_000)     return `${fmt(n)} (${(n / 1_000).toFixed(2)}K)`;
  return fmt(n);
}

// Luminância relativa para detectar fundo escuro
function isDark(hex) {
  if (!hex) return false;
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

async function generateBalanceCardLegacy({ username, avatarUrl, balance, bank, cardBg1, cardBg2, cardPanelColor, walletRing, walletRingBorder, walletBg }) {
  // Card vertical em alta resolução para o Discord não suavizar o texto e o avatar.
  const W   = 720, H = 1080;
  const PAD = 42;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  const hasBgImage  = !!walletBg;
  const hasCustomBg = !!cardBg1;
  // Modo escuro = bg CDN ou cor personalizada escura
  const darkMode = hasBgImage || isDark(cardBg1);

  // ─── Background ──────────────────────────────────────────────────────────
  if (hasBgImage) {
    // CDN image como fundo full-bleed — strip Discord resize params para qualidade máxima
    roundRect(ctx, 0, 0, W, H, 24); ctx.save(); ctx.clip();
    try {
      const cleanUrl = (() => { try { const u = new URL(walletBg); u.searchParams.delete('width'); u.searchParams.delete('height'); u.searchParams.delete('size'); return u.toString(); } catch { return walletBg; } })();
      const buf = Buffer.from(await (await fetch(cleanUrl)).arrayBuffer());
      const img = await loadImage(buf);
      const scale = Math.max(W / img.width, H / img.height);
      const sw = img.width * scale, sh = img.height * scale;
      ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
    } catch {
      const fb = ctx.createLinearGradient(0, 0, W, H);
      fb.addColorStop(0, '#0D0D1F'); fb.addColorStop(1, '#1a0533');
      ctx.fillStyle = fb; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    // Overlay escuro para legibilidade
    const overlay = ctx.createLinearGradient(0, 0, 0, H);
    overlay.addColorStop(0,   'rgba(0,0,0,0.25)');
    overlay.addColorStop(0.5, 'rgba(0,0,0,0.45)');
    overlay.addColorStop(1,   'rgba(0,0,0,0.78)');
    ctx.fillStyle = overlay;
    roundRect(ctx, 0, 0, W, H, 24); ctx.fill();

  } else if (hasCustomBg) {
    // Cor/gradiente personalizado — cobre o card INTEIRO (sem inner card)
    if (cardBg1 && cardBg2) {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, cardBg1); g.addColorStop(1, cardBg2);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = cardBg1;
    }
    roundRect(ctx, 0, 0, W, H, 24); ctx.fill();

  } else {
    // Padrão: casca cinza + inner card branco
    ctx.fillStyle = '#E3E3E3';
    roundRect(ctx, 0, 0, W, H, 24); ctx.fill();
    ctx.fillStyle = '#F9F9F9';
    roundRect(ctx, 10, 10, W - 20, H - 20, 18); ctx.fill();
  }

  // ─── Título e avatar ───────────────────────────────────────────────────────
  const titleColor = darkMode ? 'rgba(255,255,255,0.82)' : '#666666';
  ctx.fillStyle = titleColor;
  ctx.font = `bold 25px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('CARTEIRA', W / 2, 54);

  const AV_R  = 132;
  const AV_CX = W / 2;
  const AV_CY = 200;

  // Ring — argola/moldura própria da carteira (independente da argola do /perfil)
  if (walletRing) {
    await drawAvatarRing(ctx, AV_CX, AV_CY, AV_R + (darkMode ? 4 : 6), walletRing);
  } else {
    const ringColor = walletRingBorder ?? (darkMode ? '#FFFFFF' : '#C8C8C8');
    ctx.strokeStyle = ringColor; ctx.lineWidth = darkMode ? 4 : 7;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R + (darkMode ? 4 : 6), 0, Math.PI * 2); ctx.stroke();
  }

  ctx.save();
  ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R, 0, Math.PI * 2); ctx.clip();
  try {
    const img = await loadAvatarImg(avatarUrl, 1024);
    if (!img) throw new Error('avatar image unavailable');
    ctx.drawImage(img, AV_CX - AV_R, AV_CY - AV_R, AV_R * 2, AV_R * 2);
  } catch {
    const fallback = ctx.createLinearGradient(AV_CX - AV_R, AV_CY - AV_R, AV_CX + AV_R, AV_CY + AV_R);
    fallback.addColorStop(0, '#A855F7'); fallback.addColorStop(1, '#7C3AED');
    ctx.fillStyle = fallback;
    ctx.fillRect(AV_CX - AV_R, AV_CY - AV_R, AV_R * 2, AV_R * 2);
  }
  ctx.restore();

  // ─── Name ─────────────────────────────────────────────────────────────────
  const PILL_Y = AV_CY + AV_R + 28;
  ctx.font = `bold 30px ${FONT}`;
  const nameW = ctx.measureText(username).width;

  if (darkMode) {
    // Nome com sombra (sem pílula)
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
    ctx.fillText(username, W / 2, PILL_Y + 20);
    ctx.shadowBlur = 0;
  } else {
    const pillW = Math.min(Math.max(nameW + 72, 220), W - PAD * 2), pillH = 58;
    const pillX = W / 2 - pillW / 2;
    ctx.fillStyle = '#E5E5E5';
    roundRect(ctx, pillX, PILL_Y, pillW, pillH, pillH / 2); ctx.fill();
    ctx.fillStyle = '#1A1A1A'; ctx.textAlign = 'center';
    ctx.fillText(username, W / 2, PILL_Y + 38);
  }

  // ─── Stat rows ───────────────────────────────────────────────────────────
  const ROW_H   = 145;
  const ROW_GAP = 22;
  const ROW_Y0  = PILL_Y + (darkMode ? 86 : 92);
  const ICON_R  = 52;

  // Load custom emoji icons
  let imgCoins, imgBank, imgItems;
  try { imgCoins = await loadImage(join(_ecoDir, 'icon_coins.webp')); } catch { imgCoins = null; }
  try { imgBank  = await loadImage(join(_ecoDir, 'icon_bank.png'));   } catch { imgBank  = null; }
  try { imgItems = await loadImage(join(_ecoDir, 'icon_items.png'));  } catch { imgItems = null; }

  const rows = [
    { iconImg: imgCoins, label: 'Carteira', value: fmtDouble(balance)        },
    { iconImg: imgBank,  label: 'Banco',    value: fmtDouble(bank)           },
    { iconImg: imgItems, label: 'Total',    value: fmtDouble(balance + bank) },
  ];

  // Effective pill color — used to decide text contrast
  const effectivePill = cardPanelColor ?? (darkMode ? 'rgba(0,0,0,0.40)' : '#EBEBEB');
  const pillIsDark    = isDark(cardPanelColor) || (!cardPanelColor && darkMode);
  const labelColor    = pillIsDark ? '#FFFFFF' : '#1A1A1A';
  const valueColor    = pillIsDark ? 'rgba(255,255,255,0.75)' : '#555555';

  for (let i = 0; i < rows.length; i++) {
    const { iconImg, label, value } = rows[i];
    const ry = ROW_Y0 + i * (ROW_H + ROW_GAP);
    const rw = W - PAD * 2;

    // Row pill
    ctx.fillStyle = effectivePill;
    roundRect(ctx, PAD, ry, rw, ROW_H, ROW_H / 2); ctx.fill();

    // Black icon circle
    const circleCx = PAD + ICON_R + 18;
    const circleCy = ry + ROW_H / 2;

    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.arc(circleCx, circleCy, ICON_R, 0, Math.PI * 2); ctx.fill();

    // Draw custom emoji image inside circle
    if (iconImg) {
       const imgSize = ICON_R * 1.35;
      ctx.drawImage(iconImg, circleCx - imgSize / 2, circleCy - imgSize / 2, imgSize, imgSize);
    }

    const textX = circleCx + ICON_R + 24;

    ctx.fillStyle = labelColor; ctx.font = `bold 28px ${FONT}`; ctx.textAlign = 'left';
    ctx.fillText(label, textX, ry + 54);

    ctx.fillStyle = valueColor; ctx.font = `23px ${FONT}`;
    ctx.fillText(value, textX, ry + 96);
  }

  return canvas.toBuffer('image/png');
}

async function loadCardTemplate(path) {
  try {
    return await loadImage(readFileSync(path));
  } catch {
    return null;
  }
}

function fitCardText(ctx, text, maxWidth, initialSize, weight = '400', style = '') {
  let size = initialSize;
  while (size > 12) {
    ctx.font = `${style} ${weight} ${size}px ${FONT}`.trim();
    if (ctx.measureText(text).width <= maxWidth) return;
    size -= 1;
  }
  ctx.font = `${style} ${weight} ${size}px ${FONT}`.trim();
}

function walletValueParts(value) {
  const formatted = fmtDouble(Number(value) || 0);
  const splitAt = formatted.indexOf(' ');
  return splitAt === -1
    ? { primary: formatted, secondary: '' }
    : { primary: formatted.slice(0, splitAt), secondary: formatted.slice(splitAt + 1) };
}

function restoreTemplateText(ctx, x, y, w, h, mode) {
  const image = ctx.getImageData(x, y, w, h);
  const original = new Uint8ClampedArray(image.data);
  const isTextPixel = (index) => {
    const r = original[index];
    const g = original[index + 1];
    const b = original[index + 2];
    const brightness = (r + g + b) / 3;
    const neutral = Math.max(r, g, b) - Math.min(r, g, b) < 55;
    return mode === 'light'
      ? neutral && brightness > 70
      : neutral && brightness < 215;
  };

  const sample = (px, py) => {
    const index = (py * w + px) * 4;
    return [
      original[index],
      original[index + 1],
      original[index + 2],
      original[index + 3],
    ];
  };

  // Remove only the template's printed glyphs. Sampling the surrounding
  // artwork keeps its grain, reflections and gradients instead of painting
  // a visible flat rectangle over the supplied design.
  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const index = (py * w + px) * 4;
      if (!isTextPixel(index)) continue;

      let replacement = null;
      for (let distance = 8; distance <= 28 && !replacement; distance += 2) {
        const candidates = [
          [px, py - distance],
          [px, py + distance],
          [px - distance, py],
          [px + distance, py],
        ];
        const valid = candidates
          .filter(([candidateX, candidateY]) => (
            candidateX >= 0 && candidateX < w &&
            candidateY >= 0 && candidateY < h &&
            !isTextPixel((candidateY * w + candidateX) * 4)
          ))
          .map(([candidateX, candidateY]) => sample(candidateX, candidateY));
        if (valid.length >= 2) {
          replacement = valid.reduce(
            (total, color) => total.map((value, channel) => value + color[channel]),
            [0, 0, 0, 0],
          ).map(value => Math.round(value / valid.length));
        }
      }

      if (replacement) {
        image.data[index] = replacement[0];
        image.data[index + 1] = replacement[1];
        image.data[index + 2] = replacement[2];
        image.data[index + 3] = replacement[3];
      }
    }
  }

  ctx.putImageData(image, x, y);
}

function drawWalletTemplateValue(ctx, value, y) {
  const { primary, secondary } = walletValueParts(value);

  if (y === 760) {
    // The wallet row has only a single-line sample, so retain its texture
    // while clearing the old value and any faint pixels beneath it.
    restoreTemplateText(ctx, 320, y - 43, 555, 92, 'light');
  } else {
    // The bank and total rows have example balances baked into both lines.
    // Cover both before drawing the live value so no sample digits (or
    // inpainting artifacts) remain when the real value is small.
    ctx.fillStyle = '#08090B';
    roundRect(ctx, 320, y - 43, 385, 92, 8);
    ctx.fill();
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#F4F5F7';
  fitCardText(ctx, primary, 515, 39, '700');
  ctx.fillText(primary, 333, y);

  if (secondary) {
    ctx.fillStyle = 'rgba(235, 237, 241, 0.86)';
    fitCardText(ctx, secondary, 515, 25, '400');
    ctx.fillText(secondary, 333, y + 43);
  }
}

// ─── Wallet card using the supplied artwork as the fixed design ───────────────
export async function generateBalanceCard({ username, avatarUrl, balance, bank, dashboard=null, ...style }) {
  if(dashboard)return generateWalletDashboard({username,avatarUrl,balance,bank,dashboard,...style});
  const W = 1024;
  const H = 1536;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const template = await loadCardTemplate(_walletTemplatePath);

  if (template) {
    ctx.drawImage(template, 0, 0, W, H);
  } else {
    // The template is packaged with the bot. Keep a readable fallback if an
    // installation is missing the binary asset instead of failing the command.
    ctx.fillStyle = '#080A0D';
    ctx.fillRect(0, 0, W, H);
  }

  const avatarCx = 512;
  const avatarCy = 292;
  const avatarR = 137;
  const avatar = await loadAvatarImg(avatarUrl, 1024);

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) {
    ctx.drawImage(avatar, avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, avatarR * 2);
  } else {
    drawAvatarFallback(ctx, avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, username);
  }
  ctx.restore();

  // The reference uses a single centered display name below the portrait.
  // Restore the artwork around the sample name instead of covering it with a
  // solid bar; this preserves the subtle black texture and underline.
  restoreTemplateText(ctx, 135, 475, 754, 62, 'light');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#F4F4F6';
  fitCardText(ctx, username || 'Usuário', 720, 46, '700', 'italic');
  ctx.fillText(username || 'Usuário', W / 2, 532);

  drawWalletTemplateValue(ctx, balance, 760);
  drawWalletTemplateValue(ctx, bank, 1015);
  drawWalletTemplateValue(ctx, (Number(balance) || 0) + (Number(bank) || 0), 1275);

  return canvas.toBuffer('image/png');
}

// ─── Top leaderboard card (redesign — no emoji in canvas) ─────────────────────

function drawRankBadge(ctx, cx, cy, rank) {
  let bgColor, textColor;
  if (rank === 1)      { bgColor = '#F5C518'; textColor = '#3A2000'; }
  else if (rank === 2) { bgColor = '#C0C0C0'; textColor = '#1A1A1A'; }
  else if (rank === 3) { bgColor = '#CD7F32'; textColor = '#1A0800'; }
  else                 { bgColor = '#4B1D8A'; textColor = '#DDD0FF'; }

  // Badge circle
  ctx.fillStyle = bgColor;
  ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();

  // Inner ring for top 3
  if (rank <= 3) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.fillStyle   = textColor;
  ctx.font        = `bold 14px ${FONT}`;
  ctx.textAlign   = 'center';
  ctx.fillText(String(rank), cx, cy + 5);
}

function drawCoinAmount(ctx, x, cy, amount) {
  const cr   = 10;
  const coinX = x - cr;          // coin centre — flush to right edge
  const textX = coinX - cr - 6;  // text right-aligned just to the left of coin

  // Amount text (drawn first, right-aligned)
  ctx.fillStyle   = '#C084FC';
  ctx.font        = `bold 15px ${FONT}`;
  ctx.textAlign   = 'right';
  ctx.fillText(fmt(amount), textX, cy + 5);

  // Coin circle — to the RIGHT of the text
  ctx.fillStyle = '#F5C518';
  ctx.beginPath(); ctx.arc(coinX, cy, cr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3A2000'; ctx.font = `bold 9px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText("$", coinX, cy + 3);
}

function drawCoinIcon(ctx, cx, cy, r) {
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
  grad.addColorStop(0, '#FFE9A0');
  grad.addColorStop(0.55, '#F5C518');
  grad.addColorStop(1, '#C48F0A');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#5C3A00';
  ctx.font = `bold ${Math.round(r * 1.05)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText("$", cx, cy + r * 0.36);
}

function drawCrown(ctx, cx, cy, w) {
  const h = w * 0.62;
  const top = cy - h / 2, bot = cy + h / 2;
  const l = cx - w / 2, r = cx + w / 2;
  const grad = ctx.createLinearGradient(l, top, r, bot);
  grad.addColorStop(0, '#FFEDA8');
  grad.addColorStop(0.5, '#F5C518');
  grad.addColorStop(1, '#D4A017');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(l, bot);
  ctx.lineTo(l, top + h * 0.42);
  ctx.lineTo(l + w * 0.22, top + h * 0.72);
  ctx.lineTo(cx, top);
  ctx.lineTo(r - w * 0.22, top + h * 0.72);
  ctx.lineTo(r, top + h * 0.42);
  ctx.lineTo(r, bot);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(l, bot - h * 0.16, w, h * 0.16);
  // Little gems
  ctx.fillStyle = '#B91C1C';
  ctx.beginPath(); ctx.arc(cx, top + h * 0.5, w * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1D4ED8';
  ctx.beginPath(); ctx.arc(l + w * 0.2, top + h * 0.62, w * 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r - w * 0.2, top + h * 0.62, w * 0.04, 0, Math.PI * 2); ctx.fill();
}

async function loadAvatarImg(url, requestedSize = 256) {
  try {
    if (!url) return null;

    // discord.js already returns `?size=256`; setSearchParams avoids creating
    // an invalid `...?size=256?size=256` URL when a caller passes it through.
    const avatarUrl = new URL(url);
    avatarUrl.searchParams.set('size', String(requestedSize));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const response = await fetch(avatarUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/png,image/jpeg,image/*;q=0.8',
        'User-Agent': 'SavageBot/2.0',
      },
    });
    try {
      if (!response.ok) return null;
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType && !contentType.toLowerCase().startsWith('image/')) return null;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) return null;
      return await loadImage(bytes);
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

function drawAvatarFallback(ctx, x, y, size, username) {
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, '#A855F7');
  grad.addColorStop(1, '#6B21A8');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `bold ${Math.round(size * 0.42)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText((username?.[0] ?? '?').toUpperCase(), x + size / 2, y + size / 2 + size * 0.15);
}

const MEDALS = {
  1: { label: 'OURO',    accent: '#F5C518', accentSoft: 'rgba(245,197,24,0.16)', text: '#3A2000' },
  2: { label: 'PRATA',   accent: '#C7CDD8', accentSoft: 'rgba(199,205,216,0.14)', text: '#1A1A1A' },
  3: { label: 'BRONZE',  accent: '#CD7F32', accentSoft: 'rgba(205,127,50,0.16)', text: '#1A0800' },
};

function truncateText(ctx, text, maxW) {
  let t = text;
  while (ctx.measureText(t).width > maxW && t.length > 1) t = t.slice(0, -1);
  if (t !== text) t = t.slice(0, -1) + '…';
  return t;
}

async function drawPodiumCard(ctx, x, y, w, h, entry, rank, avatarImg) {
  const medal = MEDALS[rank];

  // Card panel
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, rank === 1 ? 'rgba(245,197,24,0.10)' : medal.accentSoft);
  grad.addColorStop(1, 'rgba(20,17,42,0.35)');
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = medal.accent;
  ctx.lineWidth = rank === 1 ? 2.4 : 1.6;
  roundRect(ctx, x, y, w, h, 18); ctx.stroke();

  const cx = x + w / 2;

  // Crown above #1
  if (rank === 1) drawCrown(ctx, cx, y - 20, 34);

  // Rank pill
  const pillY = y + 14;
  ctx.fillStyle = medal.accent;
  roundRect(ctx, cx - 30, pillY, 60, 24, 12); ctx.fill();
  ctx.fillStyle = medal.text;
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`#${rank} · ${medal.label}`, cx, pillY + 16);

  // Avatar
  const avR = rank === 1 ? 44 : 36;
  const avCy = pillY + 24 + avR + 14;
  ctx.strokeStyle = medal.accent; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, avCy, avR + 4, 0, Math.PI * 2); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, avCy, avR, 0, Math.PI * 2); ctx.clip();
  if (avatarImg) ctx.drawImage(avatarImg, cx - avR, avCy - avR, avR * 2, avR * 2);
  else drawAvatarFallback(ctx, cx - avR, avCy - avR, avR * 2, entry.username);
  ctx.restore();

  // Username
  const nameY = avCy + avR + 26;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(truncateText(ctx, entry.username, w - 24), cx, nameY);

  // Subtitle
  ctx.fillStyle = '#9C8FCB';
  ctx.font = `11px ${FONT}`;
  ctx.fillText('Patrimônio total', cx, nameY + 18);

  // Amount
  ctx.fillStyle = medal.accent;
  ctx.font = `bold 17px ${FONT}`;
  ctx.fillText(fmt(entry.total), cx, nameY + 42);
  drawCoinIcon(ctx, cx + ctx.measureText(fmt(entry.total)).width / 2 + 14, nameY + 37, 9);
}

function drawListRow(ctx, y, w, entry, rank, avatarImg) {
  const PAD = 24;
  const ROW_H = 66;
  const isThird = rank % 2 === 0;

  ctx.fillStyle = isThird ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)';
  roundRect(ctx, PAD, y, w - PAD * 2, ROW_H - 10, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  roundRect(ctx, PAD, y, w - PAD * 2, ROW_H - 10, 14); ctx.stroke();

  const cy = y + (ROW_H - 10) / 2;

  // Rank badge
  drawRankBadge(ctx, PAD + 30, cy, rank);

  // Avatar
  const avR = 20, avCx = PAD + 78;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(avCx, cy, avR + 2, 0, Math.PI * 2); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.arc(avCx, cy, avR, 0, Math.PI * 2); ctx.clip();
  if (avatarImg) ctx.drawImage(avatarImg, avCx - avR, cy - avR, avR * 2, avR * 2);
  else drawAvatarFallback(ctx, avCx - avR, cy - avR, avR * 2, entry.username);
  ctx.restore();

  // Username + subtitle
  const textX = avCx + avR + 18;
  const maxNameW = w - PAD - 190 - textX;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(truncateText(ctx, entry.username, maxNameW), textX, cy - 3);
  ctx.fillStyle = '#8A7EB0';
  ctx.font = `11px ${FONT}`;
  ctx.fillText('Patrimônio total', textX, cy + 14);

  // Amount
  drawCoinAmount(ctx, w - PAD - 8, cy, entry.total);
}

function drawRankingMedal(ctx, x, y, rank, size) {
  const styles = {
    1: { fill: '#FFE033', edge: '#FFF4A3', text: '#6A4A00' },
    2: { fill: '#D6DCE5', edge: '#FFFFFF', text: '#35404D' },
    3: { fill: '#E28A2C', edge: '#FFC36B', text: '#5B2500' },
  };
  const style = styles[rank] ?? { fill: '#208FEA', edge: '#65C5FF', text: '#FFFFFF' };
  const cx = x + size / 2;
  const cy = y + size / 2;

  ctx.fillStyle = style.fill;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);

  if (rank <= 3) {
    ctx.fillStyle = rank === 1 ? '#F5B900' : rank === 2 ? '#AEB7C4' : '#BE5D1B';
    ctx.beginPath();
    ctx.moveTo(cx - 10, y + size - 2);
    ctx.lineTo(cx - 6, y + size + 10);
    ctx.lineTo(cx, y + size + 4);
    ctx.lineTo(cx + 6, y + size + 10);
    ctx.lineTo(cx + 10, y + size - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = style.edge;
    ctx.stroke();

    ctx.fillStyle = style.fill;
    ctx.beginPath();
    ctx.arc(cx, y + 24, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = style.edge;
    ctx.stroke();
  }

  ctx.fillStyle = style.text;
  ctx.font = `bold ${rank <= 3 ? 22 : 30}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(rank), cx, rank <= 3 ? y + 24 : cy);
  ctx.textBaseline = 'alphabetic';
}

function drawRankingRow(ctx, x, y, w, entry, rank, avatarImg, options = {}) {
  const ROW_H = 67;
  const PANEL_H = ROW_H - 4;
  const medalW = 52;
  const avatarR = 25;
  const avatarCx = x + medalW + 48;
  // Center every element against the visible panel, not the row spacing.
  const centerY = y + PANEL_H / 2;

  ctx.fillStyle = 'rgba(222, 232, 242, 0.66)';
  roundRect(ctx, x, y, w, PANEL_H, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.38)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, PANEL_H, 7);
  ctx.stroke();

  drawRankingMedal(ctx, x, y, rank, medalW);

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, centerY, avatarR, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, avatarCx - avatarR, centerY - avatarR, avatarR * 2, avatarR * 2);
  } else {
    drawAvatarFallback(ctx, avatarCx - avatarR, centerY - avatarR, avatarR * 2, entry.username);
  }
  ctx.restore();
  // Keep the avatar treatment identical in Elite and Coins columns.
  ctx.strokeStyle = 'rgba(255,255,255,0.78)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(avatarCx, centerY, avatarR + 1, 0, Math.PI * 2);
  ctx.stroke();

  const textX = avatarCx + avatarR + 18;
  const amount = options.value ?? entry.total ?? 0;
  const amountText = fmtCompactTop(amount);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F8FBFF';
  ctx.font = `400 24px ${FONT}`;
  ctx.fillText(truncateText(ctx, entry.username, w - 300), textX, centerY + 8);

  const amountX = x + w - 22;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 25px ${FONT}`;
  // Use a fixed two-line block so long Elite values stay above the label.
  ctx.fillText(amountText, amountX, centerY - 7);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText('Coins', amountX, centerY + 22);
  ctx.textAlign = 'left';
}

function fmtCompactTop(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '0';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1).replace('.0', '')}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1).replace('.0', '')}K`;
  return amount.toLocaleString('pt-BR');
}

async function loadRankingBackground() {
  try {
    return await loadImage(readFileSync(_rankingBackgroundPath));
  } catch {
    return null;
  }
}

function drawRankingBackground(ctx, image, width, height) {
  if (image) {
    const scale = Math.max(width / image.width, height / image.height);
    const sw = image.width * scale;
    const sh = image.height * scale;
    ctx.drawImage(image, (width - sw) / 2, (height - sh) / 2, sw, sh);
  } else {
    ctx.fillStyle = '#0A2E56';
    ctx.fillRect(0, 0, width, height);
  }

  const shade = ctx.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, 'rgba(2, 22, 51, 0.62)');
  shade.addColorStop(0.42, 'rgba(1, 24, 56, 0.38)');
  shade.addColorStop(1, 'rgba(1, 13, 38, 0.62)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
}

async function generateTopCardLegacy({ eliteEntries = [], coinEntries = [] } = {}) {
  const W = 1024;
  const H = 682;
  const PAD = 58;
  const GAP = 42;
  const HEADER_H = 130;
  const ROW_H = 67;
  const ROW_GAP = 11;
  const COL_W = (W - PAD * 2 - GAP) / 2;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const elite = eliteEntries.slice(0, 6);
  const coins = coinEntries.slice(0, 6);
  const allEntries = [...elite, ...coins];
  const avatars = await Promise.all(
    allEntries.map(entry => entry.avatarUrl ? loadAvatarImg(entry.avatarUrl) : Promise.resolve(null)),
  );
  const avatarFor = offset => avatars[offset];
  const background = await loadRankingBackground();

  drawRankingBackground(ctx, background, W, H);

  // Header labels mirroring the reference composition.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 48px ${FONT}`;
  ctx.fillText('Top Elite', W * 0.25, 89);
  ctx.fillText('Top Coins', W * 0.75, 89);
  drawCoinIcon(ctx, W * 0.25 + 188, 68, 20);
  drawCoinIcon(ctx, W * 0.75 + 164, 68, 20);

  const leftX = PAD;
  const rightX = PAD + COL_W + GAP;
  const firstRowY = HEADER_H;
  elite.forEach((entry, index) => {
    drawRankingRow(ctx, leftX, firstRowY + index * (ROW_H + ROW_GAP), COL_W, entry, index + 1, avatarFor(index), {
      elite: true,
      value: entry.eliteTotal ?? entry.total ?? 0,
    });
  });
  coins.forEach((entry, index) => {
    drawRankingRow(ctx, rightX, firstRowY + index * (ROW_H + ROW_GAP), COL_W, entry, index + 1, avatarFor(elite.length + index), {
      value: entry.coins ?? entry.total ?? 0,
    });
  });

  return canvas.toBuffer('image/png');
}

function restoreRankingSurface(ctx, x, y, w, h, padding = 8) {
  const source = ctx.getImageData(x - padding, y, w + padding * 2, h);
  const output = ctx.getImageData(x, y, w, h);
  const sourceWidth = w + padding * 2;
  const read = (px, py) => {
    const index = (py * sourceWidth + px) * 4;
    return [
      source.data[index],
      source.data[index + 1],
      source.data[index + 2],
      source.data[index + 3],
    ];
  };

  // Rebuild the field from the two untouched edges of this same glass card.
  // The interpolation follows the row's existing light and texture values,
  // so the sample glyphs disappear without placing another panel on top.
  for (let py = 0; py < h; py += 1) {
    const left = read(Math.max(0, padding - 4), py);
    const right = read(Math.min(sourceWidth - 1, padding + w + 3), py);
    for (let px = 0; px < w; px += 1) {
      const t = (px + 1) / (w + 1);
      const index = (py * w + px) * 4;
      output.data[index] = Math.round(left[0] + (right[0] - left[0]) * t);
      output.data[index + 1] = Math.round(left[1] + (right[1] - left[1]) * t);
      output.data[index + 2] = Math.round(left[2] + (right[2] - left[2]) * t);
      output.data[index + 3] = Math.round(left[3] + (right[3] - left[3]) * t);
    }
  }

  ctx.putImageData(output, x, y);
}

function drawRankingTemplateValue(ctx, x, y, w, value) {
  const rowH = 88;
  const centerY = y + rowH / 2;
  // Everything except the numeric value belongs to the supplied table:
  // member names, avatars, ranks, crowns, borders, lighting and labels.
  // Do not redraw or replace any of those pixels.
  // The supplied artwork is slightly asymmetric: the Elite value ends at
  // x=720 while the Coins value ends at x=1410. Keep those anchors instead of
  // aligning both columns to their card edges.
  const amountRight = x < 500 ? x + w - 30 : x + w - 40;
  const amountX = x + w - 114;
  if (value === null || value === undefined) return;

  restoreRankingSurface(ctx, amountX, centerY - 30, 96, 36, 5);
  const amountText = fmtCompactTop(value);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#20252B';
  fitCardText(ctx, amountText, 96, 30, '700');
  ctx.fillText(amountText, amountRight, centerY + 3);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

function clearRankingTemplateSlot(ctx, x, y, w) {
  const rowH = 88;
  const inset = 2;
  const innerX = x + inset;
  const innerY = y + inset;
  const innerW = w - inset * 2;
  const innerH = rowH - inset * 2;

  ctx.save();
  roundRect(ctx, innerX, innerY, innerW, innerH, 14);
  ctx.clip();
  const fill = ctx.createLinearGradient(0, innerY, 0, innerY + innerH);
  fill.addColorStop(0, '#F0F2F5');
  fill.addColorStop(0.5, '#DDE1E6');
  fill.addColorStop(1, '#EEF0F3');
  ctx.fillStyle = fill;
  ctx.fillRect(innerX, innerY, innerW, innerH);
  ctx.restore();
}

function drawRankingTemplateMember(ctx, x, y, w, entry, avatarImg) {
  const rowH = 88;
  const centerY = y + rowH / 2;
  const avatarCx = x + 157;
  const avatarR = 37;

  if (!entry) {
    clearRankingTemplateSlot(ctx, x, y, w);
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, centerY, avatarR, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, avatarCx - avatarR, centerY - avatarR, avatarR * 2, avatarR * 2);
  } else {
    drawAvatarFallback(ctx, avatarCx - avatarR, centerY - avatarR, avatarR * 2, entry.username);
  }
  ctx.restore();

  const nameX = x + 220;
  const nameW = Math.min(240, w - 385);
  restoreRankingSurface(ctx, nameX, centerY - 23, nameW, 42, 8);

  ctx.fillStyle = '#20252B';
  ctx.textAlign = 'left';
  ctx.font = `400 27px ${FONT}`;
  ctx.fillText(truncateText(ctx, entry.username || 'Usuário', nameW), nameX, centerY + 10);
}

// ─── Chrome Y2K ranking — artwork and live data are separate layers ─────────
function rankMetal(ctx,x,y,w,h,stops){
  const g=ctx.createLinearGradient(x,y,x+w*.12,y+h);
  for(const [at,c] of stops)g.addColorStop(at,c);
  return g;
}
function rankFlare(ctx,x,y,r,opacity=.85){
  ctx.save();ctx.globalAlpha=opacity;
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,'#ffffff');g.addColorStop(.13,'#ffffffdc');g.addColorStop(.37,'#c5d3ff38');g.addColorStop(1,'#aebfff00');
  ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(x,y-r);ctx.quadraticCurveTo(x+2,y-3,x+r*.72,y);ctx.quadraticCurveTo(x+2,y+3,x,y+r);ctx.quadraticCurveTo(x-2,y+3,x-r*.72,y);ctx.quadraticCurveTo(x-2,y-3,x,y-r);ctx.fill();
  ctx.restore();
}
function rankCrown(ctx,x,y,w){
  ctx.save();ctx.translate(x,y);ctx.scale(w/30,w/30);
  ctx.strokeStyle='#30343e';ctx.fillStyle='#30343e';ctx.lineWidth=2;ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(-13,-8);ctx.lineTo(-6,0);ctx.lineTo(0,-11);ctx.lineTo(6,0);ctx.lineTo(13,-8);ctx.lineTo(10,7);ctx.lineTo(-10,7);ctx.closePath();ctx.stroke();
  ctx.beginPath();ctx.moveTo(-11,10);ctx.lineTo(11,10);ctx.stroke();
  for(const [a,b] of [[-13,-8],[0,-11],[13,-8]]){ctx.beginPath();ctx.arc(a,b,1.5,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
function rankDiamond(ctx,cx,cy,r,position){
  ctx.save();ctx.translate(cx,cy);
  const diamond=(sx,sy,fill,stroke,width=1)=>{
    ctx.beginPath();ctx.moveTo(0,-sy);ctx.quadraticCurveTo(sx*.32,-sy*.34,sx,0);ctx.quadraticCurveTo(sx*.32,sy*.34,0,sy);ctx.quadraticCurveTo(-sx*.32,sy*.34,-sx,0);ctx.quadraticCurveTo(-sx*.32,-sy*.34,0,-sy);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();
  };
  const outer=rankMetal(ctx,-r,-r,r*2,r*2,[[0,'#fff'],[.18,'#8c95aa'],[.39,'#f8faff'],[.51,'#3d4352'],[.74,'#cdd3df'],[1,'#f8faff']]);
  ctx.shadowColor='#edf4ff66';ctx.shadowBlur=10;diamond(r+8,r+8,outer,'#ffffff',1.5);ctx.shadowBlur=0;
  // Four metallic facets surround a raised, circular silver medal.
  diamond(r+3,r+3,outer,'#687080',1.5);
  diamond(r-6,r-4,rankMetal(ctx,-r,-r,r*2,r*2,[[0,'#8c92a3'],[.31,'#f8fbff'],[.55,'#8a91a0'],[1,'#e8ecf2']]),'#f8faff',1);
  const rr=r*.70;
  const g=ctx.createLinearGradient(0,-rr,0,rr);g.addColorStop(0,'#f5f6fb');g.addColorStop(.44,'#d5d9e1');g.addColorStop(.50,'#aab0bc');g.addColorStop(1,'#f7f8fc');
  ctx.beginPath();ctx.arc(0,0,rr+3,0,Math.PI*2);ctx.fillStyle='#515866';ctx.fill();
  ctx.beginPath();ctx.arc(0,0,rr,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
  ctx.font='bold 43px '+FONT;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#141820';ctx.fillText(String(position),0,2);
  ctx.restore();
}
function rankChromeRow(ctx,x,y,w,h,entry,position,avatar,amount){
  const r=23,cy=y+h/2;
  const outer=rankMetal(ctx,x,y,w,h,[[0,'#f9fbff'],[.11,'#747b8b'],[.29,'#e5e9f4'],[.48,'#353c4a'],[.63,'#c7cedd'],[.83,'#fafcff'],[1,'#555d6b']]);
  ctx.save();ctx.shadowColor='#d9e4ff48';ctx.shadowBlur=12;roundRect(ctx,x,y,w,h,r);ctx.fillStyle=outer;ctx.fill();ctx.restore();
  roundRect(ctx,x+2,y+2,w-4,h-4,r-2);ctx.strokeStyle='#f8faff';ctx.lineWidth=1.25;ctx.stroke();
  roundRect(ctx,x+5,y+5,w-10,h-10,r-5);ctx.fillStyle='#252b35';ctx.fill();
  const glass=rankMetal(ctx,x,y,w,h,[[0,'#eef1f8'],[.15,'#c4c9d5'],[.31,'#a0a9bd'],[.47,'#e9edf6'],[.49,'#f6f7fa'],[.70,'#c3c9d6'],[.90,'#dfe4ee'],[1,'#f8faff']]);
  roundRect(ctx,x+8,y+8,w-16,h-16,r-8);ctx.fillStyle=glass;ctx.fill();
  ctx.save();roundRect(ctx,x+8,y+8,w-16,h-16,r-8);ctx.clip();
  // Subtle diagonal brushed chrome bands; contrast stays strong behind live text.
  for(const [a,alpha,width] of [[.25,.11,65],[.50,.12,95],[.79,.17,64]]){
    const bx=x+w*a;ctx.fillStyle='rgba(255,255,255,'+alpha+')';ctx.beginPath();ctx.moveTo(bx,y);ctx.lineTo(bx+width,y);ctx.lineTo(bx+width-125,y+h);ctx.lineTo(bx-125,y+h);ctx.closePath();ctx.fill();
  }
  const shade=ctx.createLinearGradient(x,y,x,y+h);shade.addColorStop(0,'#ffffff44');shade.addColorStop(.25,'#ffffff00');shade.addColorStop(.85,'#ffffff00');shade.addColorStop(1,'#141a2c20');
  ctx.fillStyle=shade;ctx.fillRect(x,y,w,h);ctx.restore();
  roundRect(ctx,x+9,y+9,w-18,h-18,r-9);ctx.strokeStyle='#ffffffb0';ctx.lineWidth=1;ctx.stroke();
  rankDiamond(ctx,x+30,cy,42,position);
  const avx=x+138,avR=36;
  if(entry){
    ctx.save();ctx.shadowColor='#151b2b88';ctx.shadowBlur=7;ctx.beginPath();ctx.arc(avx,cy,avR+3,0,Math.PI*2);ctx.fillStyle='#202533';ctx.fill();ctx.restore();
    ctx.save();ctx.beginPath();ctx.arc(avx,cy,avR,0,Math.PI*2);ctx.clip();
    if(avatar){
      const scale=Math.max(avR*2/avatar.width,avR*2/avatar.height);
      ctx.drawImage(avatar,avx-avatar.width*scale/2,cy-avatar.height*scale/2,avatar.width*scale,avatar.height*scale);
    }else{
      // Same fallback path as other cards, never reuse the preview's portraits.
      drawAvatarFallback(ctx,avx-avR,cy-avR,avR*2,entry.username);
    }
    ctx.restore();
    ctx.strokeStyle='#f4f6fb';ctx.lineWidth=2;ctx.beginPath();ctx.arc(avx,cy,avR+1,0,Math.PI*2);ctx.stroke();
    const nameX=x+196,amountX=x+w-25,crownX=x+w-143,amountW=105;
    ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.fillStyle='#151922';ctx.font='bold 28px '+FONT;
    ctx.fillText(truncateText(ctx,String(entry.username||'Usuário'),crownX-nameX-25),nameX,cy+10);
    rankCrown(ctx,crownX,cy,27);
    ctx.textAlign='right';ctx.fillStyle='#151922';const value=fmtCompactTop(amount);
    fitCardText(ctx,value,amountW,32,'700');ctx.fillText(value,amountX,cy+2);
    ctx.font='15px '+FONT;ctx.fillStyle='#303540';ctx.fillText('Coins',amountX,cy+23);
  }else{
    ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.font='22px '+FONT;ctx.fillStyle='#626976';ctx.fillText('Posição disponível',x+196,cy+8);
    ctx.textAlign='right';ctx.fillText('—',x+w-25,cy+8);
  }
  ctx.textAlign='left';ctx.textBaseline='alphabetic';
  rankFlare(ctx,x+w*.62,y+3,13,.62);rankFlare(ctx,x+w*.84,y+h-3,10,.45);
}
function rankFallbackHeader(ctx){
  const title=(str,x)=>{
    ctx.save();ctx.font='italic bold 104px serif';ctx.textAlign='center';ctx.textBaseline='alphabetic';
    ctx.strokeStyle='#232833';ctx.lineWidth=6;ctx.strokeText(str,x,195);
    ctx.fillStyle=rankMetal(ctx,x-250,80,500,120,[[0,'#fff'],[.25,'#b6bdcc'],[.43,'#fafcff'],[.51,'#676f82'],[.65,'#dfe4f1'],[1,'#ffffff']]);ctx.fillText(str,x,195);
    ctx.strokeStyle='#eff3ff';ctx.lineWidth=1;ctx.strokeText(str,x,195);ctx.restore();
  };
  title('Top Elite',424);title('Top Coins',1113);
  ctx.font='15px '+FONT;ctx.fillStyle='#e5e8ef';ctx.textAlign='center';ctx.fillText('THE REAL ONES STAY ON TOP  ///',424,248);ctx.fillText('MORE COINS   MORE OPTIONS  ///',1113,248);
  ctx.textAlign='left';ctx.fillText('E C O N O M Y   R A N K',87,40);
}
export async function generateTopCard({ eliteEntries = [], coinEntries = [] } = {}) {
  const W=1536,H=1024,canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
  const template=await loadCardTemplate(_rankingTemplatePath);
  // Start from a clean silk/obsidian surface. The original template may contain
  // sample users, so only immutable header/footer/outer-edge artwork is copied.
  ctx.fillStyle=rankMetal(ctx,0,0,W,H,[[0,'#0a0c11'],[.32,'#171a22'],[.58,'#08090c'],[.82,'#191d26'],[1,'#08090c']]);ctx.fillRect(0,0,W,H);
  for(let k=0;k<6;k++){
    const x=110+k*265,y=350+(k%3)*160;
    const halo=ctx.createRadialGradient(x,y,0,x,y,380);halo.addColorStop(0,'#a5b5d91b');halo.addColorStop(1,'#a5b5d900');ctx.fillStyle=halo;ctx.fillRect(0,0,W,H);
  }
  if(template){
    // Strict cropping keeps the chrome title, CD, chains and footer ornament,
    // never any example names, ranks, balances or avatars from the old image.
    const slices=[[0,0,W,282],[0,930,W,94],[0,282,76,648],[1464,282,72,648]];
    for(const [x,y,w,h] of slices)ctx.drawImage(template,x*template.width/W,y*template.height/H,w*template.width/W,h*template.height/H,x,y,w,h);
  }else rankFallbackHeader(ctx);
  // Add matching light glints to the chrome artwork without obscuring titles.
  rankFlare(ctx,593,80,25,.60);rankFlare(ctx,1174,107,24,.55);rankFlare(ctx,768,169,31,.85);
  const elite=eliteEntries.slice(0,6),coins=coinEntries.slice(0,6);
  const all=[...elite,...coins];
  const avatars=await Promise.all(all.map(e=>e?.avatarUrl?loadAvatarImg(e.avatarUrl,256):Promise.resolve(null)));
  for(let i=0;i<6;i++){
    const y=299+i*105;
    rankChromeRow(ctx,130,y,620,94,elite[i],i+1,avatars[i]??null,elite[i]?.eliteTotal??elite[i]?.total??0);
    rankChromeRow(ctx,817,y,634,94,coins[i],i+1,avatars[elite.length+i]??null,coins[i]?.coins??coins[i]?.total??0);
  }
  return canvas.toBuffer('image/png');
}

// ─── Coinflip card (cute) ─────────────────────────────────────────────────────

export function generateCoinflipCard({ side, resultado, won, bet, userBalance }) {
  const W = 700, H = 380;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  drawCuteBg(ctx, W, H, won ? ['#3B1F6A', '#6A2D9A', '#9B4FD6'] : ['#2A2A4A', '#3A3A6A', '#5A5A8A']);

  // Sparkle decorations
  const sparkles = won
    ? [[80,60],[620,50],[100,310],[600,300],[350,40],[180,320]]
    : [[80,60],[620,50],[100,310],[600,300]];
  for (const [sx, sy] of sparkles) drawSparkle(ctx, sx, sy, 12, won ? 'rgba(255,210,80,0.4)' : 'rgba(180,180,220,0.25)');

  drawCuteHeader(ctx, W, '🪙   C O I N F L I P   🪙', won ? '#FFE0A0' : '#C0C8FF', won ? '#4A2A00' : '#1E1E3A');

  // Coin
  const cx = W / 2, cy = 195, cr = 95;

  // Glow ring
  const glowGrad = ctx.createRadialGradient(cx, cy, cr * 0.3, cx, cy, cr * 1.6);
  glowGrad.addColorStop(0, won ? 'rgba(255,200,50,0.45)' : 'rgba(120,120,180,0.25)');
  glowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGrad;
  ctx.beginPath(); ctx.arc(cx, cy, cr * 1.6, 0, Math.PI * 2); ctx.fill();

  // Coin gradient
  const coinGrad = ctx.createRadialGradient(cx - 25, cy - 25, 8, cx, cy, cr);
  if (won) {
    coinGrad.addColorStop(0, '#FFF0A0');
    coinGrad.addColorStop(0.4, '#F5C518');
    coinGrad.addColorStop(0.8, '#D4A017');
    coinGrad.addColorStop(1, '#8A6000');
  } else {
    coinGrad.addColorStop(0, '#D0D0E8');
    coinGrad.addColorStop(0.5, '#9090B8');
    coinGrad.addColorStop(1, '#505070');
  }
  ctx.fillStyle = coinGrad;
  ctx.shadowColor = won ? 'rgba(255,193,7,0.6)' : 'rgba(80,80,120,0.4)';
  ctx.shadowBlur = 30;
  ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // Coin rim
  ctx.strokeStyle = won ? 'rgba(255,230,100,0.8)' : 'rgba(160,160,200,0.6)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = won ? 'rgba(255,255,200,0.3)' : 'rgba(200,200,230,0.2)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, cr - 14, 0, Math.PI * 2); ctx.stroke();

  // Coin text
  ctx.fillStyle = won ? '#4A3000' : '#B0B0D0';
  ctx.font = `bold 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(resultado === 'cara' ? 'CARA' : 'COROA', cx, cy + 9);

  // Result pill
  const resText = won ? '✨  ACERTOU!' : '❌  ERROU';
  const rFrom = won ? '#1A7A3A' : '#7A2020';
  const rTo   = won ? '#2ECC70' : '#CC3030';
  drawResultBanner(ctx, W, 315, resText, rFrom, rTo, '#FFFFFF');

  drawFooterStats(ctx, W, H,
    `${won ? '+' : '-'}${fmt(bet)} 💰  •  Saldo: ${fmt(userBalance)} 💰`,
    `Aposta: ${fmt(bet)} 💰`
  );

  return canvas.toBuffer('image/png');
}

// ─── Dice card (cute) ─────────────────────────────────────────────────────────

const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.25, 0.25], [0.75, 0.75]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.25, 0.22], [0.75, 0.22], [0.25, 0.5], [0.75, 0.5], [0.25, 0.78], [0.75, 0.78]],
};

function drawDie(ctx, x, y, size, value, highlight = false) {
  const r = 18;

  ctx.shadowColor = 'rgba(80,0,120,0.4)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;

  const dieGrad = ctx.createLinearGradient(x, y, x + size, y + size);
  if (highlight) {
    dieGrad.addColorStop(0, '#F0E8FF');
    dieGrad.addColorStop(1, '#DDD0F8');
  } else {
    dieGrad.addColorStop(0, '#FFFFFF');
    dieGrad.addColorStop(1, '#F0F0F8');
  }
  ctx.fillStyle = dieGrad;
  roundRect(ctx, x, y, size, size, r); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  ctx.strokeStyle = highlight ? '#9B4FD6' : 'rgba(160,130,210,0.5)'; ctx.lineWidth = 2.5;
  roundRect(ctx, x, y, size, size, r); ctx.stroke();

  ctx.fillStyle = highlight ? '#7A1DB8' : '#5A4A8A';
  (PIPS[value] || []).forEach(([px, py]) => {
    const dot = size * 0.11;
    ctx.beginPath(); ctx.arc(x + px * size, y + py * size, dot, 0, Math.PI * 2); ctx.fill();
  });
}

export function generateDiceCard({ playerDie, botDie, won, tie, bet, payout, userBalance }) {
  const W = 700, H = 390;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  drawCuteBg(ctx, W, H, won ? ['#1E3A5A', '#2E5C8A', '#4A7EB8'] : tie ? ['#2A3A1A', '#3A5A2A', '#5A7A3A'] : ['#3A1E2A', '#5A2E3A', '#7A4A5A']);

  for (const [sx, sy] of [[60,50],[620,60],[80,320],[600,310],[350,50]]) {
    drawSparkle(ctx, sx, sy, 11, 'rgba(255,255,255,0.2)');
  }

  const accent = won ? '#B0E0FF' : tie ? '#C0FFB0' : '#FFB0C0';
  drawCuteHeader(ctx, W, '🎲  J O G O  D E  D A D O S  🎲', accent, won ? '#0A2040' : tie ? '#0A2A0A' : '#2A0A14');

  // Player/Bot labels
  ctx.font = `bold 15px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('✦ VOCÊ ✦', W / 2 - 125, 102);
  ctx.fillText('✦ BOT ✦', W / 2 + 125, 102);

  const dSize = 130, dY = 120;
  drawDie(ctx, W / 2 - 190, dY, dSize, playerDie, won || tie);
  drawDie(ctx, W / 2 + 60,  dY, dSize, botDie,    false);

  // VS badge
  const vsBg = ctx.createRadialGradient(W/2, dY + dSize/2, 5, W/2, dY + dSize/2, 28);
  vsBg.addColorStop(0, 'rgba(255,220,80,0.9)');
  vsBg.addColorStop(1, 'rgba(200,140,20,0.85)');
  ctx.fillStyle = vsBg;
  ctx.beginPath(); ctx.arc(W/2, dY + dSize/2, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3A2000'; ctx.font = `bold 15px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('VS', W/2, dY + dSize/2 + 5);

  const resText = won ? '🎉  VOCÊ GANHOU!' : tie ? '🤝  EMPATE!' : '🤖  BOT GANHOU';
  const rFrom   = won ? '#1A6A2A' : tie ? '#1A4A8A' : '#8A1A2A';
  const rTo     = won ? '#2ECC70' : tie ? '#3A80F0' : '#D63060';
  drawResultBanner(ctx, W, 280, resText, rFrom, rTo, '#FFFFFF');

  const change = tie ? 0 : won ? payout - bet : bet;
  const sign   = won ? '+' : tie ? '±' : '-';
  drawFooterStats(ctx, W, H,
    `${sign}${fmt(change)} 💰  •  Saldo: ${fmt(userBalance)} 💰`,
    `Aposta: ${fmt(bet)} 💰`
  );

  return canvas.toBuffer('image/png');
}

// ─── Slots card (cute kawaii) ─────────────────────────────────────────────────

export function generateSlotsCard({ reels, won, betAmount, changeAmount, userBalance, multiplier }) {
  const W = 700, H = 400;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  drawCuteBg(ctx, W, H, won ? ['#3A1054', '#6A1E8A', '#9B2FD6'] : ['#1A1A3A', '#2A2050', '#3A2870']);

  for (const [sx, sy] of [[50,45],[640,55],[80,340],[600,330],[350,40],[200,360]]) {
    drawSparkle(ctx, sx, sy, 12, won ? 'rgba(255,200,80,0.45)' : 'rgba(180,160,255,0.25)');
  }

  drawCuteHeader(ctx, W, '🌸  C A Ç A - N Í Q U E L  🌸', won ? '#FFE0A0' : '#C0B0FF', won ? '#3A0A5A' : '#0A0A2A');

  // Machine body — soft rounded
  const machBg = ctx.createLinearGradient(20, 58, 20, 58 + 200);
  machBg.addColorStop(0, 'rgba(255,255,255,0.10)');
  machBg.addColorStop(1, 'rgba(255,255,255,0.04)');
  ctx.fillStyle = machBg;
  roundRect(ctx, 20, 58, W - 40, 200, 18); ctx.fill();
  ctx.strokeStyle = won ? 'rgba(255,200,80,0.5)' : 'rgba(180,150,255,0.3)'; ctx.lineWidth = 2;
  roundRect(ctx, 20, 58, W - 40, 200, 18); ctx.stroke();

  // Center win line
  ctx.strokeStyle = won ? 'rgba(255,210,60,0.6)' : 'rgba(150,130,210,0.2)'; ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 5]);
  ctx.beginPath(); ctx.moveTo(36, 162); ctx.lineTo(W - 36, 162); ctx.stroke();
  ctx.setLineDash([]);

  // Reel boxes
  const reelW = 140, reelH = 148, gap = (W - 40 - 3 * reelW) / 4;
  const allMatch = reels.every(s => s === reels[0]);

  reels.forEach((sym, i) => {
    const rx = 20 + gap + i * (reelW + gap);
    const ry = 80;

    const reelGrad = ctx.createLinearGradient(rx, ry, rx, ry + reelH);
    if (allMatch) {
      reelGrad.addColorStop(0, 'rgba(255,230,80,0.25)');
      reelGrad.addColorStop(1, 'rgba(255,180,20,0.15)');
    } else {
      reelGrad.addColorStop(0, 'rgba(255,255,255,0.10)');
      reelGrad.addColorStop(1, 'rgba(255,255,255,0.04)');
    }
    ctx.fillStyle = reelGrad;
    roundRect(ctx, rx, ry, reelW, reelH, 14); ctx.fill();

    ctx.strokeStyle = allMatch ? 'rgba(255,210,60,0.9)' : 'rgba(180,150,255,0.35)';
    ctx.lineWidth = allMatch ? 2.5 : 1.5;
    roundRect(ctx, rx, ry, reelW, reelH, 14); ctx.stroke();

    // Symbol
    ctx.font = `64px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(sym, rx + reelW / 2, ry + reelH / 2 + 22);
  });

  // Multiplier badge
  if (won && multiplier) {
    const mbg = ctx.createLinearGradient(W/2 - 70, 270, W/2 + 70, 298);
    mbg.addColorStop(0, '#F5C518');
    mbg.addColorStop(1, '#E0A010');
    ctx.fillStyle = mbg;
    roundRect(ctx, W/2 - 70, 270, 140, 30, 15); ctx.fill();
    ctx.fillStyle = '#3A2000';
    ctx.font = `bold 14px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(`✨ ${multiplier}× MULTIPLICADOR ✨`, W/2, 290);
  }

  const resText = won ? `🎉  +${fmt(changeAmount)} 💰` : `💔  -${fmt(changeAmount)} 💰`;
  ctx.fillStyle = won ? '#88FFB8' : '#FFB0B8';
  ctx.font      = `bold 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(resText, W/2, 330);

  drawFooterStats(ctx, W, H,
    `Saldo: ${fmt(userBalance)} 💰`,
    `Aposta: ${fmt(betAmount)} 💰`
  );

  return canvas.toBuffer('image/png');
}

// ─── Roulette card (cute) ─────────────────────────────────────────────────────

const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

export function generateRouletteCard({ spin, escolha, won, bet, winAmt, userBalance, mult }) {
  const W = 700, H = 400;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  const isRed   = RED_NUMS.has(spin);
  const isGreen = spin === 0;

  const bgColors = isGreen
    ? ['#0A3A1A', '#1A5A2A', '#2A7A3A']
    : isRed
    ? ['#3A0A1A', '#6A1A2A', '#9A2A3A']
    : ['#1A1A3A', '#2A2A5A', '#3A3A7A'];

  drawCuteBg(ctx, W, H, bgColors);

  for (const [sx, sy] of [[60,50],[620,60],[80,330],[600,320],[350,50]]) {
    drawSparkle(ctx, sx, sy, 11, 'rgba(255,255,255,0.2)');
  }

  drawCuteHeader(ctx, W, '🎡  R O L E T A  🎡', '#FFE0FF', '#2A0A3A');

  // Wheel
  const wx = W / 2, wy = 185, wr = 110;

  const outerRing = ctx.createRadialGradient(wx - 30, wy - 30, 20, wx, wy, wr + 10);
  outerRing.addColorStop(0, 'rgba(255,200,255,0.25)');
  outerRing.addColorStop(1, 'rgba(180,100,220,0.15)');
  ctx.fillStyle = outerRing;
  ctx.beginPath(); ctx.arc(wx, wy, wr + 18, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = 'rgba(200,150,255,0.7)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(wx, wy, wr + 10, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,150,255,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(wx, wy, wr + 2, 0, Math.PI * 2); ctx.stroke();

  // Inner disc
  const spinCol = isGreen ? '#1E8A3A' : isRed ? '#CC1A3A' : '#2A2A5A';
  const discGrad = ctx.createRadialGradient(wx - 25, wy - 25, 15, wx, wy, wr);
  discGrad.addColorStop(0, isGreen ? '#3ACC6A' : isRed ? '#F03060' : '#4A4A9A');
  discGrad.addColorStop(1, spinCol);
  ctx.fillStyle = discGrad;
  ctx.shadowColor = spinCol; ctx.shadowBlur = 35;
  ctx.beginPath(); ctx.arc(wx, wy, wr - 4, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#FFFFFF'; ctx.font = `bold 58px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(String(spin), wx, wy + 20);

  const colLabel = isGreen ? '🟢 Verde' : isRed ? '🔴 Vermelho' : '⚫ Preto';
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `14px ${FONT}`;
  ctx.fillText(colLabel, W/2, wy + wr + 22);

  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `13px ${FONT}`;
  ctx.fillText(`Você apostou em: ${escolha.toUpperCase()}`, W/2, wy + wr + 44);

  const resText = won ? `🎉  GANHOU  (×${mult})` : '💔  PERDEU';
  const rFrom   = won ? '#1A7A3A' : '#8A1A2A';
  const rTo     = won ? '#3ACC70' : '#D03050';
  drawResultBanner(ctx, W, 315, resText, rFrom, rTo, '#FFFFFF');

  const change = won ? winAmt - bet : bet;
  const sign   = won ? '+' : '-';
  drawFooterStats(ctx, W, H,
    `${sign}${fmt(change)} 💰  •  Saldo: ${fmt(userBalance)} 💰`,
    `Aposta: ${fmt(bet)} 💰`
  );

  return canvas.toBuffer('image/png');
}


// Shared Substancy economy visual identity. Actual amounts are rendered at request time.
const ECO_PALETTES={
  daily:['#392435','#ad668c','#ffc8dd','#fff5f8'],
  weekly:['#27263e','#7678ba','#c9d4ff','#f5f7ff'],
  monthly:['#392735','#a97551','#f6cc84','#fff6e4'],
  work:['#20383b','#559b91','#bbede3','#f3fffa'],
  wallet:['#211b2c','#563b55','#f8c1dc','#fff4f9']
};
const ECO_PAPER={daily:['#fff5f6','#f3d1df'],weekly:['#f5f5ff','#dbe1f7'],monthly:['#fff9e8','#f5ddbc'],work:['#f1faf5','#cfe7de']};
const ECO_PI=Math.PI*2;
function ecoShape(ctx,points,fill,stroke=null,width=1){
  ctx.beginPath();ctx.moveTo(...points[0]);for(const point of points.slice(1))ctx.lineTo(...point);ctx.closePath();
  ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function ecoOval(ctx,x,y,rx,ry,fill,stroke=null,width=1){
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,ECO_PI);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function ecoGrad(ctx,x,y,x2,y2,colors){const g=ctx.createLinearGradient(x,y,x2,y2);colors.forEach((c,i)=>g.addColorStop(i/(colors.length-1),c));return g;}
function ecoRound(ctx,x,y,w,h,r,fill,stroke=null,width=1){
  roundRect(ctx,x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function ecoStar(ctx,x,y,r,color,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;ctx.beginPath();ctx.moveTo(x,y-r);ctx.quadraticCurveTo(x+r*.12,y-r*.12,x+r*.7,y);ctx.quadraticCurveTo(x+r*.12,y+r*.12,x,y+r);ctx.quadraticCurveTo(x-r*.12,y+r*.12,x-r*.7,y);ctx.quadraticCurveTo(x-r*.12,y-r*.12,x,y-r);ctx.fillStyle=color;ctx.fill();ctx.restore();
}
function ecoHeart(ctx,x,y,r,fill){
  ctx.beginPath();ctx.moveTo(x,y+r*.85);ctx.bezierCurveTo(x-r*1.7,y-r*.15,x-r*.6,y-r*1.5,x,y-r*.5);ctx.bezierCurveTo(x+r*.6,y-r*1.5,x+r*1.7,y-r*.15,x,y+r*.85);ctx.fillStyle=fill;ctx.fill();
}
function ecoBow(ctx,x,y,s,p){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  const silk=ecoGrad(ctx,-30,-18,35,24,[p[2],p[1],p[2]]);
  for(const side of [-1,1]){
    ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(side*38,-31,side*55,-26,side*40,5);ctx.bezierCurveTo(side*35,20,side*12,8,0,0);ctx.fillStyle=silk;ctx.fill();ctx.strokeStyle=p[0];ctx.lineWidth=1.4;ctx.stroke();
    ecoShape(ctx,[[0,2],[side*12,7],[side*30,32],[side*15,26],[side*9,36]],p[1],p[0],1);
    ctx.beginPath();ctx.moveTo(side*5,0);ctx.quadraticCurveTo(side*23,-12,side*35,-11);ctx.strokeStyle=p[3];ctx.lineWidth=1.5;ctx.stroke();
  }
  ecoRound(ctx,-7,-7,14,14,5,p[2],p[0],1.2);ctx.restore();
}
function ecoCoin(ctx,x,y,r,tilt=0){
  ctx.save();ctx.translate(x,y);ctx.rotate(tilt);
  const metal=ecoGrad(ctx,-r,-r,r,r,['#fff0b8','#df9b3d','#fff2b6','#a8612b']);
  ecoOval(ctx,3,4,r*.82,r, '#a7612f','#86502b',1);ecoOval(ctx,0,0,r*.82,r,metal,'#a86c2f',1.1);
  ecoOval(ctx,0,0,r*.61,r*.78,'#ffdc83','#b57935',1.2);
  ecoStar(ctx,0,0,r*.48,'#b47836');ctx.beginPath();ctx.arc(-1,-1,r*.65,-2.65,-1.1);ctx.strokeStyle='#fff5d3';ctx.lineWidth=1.8;ctx.stroke();ctx.restore();
}
function ecoMascot(ctx,x,y,s,p,pose='peek'){
  // Original sticker-like rabbit mascot: ink outline, soft shading, rosy cheeks and satin bow.
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  const ink='#694657',fur=ecoGrad(ctx,-42,-70,55,40,['#fffef7','#fff1ec','#f3d2d3']);
  for(const [dx,rot] of [[-24,-.22],[22,.22]]){
    ctx.save();ctx.translate(dx,-30);ctx.rotate(rot);ecoOval(ctx,0,-37,16,43,fur,ink,2.8);ecoOval(ctx,0,-39,8,28,'#efb2c7');ecoOval(ctx,-3,-51,2,10,'#fff7f5');ctx.restore();
  }
  ecoOval(ctx,0,15,46,42,fur,ink,2.8);ecoOval(ctx,-16,9,3.9,6,ink);ecoOval(ctx,16,9,3.9,6,ink);
  ecoOval(ctx,-17,7,1.2,1.7,'#ffffff');ecoOval(ctx,15,7,1.2,1.7,'#ffffff');
  ecoOval(ctx,-28,22,8,4.5,'#eba2b7');ecoOval(ctx,28,22,8,4.5,'#eba2b7');
  ecoHeart(ctx,0,16,4,'#c47c90');
  ctx.beginPath();ctx.moveTo(-7,23);ctx.quadraticCurveTo(-3,28,0,23);ctx.quadraticCurveTo(4,28,8,23);ctx.strokeStyle=ink;ctx.lineWidth=1.5;ctx.stroke();
  ecoBow(ctx,33,-13,.38,p);
  if(pose==='peek'){ecoOval(ctx,-30,51,13,10,fur,ink,2);ecoOval(ctx,30,51,13,10,fur,ink,2);}
  ctx.restore();
}
function ecoLace(ctx,x,y,w,h,color){
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1.2;roundRect(ctx,x,y,w,h,20);ctx.stroke();roundRect(ctx,x+5,y+5,w-10,h-10,16);ctx.stroke();
  for(let i=0;i<4;i++){const a=x+17+i*8;ecoOval(ctx,a,y+2,1.4,1.4,color);ecoOval(ctx,x+w-17-i*8,y+h-2,1.4,1.4,color);}
  ctx.restore();
}
const validColor=(c,f)=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c)?c:f;
function econText(ctx,str,x,y,size,color,width=1000,bold=true,align='left'){
  ctx.save();ctx.textAlign=align;ctx.fillStyle=color;let n=size;str=String(str??'');
  ctx.font=(bold?'bold ':'')+n+'px '+FONT;
  while(n>12&&ctx.measureText(str).width>width){ctx.font=(bold?'bold ':'')+(--n)+'px '+FONT;}
  ctx.fillText(truncateText(ctx,str,width),x,y);ctx.restore();
}
function econPanel(ctx,x,y,w,h,fill,stroke,r=20){
  ctx.save();ctx.shadowColor='#140c253b';ctx.shadowBlur=12;ctx.shadowOffsetY=5;
  roundRect(ctx,x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();ctx.restore();
  roundRect(ctx,x,y,w,h,r);ctx.strokeStyle=stroke;ctx.lineWidth=1.3;ctx.stroke();
}
function econBackdrop(ctx,w,h,p){
  ctx.fillStyle=ecoGrad(ctx,0,0,w,h,[p[0],p[1],p[0]]);ctx.fillRect(0,0,w,h);
  const g=ctx.createRadialGradient(w*.82,h*.1,0,w*.82,h*.1,w*.65);g.addColorStop(0,p[2]+'42');g.addColorStop(1,p[2]+'00');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.globalAlpha=.07;ctx.strokeStyle=p[3];ctx.lineWidth=1;
  for(let x=-h;x<w;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+h,h);ctx.stroke();}
  ctx.restore();ecoLace(ctx,9,9,w-18,h-18,p[2]+'65');
}
function ecoPaper(ctx,w,h,kind,p){
  ctx.fillStyle=ecoGrad(ctx,0,0,w,h,ECO_PAPER[kind]);ctx.fillRect(0,0,w,h);
  ctx.save();ctx.globalAlpha=.23;ctx.strokeStyle=p[1];ctx.lineWidth=.7;
  for(let x=20;x<w;x+=25)for(let y=20;y<h;y+=25){ctx.beginPath();ctx.arc(x,y,.7,0,ECO_PI);ctx.stroke();}
  ctx.restore();ecoLace(ctx,9,9,w-18,h-18,p[1]+'95');
  // A restrained scalloped ribbon separates the illustrated scene from the receipt.
  ctx.save();roundRect(ctx,445,19,256,h-38,24);ctx.clip();
  ctx.fillStyle=ecoGrad(ctx,445,19,701,h,[p[2],ECO_PAPER[kind][0],p[2]]);ctx.fillRect(445,19,256,h-38);
  ctx.strokeStyle=p[1]+'36';ctx.lineWidth=1;
  for(let x=230;x<800;x+=22){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+360,380);ctx.stroke();}
  ctx.restore();ecoLace(ctx,445,19,256,h-38,p[1]+'88');
}
function chest(ctx,x,y,s,p,phase,opened=true){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  const ink=p[0],metal=ecoGrad(ctx,-100,-65,85,75,[p[3],p[2],p[1],p[2],p[3]]);
  const cloth=ecoGrad(ctx,-85,-35,82,75,[p[1],p[0],p[1]]);
  const a=opened?Math.min(1,phase*4):0,ease=a*a*(3-2*a),lift=36*ease;
  ecoOval(ctx,6,66,103,17,'#4d32472a');ecoOval(ctx,0,61,86,10,'#4d32471a');
  // Three-quarter perspective: carved side, lid, bevels, lock and metal corner caps.
  ecoShape(ctx,[[70,-17],[100,-35],[100,41],[70,64]],p[0],ink,2.4);
  ecoShape(ctx,[[70,-17],[100,-35],[99,-27],[70,-8]],p[2],ink,1);
  ecoRound(ctx,-86,-18,158,83,12,cloth,ink,2.5);ecoRound(ctx,-79,-10,144,66,9,cloth,p[2],2);
  for(const left of [-73,43]){
    ecoRound(ctx,left,-16,20,79,4,metal,ink,1.3);
    for(const yy of [-9,49])ecoOval(ctx,left+10,yy,2.7,2.7,p[0],p[3],.7);
  }
  ctx.save();ctx.globalAlpha=ease;
  for(let i=0;i<6;i++)ecoCoin(ctx,-54+i*22,-26-(i%2)*13,14,(i-3)*.18);
  for(let i=0;i<3;i++)ecoStar(ctx,-36+i*36,-59-8*Math.sin(phase*ECO_PI+i),10,p[3],ease);
  ctx.restore();
  ctx.save();ctx.translate(0,-lift);
  ctx.beginPath();ctx.moveTo(-91,-18);ctx.bezierCurveTo(-94,-79,-50,-86,-6,-85);ctx.bezierCurveTo(38,-87,76,-73,77,-18);ctx.closePath();
  ctx.fillStyle=cloth;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=2.5;ctx.stroke();
  ecoShape(ctx,[[77,-18],[100,-36],[95,-65],[74,-74],[60,-78]],p[0],ink,2);
  ctx.beginPath();ctx.moveTo(-82,-25);ctx.bezierCurveTo(-81,-67,-42,-77,-6,-76);ctx.bezierCurveTo(35,-78,66,-63,68,-25);ctx.strokeStyle=p[2];ctx.lineWidth=3;ctx.stroke();
  for(const left of [-69,43]){ecoRound(ctx,left,-68,18,48,7,metal,ink,1.3);}
  ecoRound(ctx,-92,-27,170,14,5,metal,ink,1.3);ctx.restore();
  ecoRound(ctx,-22,-18,38,40,9,metal,ink,2);ecoOval(ctx,-3,-1,6,6,ink);ecoShape(ctx,[[-6,1],[0,1],[2,10],[-8,10]],ink);
  ecoOval(ctx,-3,-10,2,2,p[3]);
  for(let i=0;i<3;i++)ecoCoin(ctx,69+i*10,58-i*4,13,(i-1)*.35);
  ctx.restore();
}
function gift(ctx,x,y,s,p,phase,opened){
  ctx.save();ctx.translate(x,y+Math.sin(phase*ECO_PI)*2);ctx.scale(s,s);
  ecoOval(ctx,0,65,99,14,'#75435822');
  const wrap=ecoGrad(ctx,-70,-40,85,65,['#f8bbcf','#da7ea6','#f5b5d2']),ribbon=ecoGrad(ctx,-10,-45,15,65,['#fff2de','#d9a775','#fff2de']);
  const lift=opened?12*Math.sin(Math.min(1,phase*2)*Math.PI/2):0;
  ecoShape(ctx,[[60,-22],[95,-42],[95,41],[60,64]],'#b66a93',p[0],1.6);
  ecoRound(ctx,-70,-25,132,90,10,wrap,p[0],1.8);
  for(let xx=-56;xx<55;xx+=18)for(let yy=-9;yy<55;yy+=19)ecoHeart(ctx,xx,yy,3.1,'#fff0f4a0');
  ecoRound(ctx,-13,-25,26,90,2,ribbon,'#c99c73',1);
  ctx.save();ctx.translate(0,-lift);
  ecoShape(ctx,[[-78,-43],[-45,-61],[95,-61],[69,-43]],'#ffe0e8',p[0],1.6);
  ecoShape(ctx,[[69,-43],[95,-61],[95,-36],[69,-19]],'#bb729b',p[0],1.5);
  ecoRound(ctx,-78,-45,148,26,6,wrap,p[0],1.8);ecoRound(ctx,-13,-45,26,26,2,ribbon,'#c99c73',1);
  ecoBow(ctx,-1,-49,.87,['#7e4a5c','#d6a075','#ffe9c5','#fff8e7']);ctx.restore();
  ecoCoin(ctx,-60,66,16,-.35);ecoCoin(ctx,78,60,17,.35);ctx.restore();
}
function workSymbol(ctx,x,y,s,key,p){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  const ink='#31534f',jade=ecoGrad(ctx,-60,-60,60,60,['#f5fff9','#a5d5c6','#5f9c94']);
  ecoOval(ctx,0,63,92,15,'#31534f20');
  if(key==='entregador'){
    ecoShape(ctx,[[-75,-22],[-40,-55],[76,-55],[42,-22]],'#fff2d4',ink,2);ecoRound(ctx,-75,-22,117,66,7,'#e2bd90',ink,2);ecoShape(ctx,[[42,-22],[76,-55],[76,15],[42,44]],'#ba946d',ink,2);
    ecoOval(ctx,-16,-17,45,27,'#d3a06b',ink,2);ecoOval(ctx,-16,-19,39,22,'#f8d688');
    for(let i=0;i<7;i++){const a=i*ECO_PI/7;ecoOval(ctx,-16+Math.cos(a)*27,-19+Math.sin(a)*14,6,4,'#bf6759');}
  }else if(key==='freelancer'){
    ecoRound(ctx,-72,-71,144,102,9,jade,ink,2);ecoRound(ctx,-63,-62,126,82,5,'#203b3b',ink,1);
    for(let i=0;i<5;i++){ecoRound(ctx,-51,-49+i*12,30+(i%3)*16,4,2,i%2?'#edc0d6':'#b6e3cb');}
    ecoShape(ctx,[[-72,31],[72,31],[94,53],[-94,53]],jade,ink,2);ecoRound(ctx,-20,37,40,7,3,'#6b9a93');
  }else if(key==='investidor'){
    ecoRound(ctx,-73,-63,146,116,12,'#fbfff8',ink,2);
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-60,-35+i*25);ctx.lineTo(60,-35+i*25);ctx.strokeStyle='#c7ded5';ctx.lineWidth=1;ctx.stroke();}
    for(let i=0;i<4;i++)ecoRound(ctx,-55+i*29,40-[23,47,36,76][i],20,[23,47,36,76][i],4,jade,ink,1);
    ctx.beginPath();ctx.moveTo(-57,-4);ctx.lineTo(-24,-25);ctx.lineTo(3,-17);ctx.lineTo(54,-49);ctx.strokeStyle=ink;ctx.lineWidth=3;ctx.stroke();ecoCoin(ctx,59,42,19,.25);
  }else{
    ecoRound(ctx,-72,-37,144,90,10,jade,ink,2);ecoRound(ctx,-22,-60,44,23,8,'#e4f5ea',ink,2);
    ecoShape(ctx,[[-72,-28],[72,-28],[72,3],[0,17],[-72,3]],'#d7eae0',ink,1.5);
    ecoRound(ctx,-12,5,24,22,4,'#eac98b',ink,1.2);
    if(key==='magnata'){ecoShape(ctx,[[-42,-58],[-48,-93],[-24,-73],[0,-101],[24,-73],[48,-93],[42,-58]],'#f4ce7f','#8c6136',2);ecoStar(ctx,0,-76,9,'#fff6dc');}
  }
  ctx.restore();
}
function drawRewardFrame(ctx,kind,data,phase,w=720,h=380){
  const p=ECO_PALETTES[kind]??ECO_PALETTES.work;ecoPaper(ctx,w,h,kind,p);
  const names={daily:'Recompensa diária',weekly:'Baú semanal',monthly:'Baú mensal',work:'Central de trabalho'};
  const serial={daily:'01  /  DAILY',weekly:'02  /  WEEKLY',monthly:'03  /  MONTHLY',work:'04  /  CAREER'};
  const claimed=data.amount!=null,ink=p[0];
  econText(ctx,'S U B S T A N C Y',31,43,13,ink,390,true);
  econText(ctx,serial[kind],31,65,11,p[1],390,true);
  econText(ctx,names[kind],29,105,34,ink,398);
  ecoRound(ctx,30,122,398,93,17,'#ffffffb5',p[1]+'8c',1);
  econText(ctx,claimed?'RECOMPENSA RECEBIDA':data.subtitle??'PRÓXIMA RECOMPENSA',47,146,12,p[1],365,true);
  if(claimed){ecoCoin(ctx,65,180,17,-.14);econText(ctx,'+'+fmt(data.amount),91,192,43,ink,240);econText(ctx,'COINS',337,189,13,p[1],73,true);}
  else econText(ctx,data.status??'Disponível',46,187,34,ink,365);
  // The character and illustrated prop form a separate hero scene; text never intersects the art.
  ecoMascot(ctx,576,99,.66,p);
  if(kind==='daily')gift(ctx,573,225,.96,p,phase,claimed);
  else if(kind==='weekly'||kind==='monthly')chest(ctx,572,222,.98,p,phase,claimed);
  else workSymbol(ctx,575,221,.99,data.job,p);
  for(const [i,x,y] of [[0,466,115],[1,681,92],[2,478,285],[3,679,290],[4,657,143],[5,492,164]]){
    ecoStar(ctx,x,y,8+(i%3)*3,p[1],claimed?.35+.55*(.5+.5*Math.sin(phase*ECO_PI+i)):.65);
  }
  ecoBow(ctx,574,322,.46,p);
  if(kind==='daily'){
    const streak=data.streak??0,day=streak?((streak-1)%7)+1:0;
    econText(ctx,'Sequência de '+streak+' dias',30,242,19,ink,240);econText(ctx,'+'+(data.bonus??0)+'%',427,242,16,p[1],100,true,'right');
    for(let i=1;i<=7;i++){
      const x=30+(i-1)*57,done=i<=day;ecoRound(ctx,x,255,51,54,10,done?p[1]:'#ffffffa0',p[1]+'85',1);
      econText(ctx,String(i),x+25.5,274,12,done?p[3]:ink,45,true,'center');
      if(done){ctx.beginPath();ctx.moveTo(x+18,290);ctx.lineTo(x+23,295);ctx.lineTo(x+34,283);ctx.strokeStyle=p[3];ctx.lineWidth=2.8;ctx.lineCap='round';ctx.stroke();}
      else ecoStar(ctx,x+25,291,7,p[1],.65);
    }
    econText(ctx,dailyMilestones(streak).map(m=>(m.achieved?'✓ ':'○ ')+m.day+' dias').join('     '),31,340,14,ink,396,false);
  }else{
    ecoRound(ctx,30,231,398,109,15,'#ffffff78',p[1]+'70',1);
    econText(ctx,data.detail??(kind==='weekly'?'Recompensa a cada 7 dias':'Recompensa a cada 30 dias'),47,271,20,ink,366);
    econText(ctx,data.footer??'Coins adicionados à carteira',47,303,15,p[0],366,false);
  }
}
export function generateEconomyRewardArt(kind,data={},animated=false){
  const W=720,H=380,c=createCanvas(W,H),ctx=c.getContext('2d');
  if(!animated){drawRewardFrame(ctx,kind,data,1,W,H);return c.toBuffer('image/png');}
  const enc=new GifEncoder(W,H,{repeat:0,quality:8});
  try{
    // 30 genuine frames / 1.2 seconds, then a short readable hold.
    for(let i=0;i<30;i++){
      drawRewardFrame(ctx,kind,data,i/30,W,H);
      const rgba=ctx.getImageData(0,0,W,H).data;enc.addFrame(new Uint8Array(rgba.buffer,rgba.byteOffset,rgba.byteLength),W,H,{delay:i===29?640:40});
    }
    const gif=enc.finish();if(gif.length<=8*1024*1024)return gif;
  }finally{enc.dispose();}
  drawRewardFrame(ctx,kind,data,1,W,H);return c.toBuffer('image/png');
}
async function generateWalletDashboard({username,avatarUrl,balance,bank,dashboard,cardBg1,cardBg2,cardPanelColor,walletRing,walletRingBorder,walletBg}){
  const W=900,H=760,c=createCanvas(W,H),ctx=c.getContext('2d'),p=[...ECO_PALETTES.wallet];
  p[0]=validColor(cardBg1,p[0]);p[1]=validColor(cardBg2,p[1]);econBackdrop(ctx,W,H,p);
  // Keep the user-selected background as an actual background, with readable panels.
  if(walletBg&&/^https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\//i.test(walletBg)){
    try{const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),3500);try{const r=await fetch(walletBg,{signal:ctrl.signal,redirect:'error'});if(r.ok){const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length<=8*1024*1024){const im=await loadImage(bytes);const scale=Math.max(W/im.width,H/im.height);ctx.drawImage(im,(W-im.width*scale)/2,(H-im.height*scale)/2,im.width*scale,im.height*scale);ctx.fillStyle='#16101fa8';ctx.fillRect(0,0,W,H);}}}finally{clearTimeout(timer);}}catch{}
  }
  const panel=validColor(cardPanelColor,'#302537'),rgb=[1,3,5].map(i=>parseInt(panel.slice(i,i+2),16));
  const light=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>150;
  const ink='#fff5f9',accent=p[2],panelInk=light?'#35243a':ink,panelAccent=light?'#855074':accent;
  const av=await loadAvatarImg(avatarUrl,256),cx=793,cy=88,r=46;
  ecoOval(ctx,cx,cy,r+10,r+10,'#f8c1dc20',accent,1);
  ctx.strokeStyle=validColor(walletRingBorder,accent);ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,cy,r+5,0,ECO_PI);ctx.stroke();
  if(walletRing)await drawAvatarRing(ctx,cx,cy,r+4,walletRing);
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,ECO_PI);ctx.clip();if(av)ctx.drawImage(av,cx-r,cy-r,r*2,r*2);else drawAvatarFallback(ctx,cx-r,cy-r,r*2,username);ctx.restore();
  econText(ctx,'S U B S T A N C Y   /   B A N K',34,47,15,accent,690);
  econText(ctx,'Minha carteira',31,97,46,ink,680);
  econText(ctx,username??'Usuário',35,130,21,accent,690,false);
  ecoStar(ctx,723,45,11,accent,.8);ecoStar(ctx,851,131,9,accent,.8);
  // A single hero balance card, with the other two balances grouped below.
  const total=Number(balance||0)+Number(bank||0);
  const cardGrad=ecoGrad(ctx,28,154,872,298,['#f8d6e4','#efd3dd','#c997ba']);
  ecoRound(ctx,28,154,844,150,22,cardGrad,'#fff1fa',1.5);ecoLace(ctx,36,162,828,134,'#a06c9366');
  econText(ctx,'PATRIMÔNIO TOTAL',51,188,15,'#69465c',580);
  econText(ctx,fmt(total),48,251,59,'#362337',600);
  econText(ctx,'C O I N S',53,278,13,'#69465c',580,true);
  ctx.save();ctx.translate(765,221);ctx.rotate(-.12);
  ecoRound(ctx,-62,-35,120,74,11,'#a8618b','#69465c',2);ecoRound(ctx,-67,-30,126,70,10,'#d99cba','#69465c',1.5);
  ecoRound(ctx,-48,-23,91,44,5,'#fff0db','#b08277',1);ecoRound(ctx,-67,-4,126,44,9,'#ce86aa','#69465c',1.5);
  ecoRound(ctx,20,7,44,22,7,'#f2c7d9','#69465c',1);ecoOval(ctx,42,18,4,4,'#9a647c');ctx.restore();
  ecoCoin(ctx,831,266,22,.25);ecoCoin(ctx,706,265,17,-.3);ecoStar(ctx,844,184,13,'#fff7fa');ecoBow(ctx,681,184,.36,['#764e69','#b37a9a','#f8d3e6','#fff4f9']);
  for(const [i,label,n] of [[0,'Carteira',balance],[1,'Banco',bank]]){
    const x=28+i*430;econPanel(ctx,x,318,414,93,panel,accent+'80',18);
    econText(ctx,label,x+20,347,17,panelAccent,330);econText(ctx,fmt(n),x+18,389,34,panelInk,320);
    ecoCoin(ctx,x+373,365,18,i?.2:-.2);
  }
  econText(ctx,'Recompensas',31,447,24,ink,840);
  const short={daily:'D',weekly:'S',monthly:'M',work:'T'};
  for(const [i,item] of (dashboard.status??[]).entries()){
    const x=28+i%2*430,y=462+Math.floor(i/2)*65;
    econPanel(ctx,x,y,414,56,panel,accent+'66',14);
    ecoRound(ctx,x+9,y+8,40,40,11,light?'#efdce7':'#57405a');econText(ctx,short[item.key]??'•',x+29,y+34,19,panelAccent,38,true,'center');
    econText(ctx,item.label,x+61,y+23,16,panelInk,242);
    econText(ctx,timeLeft(item.remaining),x+61,y+43,14,item.ready?(light?'#246b4d':'#a4e7c4'):panelAccent,244,false);
    ecoOval(ctx,x+384,y+28,5,5,item.ready?'#8cdbb0':'#b79ab4');
  }
  const work=workProgressValue(dashboard.workXp),streak=dashboard.streak??0;
  econPanel(ctx,28,603,414,125,panel,accent+'88',18);econPanel(ctx,458,603,414,125,panel,accent+'88',18);
  econText(ctx,'Sequência diária',46,630,17,panelInk,370);econText(ctx,streak+' dias',46,669,31,panelAccent,240);
  econText(ctx,'+'+Math.min(streak,30)*2+'% bônus',419,668,16,panelAccent,135,true,'right');
  econText(ctx,dailyMilestones(streak).map(m=>(m.achieved?'✓ ':'○ ')+m.day+'d').join('    '),46,706,15,panelInk,373,false);
  econText(ctx,'Carreira',477,630,17,panelInk,370);econText(ctx,'Nível '+work.level+' / 10',477,669,29,panelAccent,370);
  ecoRound(ctx,477,684,375,9,4,light?'#e1c9db':'#ffffff33');
  if(work.progress>0)ecoRound(ctx,477,684,Math.max(8,375*work.progress),9,4,panelAccent);
  econText(ctx,(dashboard.workXp??0)+' XP trabalhista',477,714,13,panelInk,370,false);
  return c.toBuffer('image/png');
}
