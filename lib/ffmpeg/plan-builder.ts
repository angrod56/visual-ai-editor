import { FFmpegOperation } from '@/types';

export interface DirectEditOptions {
  // Trim
  trim?: boolean;
  trimStart?: number; // seconds
  trimEnd?: number;   // seconds
  // Silence removal
  removeSilence?: boolean;
  // Speed
  speed?: number | null; // null = not selected; 1.0 = no change
  // Vertical crop 9:16
  verticalCrop?: boolean;
  // Subtitles
  subtitles?: boolean;
  subtitleStyle?: string;
  // Audio extraction (exclusive — disables all video ops)
  extractAudio?: boolean;
}

export interface TranscriptionSegmentMin {
  start: number;
  end: number;
  text: string;
}

/**
 * Build a sequential FFmpeg plan from selected options.
 * Correct execution order: trim → silence → speed → crop → subtitles
 * Audio extract is exclusive and returns a single-step plan.
 */
export function buildDirectPlan(
  options: DirectEditOptions,
  segments: TranscriptionSegmentMin[]
): FFmpegOperation[] {
  // Audio extract is exclusive — nothing else
  if (options.extractAudio) {
    return [{
      step: 1,
      command_type: 'audio_extract',
      parameters: { format: 'mp3' },
      input_file: 'original',
      output_file: 'final',
      description: 'Extraer audio en formato MP3',
    }];
  }

  const ops: FFmpegOperation[] = [];
  let step = 1;
  let currentInput = 'original';

  function pushOp(
    command_type: FFmpegOperation['command_type'],
    parameters: Record<string, unknown>,
    description: string
  ) {
    ops.push({ step, command_type, parameters, input_file: currentInput, output_file: `step_${step}`, description });
    currentInput = `step_${step}`;
    step++;
  }

  // 1. Trim first — reduces the amount of data for subsequent steps
  if (options.trim && options.trimEnd != null && options.trimEnd > (options.trimStart ?? 0)) {
    pushOp(
      'trim',
      { start_time: options.trimStart ?? 0, end_time: options.trimEnd },
      `Recortar de ${fmtTime(options.trimStart ?? 0)} a ${fmtTime(options.trimEnd)}`
    );
  }

  // 2. Remove silence
  if (options.removeSilence && segments.length > 0) {
    pushOp(
      'silence_remove',
      { segments: segments.map((s) => ({ start: s.start, end: s.end })), padding_seconds: 0.15 },
      'Eliminar silencios'
    );
  }

  // 3. Speed change
  if (options.speed && options.speed !== 1.0) {
    pushOp('speed', { speed_factor: options.speed }, `Velocidad ${options.speed}x`);
  }

  // 4. Crop to 9:16 — before subtitles so text renders at correct dimensions
  if (options.verticalCrop) {
    pushOp('crop', { target_width: 9, target_height: 16 }, 'Formato vertical 9:16');
  }

  // 5. Subtitles last — burned onto final frame dimensions
  if (options.subtitles) {
    // If trim was applied, pass the offset so executor can adjust segment timestamps
    const trimOffset = (options.trim && (options.trimStart ?? 0) > 0)
      ? -(options.trimStart ?? 0)
      : 0;
    pushOp('subtitle', { trimOffset }, `Subtítulos (${options.subtitleStyle ?? 'clasico'})`);
  }

  // Last op must output 'final'
  if (ops.length > 0) ops[ops.length - 1].output_file = 'final';

  return ops;
}

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function buildOperationLabel(options: DirectEditOptions): string {
  if (options.extractAudio) return 'Extraer audio MP3';
  const parts: string[] = [];
  if (options.trim) parts.push(`recorte ${fmtTime(options.trimStart ?? 0)}–${fmtTime(options.trimEnd ?? 0)}`);
  if (options.removeSilence) parts.push('sin silencios');
  if (options.speed && options.speed !== 1.0) parts.push(`${options.speed}x`);
  if (options.verticalCrop) parts.push('9:16');
  if (options.subtitles) parts.push(`subtítulos (${options.subtitleStyle ?? 'clásico'})`);
  return parts.length > 0 ? `Exportar: ${parts.join(' + ')}` : 'Edición personalizada';
}
