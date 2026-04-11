/**
 * Parse a timecode string (MM:SS or HH:MM:SS or plain seconds) to seconds
 */
export function parseTimecode(input: string | number): number {
  if (typeof input === 'number') return input;

  const parts = input.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return Number(input);
}

/**
 * Convert seconds to SRT timestamp format HH:MM:SS,mmm
 */
export function secondsToSrtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Convert seconds to display timecode MM:SS
 */
export function secondsToTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Get FFmpeg-safe path (escape colons on Windows, no-op on macOS/Linux)
 */
export function safePath(p: string): string {
  return p.replace(/\\/g, '/');
}
