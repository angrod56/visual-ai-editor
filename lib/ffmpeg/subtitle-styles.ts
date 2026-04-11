import path from 'path';
import fs from 'fs/promises';
import { getSubtitleStyle } from './subtitle-style-defs';

/**
 * Generate an ASS subtitle file from transcription segments + a visual style.
 * Returns the path to the written .ass file.
 */
export async function generateASSFile(
  segments: Array<{ start: number; end: number; text: string }>,
  outputDir: string,
  styleId: string = 'clasico'
): Promise<string> {
  const style = getSubtitleStyle(styleId);

  const assStyle = [
    'Style: Default',
    style.fontName,
    style.fontSize,
    style.primaryColor,
    '&H000000FF',
    style.outlineColor,
    style.shadowColor,
    style.bold ? '-1' : '0',
    style.italic ? '-1' : '0',
    '0', '0',     // underline, strikeout
    '100', '100', // scaleX, scaleY
    '0', '0',     // spacing, angle
    '1',          // border style
    String(style.outline),
    String(style.shadow),
    String(style.alignment),
    '10', '10', '30', // marginL, marginR, marginV
    '1',
  ].join(',');

  const events = segments
    .map((seg) => {
      const start = toAssTime(seg.start);
      const end = toAssTime(seg.end);
      const text = seg.text.trim().replace(/\n/g, '\\N');
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    })
    .join('\n');

  const assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${assStyle}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}
`;

  const assPath = path.join(outputDir, 'subtitles.ass');
  await fs.writeFile(assPath, assContent, 'utf-8');
  return assPath;
}

/** Convert seconds to ASS time format H:MM:SS.cc */
function toAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
