'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface SlideCanvasHandle {
  toDataURL: () => string;
  toBlob: (cb: (blob: Blob | null) => void) => void;
}

export interface CarouselSlide {
  id: number;
  type: 'cover' | 'content' | 'cta';
  headline: string;
  body?: string;
  emoji?: string;
  highlight?: string;
  number?: string;
}

export interface CarouselTheme {
  name: string;
  bg: string;
  bg2?: string;
  text: string;
  subtext: string;
  accent: string;
  accent2: string;
  isGradient?: boolean;
  isLight?: boolean;
}

export const CAROUSEL_THEMES: Record<string, CarouselTheme> = {
  dark: {
    name: 'Dark Pro',
    bg: '#0a0a0a', bg2: '#1c1c1c',
    text: '#ffffff', subtext: '#a1a1aa',
    accent: '#f59e0b', accent2: '#fbbf24',
  },
  ocean: {
    name: 'Ocean',
    bg: '#0c1445', bg2: '#1a4a7a',
    text: '#ffffff', subtext: '#93c5fd',
    accent: '#38bdf8', accent2: '#7dd3fc',
    isGradient: true,
  },
  minimal: {
    name: 'Minimal',
    bg: '#ffffff', bg2: '#f0f4ff',
    text: '#0f172a', subtext: '#64748b',
    accent: '#6366f1', accent2: '#818cf8',
    isLight: true,
  },
  sunset: {
    name: 'Sunset',
    bg: '#3b0764', bg2: '#be185d',
    text: '#ffffff', subtext: '#fce7f3',
    accent: '#fbbf24', accent2: '#fde68a',
    isGradient: true,
  },
  forest: {
    name: 'Forest',
    bg: '#052e16', bg2: '#14532d',
    text: '#ffffff', subtext: '#86efac',
    accent: '#4ade80', accent2: '#86efac',
    isGradient: true,
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
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

/** Wraps text and returns the y position after the last drawn line. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  maxWidth: number, lineHeight: number,
  align: CanvasTextAlign = 'left'
): number {
  ctx.textAlign = align;
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, currentY);
      line = word + ' ';
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, currentY);
  return currentY;
}

// ─── Background ────────────────────────────────────────────────────────────

function drawBackground(
  ctx: CanvasRenderingContext2D,
  theme: CarouselTheme,
  S: number,
  bgImg?: HTMLImageElement,
) {
  if (bgImg) {
    // Cover-fit: fill canvas maintaining aspect ratio
    const scale = Math.max(S / bgImg.naturalWidth, S / bgImg.naturalHeight);
    const dw = bgImg.naturalWidth * scale;
    const dh = bgImg.naturalHeight * scale;
    ctx.drawImage(bgImg, (S - dw) / 2, (S - dh) / 2, dw, dh);
    // Dark scrim so text stays readable
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(0, 0, S, S);
  } else if (theme.isGradient && theme.bg2) {
    const g = ctx.createLinearGradient(0, 0, S * 0.4, S);
    g.addColorStop(0, theme.bg);
    g.addColorStop(1, theme.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  } else {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, S, S);
  }
}

// ─── Shared decorative chrome ───────────────────────────────────────────────

function drawChrome(ctx: CanvasRenderingContext2D, theme: CarouselTheme, S: number, type: string) {
  // Top accent bar
  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, 0, S * 0.35, 7);

  // Soft bottom strip
  ctx.fillStyle = hexToRgba(theme.accent, 0.08);
  ctx.fillRect(0, S - 96, S, 96);

  // Large decorative circle — bottom right
  ctx.beginPath();
  ctx.arc(S + S * 0.05, S + S * 0.05, S * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(theme.accent, 0.07);
  ctx.fill();

  if (type === 'cover') {
    // Extra circle top right
    ctx.beginPath();
    ctx.arc(S * 0.88, S * 0.14, S * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(theme.accent, 0.09);
    ctx.fill();
  }
}

function drawCounter(ctx: CanvasRenderingContext2D, idx: number, total: number, theme: CarouselTheme, S: number) {
  ctx.font = `500 ${S * 0.027}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = hexToRgba(theme.subtext, 0.55);
  ctx.fillText(`${idx + 1} / ${total}`, S - 56, S - 50);
}

// ─── Slide types ────────────────────────────────────────────────────────────

function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.font = `${size}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, cx, cy);
  ctx.restore();
}

function drawCover(ctx: CanvasRenderingContext2D, slide: CarouselSlide, theme: CarouselTheme, S: number) {
  const pad = S * 0.1;

  if (slide.emoji) drawEmoji(ctx, slide.emoji, S / 2, S * 0.3, S * 0.13);

  // Headline
  const hSize = S * 0.075;
  ctx.font = `800 ${hSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = theme.text;
  ctx.textBaseline = 'alphabetic';
  const lastY = wrapText(ctx, slide.headline.toUpperCase(), S / 2, S * 0.5, S - pad * 2, hSize * 1.2, 'center');

  // Accent underline
  ctx.fillStyle = theme.accent;
  ctx.fillRect(S / 2 - 55, lastY + hSize * 0.4, 110, 6);

  // Body
  if (slide.body) {
    const bSize = S * 0.034;
    ctx.font = `400 ${bSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = theme.subtext;
    wrapText(ctx, slide.body, S / 2, lastY + hSize * 1.1, S - pad * 2.5, bSize * 1.55, 'center');
  }

  // Swipe hint
  ctx.font = `600 ${S * 0.027}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = hexToRgba(theme.accent, 0.85);
  ctx.fillText('Desliza para ver más  →', S / 2, S - 50);
}

function drawContent(ctx: CanvasRenderingContext2D, slide: CarouselSlide, theme: CarouselTheme, S: number) {
  const pad = S * 0.1;
  const leftX = pad;

  // Ghost number (big background text)
  if (slide.number) {
    ctx.font = `900 ${S * 0.3}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = hexToRgba(theme.accent, 0.11);
    ctx.fillText(slide.number, S - pad * 0.4, S * 0.34);
  }

  // Left vertical accent bar
  ctx.fillStyle = theme.accent;
  ctx.fillRect(pad * 0.55, S * 0.2, 5, S * 0.24);

  // Number badge
  if (slide.number) {
    const bW = S * 0.11, bH = S * 0.056, bX = leftX, bY = S * 0.2;
    ctx.fillStyle = theme.accent;
    roundedRect(ctx, bX, bY, bW, bH, 10);
    ctx.fill();
    ctx.font = `800 ${S * 0.033}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.isLight ? '#fff' : '#0a0a0a';
    ctx.fillText(slide.number, bX + bW / 2, bY + bH / 2);
    ctx.textBaseline = 'alphabetic';
  }

  // Emoji (top area, right side)
  if (slide.emoji) drawEmoji(ctx, slide.emoji, S * 0.82, S * 0.27, S * 0.1);

  // Headline
  const hSize = S * 0.066;
  ctx.font = `800 ${hSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = theme.text;
  const lastY = wrapText(ctx, slide.headline, leftX, S * 0.43, S - pad * 2, hSize * 1.28, 'left');

  // Body
  if (slide.body) {
    const bSize = S * 0.036;
    ctx.font = `400 ${bSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = theme.subtext;
    wrapText(ctx, slide.body, leftX, lastY + hSize * 0.85, S - pad * 2, bSize * 1.6, 'left');
  }
}

function drawCTA(ctx: CanvasRenderingContext2D, slide: CarouselSlide, theme: CarouselTheme, S: number) {
  const pad = S * 0.1;

  // Soft glow circle
  ctx.beginPath();
  ctx.arc(S / 2, S * 0.38, S * 0.26, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(theme.accent, 0.12);
  ctx.fill();

  if (slide.emoji) drawEmoji(ctx, slide.emoji, S / 2, S * 0.28, S * 0.13);

  // Headline
  const hSize = S * 0.068;
  ctx.font = `800 ${hSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = theme.text;
  ctx.textBaseline = 'alphabetic';
  wrapText(ctx, slide.headline, S / 2, S * 0.52, S - pad * 2, hSize * 1.25, 'center');

  // CTA button
  if (slide.body) {
    const btnW = S * 0.66, btnH = S * 0.1;
    const btnX = (S - btnW) / 2, btnY = S * 0.67;
    ctx.fillStyle = theme.accent;
    roundedRect(ctx, btnX, btnY, btnW, btnH, btnH / 2);
    ctx.fill();

    ctx.font = `700 ${S * 0.037}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.isLight ? '#ffffff' : '#0a0a0a';
    ctx.fillText(slide.body, S / 2, btnY + btnH / 2);
    ctx.textBaseline = 'alphabetic';
  }
}

// ─── Main draw ──────────────────────────────────────────────────────────────

function drawSlide(
  ctx: CanvasRenderingContext2D,
  slide: CarouselSlide,
  theme: CarouselTheme,
  idx: number,
  total: number,
  S: number,
  bgImg?: HTMLImageElement,
) {
  ctx.clearRect(0, 0, S, S);
  drawBackground(ctx, theme, S, bgImg);
  drawChrome(ctx, theme, S, slide.type);

  switch (slide.type) {
    case 'cover':   drawCover(ctx, slide, theme, S);   break;
    case 'cta':     drawCTA(ctx, slide, theme, S);     break;
    default:        drawContent(ctx, slide, theme, S); break;
  }

  drawCounter(ctx, idx, total, theme, S);
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  slide: CarouselSlide;
  theme: CarouselTheme;
  slideIndex: number;
  totalSlides: number;
  displaySize?: number;
  backgroundImage?: string; // full data URL
}

const CANVAS_SIZE = 1080;

export const SlideCanvas = forwardRef<SlideCanvasHandle, Props>(
  ({ slide, theme, slideIndex, totalSlides, displaySize = 360, backgroundImage }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const bgImgRef  = useRef<HTMLImageElement | null>(null);
    const [bgReady, setBgReady] = useState(false);

    // Load background image whenever the source changes
    useEffect(() => {
      if (!backgroundImage) {
        bgImgRef.current = null;
        setBgReady(false);
        return;
      }
      const img = new Image();
      img.onload = () => { bgImgRef.current = img; setBgReady((v) => !v); };
      img.src = backgroundImage;
    }, [backgroundImage]);

    useImperativeHandle(ref, () => ({
      toDataURL: () => canvasRef.current?.toDataURL('image/jpeg', 0.95) ?? '',
      toBlob: (cb) => {
        if (canvasRef.current) canvasRef.current.toBlob(cb, 'image/jpeg', 0.95);
        else cb(null);
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawSlide(ctx, slide, theme, slideIndex, totalSlides, CANVAS_SIZE, bgImgRef.current ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slide, theme, slideIndex, totalSlides, bgReady]);

    return (
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ width: displaySize, height: displaySize, display: 'block' }}
      />
    );
  }
);

SlideCanvas.displayName = 'SlideCanvas';
