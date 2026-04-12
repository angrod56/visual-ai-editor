'use client';

import { useMemo } from 'react';
import { TranscriptionSegment, TranscriptionWord } from '@/types';
import { cn } from '@/lib/utils';

export type SubtitleDisplayStyle = 'capcut' | 'filled' | 'karaoke' | 'minimal';
export type SubtitleFontSize = 'sm' | 'md' | 'lg' | 'xl';

const FONT_SIZE_MAP: Record<SubtitleFontSize, string> = {
  sm: 'clamp(10px, 2.3vw, 15px)',
  md: 'clamp(13px, 3.2vw, 22px)',
  lg: 'clamp(17px, 4.3vw, 29px)',
  xl: 'clamp(22px, 5.5vw, 38px)',
};

interface Props {
  segments: TranscriptionSegment[];
  currentTime: number;
  style?: SubtitleDisplayStyle;
  position?: 'bottom' | 'top' | 'middle';
  fontSize?: SubtitleFontSize;
}

function getActiveSegment(segments: TranscriptionSegment[], t: number) {
  return segments.find((s) => t >= s.start && t <= s.end + 0.05) ?? null;
}

/**
 * Returns active word index.
 * If the segment has word-level timestamps, use exact match.
 * Otherwise fall back to proportional distribution.
 */
function getActiveWordIndex(segment: TranscriptionSegment, t: number): number {
  if (segment.words && segment.words.length > 0) {
    const words = segment.words;
    // Find last word whose start <= currentTime
    let idx = 0;
    for (let i = 0; i < words.length; i++) {
      if (t >= words[i].start) idx = i;
    }
    return idx;
  }
  // Proportional fallback
  const wordCount = segment.text.trim().split(/\s+/).length;
  if (wordCount <= 1) return 0;
  const elapsed = Math.max(0, t - segment.start);
  const dur = Math.max(0.01, segment.end - segment.start);
  return Math.min(Math.floor((elapsed / dur) * wordCount), wordCount - 1);
}

/** Extract display words from segment — use word timestamps if available */
function getDisplayWords(segment: TranscriptionSegment): string[] {
  if (segment.words && segment.words.length > 0) {
    return segment.words.map((w: TranscriptionWord) => w.word);
  }
  return segment.text.trim().split(/\s+/);
}

// ─── Style renderers ──────────────────────────────────────────────────────────

function CapcutWords({ words, activeIdx }: { words: string[]; activeIdx: number }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-[0.28em] gap-y-1">
      {words.map((w, i) => (
        <span
          key={i}
          className={cn(
            'transition-all duration-100 leading-tight',
            i === activeIdx
              ? 'text-amber-400 scale-110 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]'
              : 'text-white'
          )}
          style={{
            fontFamily: '"Arial Black", "Helvetica Neue", Arial, sans-serif',
            fontWeight: 900,
            fontSize: 'inherit',
            WebkitTextStroke: i === activeIdx ? '1.5px #000' : '1.5px #000',
            paintOrder: 'stroke fill',
            display: 'inline-block',
          }}
        >
          {w}
        </span>
      ))}
    </div>
  );
}

function FilledWords({ words, activeIdx }: { words: string[]; activeIdx: number }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-1.5">
      {words.map((w, i) => (
        <span
          key={i}
          className={cn(
            'px-2 py-0.5 rounded-md font-extrabold transition-all duration-100 leading-tight',
            i === activeIdx
              ? 'bg-amber-400 text-black scale-105'
              : 'bg-black/70 text-white'
          )}
          style={{
            fontFamily: '"Arial Black", "Helvetica Neue", Arial, sans-serif',
            fontWeight: 900,
            fontSize: 'inherit',
          }}
        >
          {w}
        </span>
      ))}
    </div>
  );
}

function KaraokeWords({ words, activeIdx }: { words: string[]; activeIdx: number }) {
  return (
    <div
      className="flex flex-wrap justify-center gap-x-[0.28em] gap-y-1"
      style={{
        fontFamily: '"Arial Black", "Helvetica Neue", Arial, sans-serif',
        fontWeight: 900,
        fontSize: 'inherit',
      }}
    >
      {words.map((w, i) => (
        <span
          key={i}
          className="leading-tight transition-all duration-150"
          style={{
            color: i <= activeIdx ? '#fbbf24' : 'rgba(255,255,255,0.45)',
            WebkitTextStroke: '1px #000',
            paintOrder: 'stroke fill',
            display: 'inline-block',
            transform: i === activeIdx ? 'scale(1.08)' : 'scale(1)',
          }}
        >
          {w}
        </span>
      ))}
    </div>
  );
}

function MinimalWords({ words, activeIdx }: { words: string[]; activeIdx: number }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-[0.28em] gap-y-1">
      {words.map((w, i) => (
        <span
          key={i}
          className={cn(
            'transition-all duration-100 leading-tight',
            i === activeIdx ? 'text-white scale-105' : 'text-white/70'
          )}
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 700,
            fontSize: 'inherit',
            textShadow: '0 1px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8)',
            display: 'inline-block',
          }}
        >
          {w}
        </span>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SubtitleOverlay({
  segments,
  currentTime,
  style = 'capcut',
  position = 'bottom',
  fontSize = 'md',
}: Props) {
  const active = useMemo(
    () => getActiveSegment(segments, currentTime),
    [segments, currentTime]
  );

  const activeWordIdx = useMemo(
    () => (active ? getActiveWordIndex(active, currentTime) : 0),
    [active, currentTime]
  );

  if (!active) return null;

  const words = getDisplayWords(active);

  const posClass =
    position === 'top'
      ? 'top-[8%]'
      : position === 'middle'
      ? 'top-1/2 -translate-y-1/2'
      : 'bottom-[10%]';

  return (
    <div
      className={cn(
        'absolute left-0 right-0 px-[6%] flex justify-center pointer-events-none z-10 animate-subtitle-pop',
        posClass
      )}
      style={{ fontSize: FONT_SIZE_MAP[fontSize] }}
    >
      {style === 'capcut' && <CapcutWords words={words} activeIdx={activeWordIdx} />}
      {style === 'filled' && <FilledWords words={words} activeIdx={activeWordIdx} />}
      {style === 'karaoke' && <KaraokeWords words={words} activeIdx={activeWordIdx} />}
      {style === 'minimal' && <MinimalWords words={words} activeIdx={activeWordIdx} />}
    </div>
  );
}
