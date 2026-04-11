import { FFmpegOperation } from '@/types';

export interface DirectEditOptions {
  removeSilence?: boolean;
  speed?: number | null;       // null = not selected
  verticalCrop?: boolean;
  subtitles?: boolean;
  subtitleStyle?: string;
}

export interface TranscriptionSegmentMin {
  start: number;
  end: number;
  text: string;
}

/**
 * Build a sequential FFmpeg plan from selected options.
 * Operations are ordered for correctness: silence → speed → crop → subtitles.
 * Returns [] if nothing is selected.
 */
export function buildDirectPlan(
  options: DirectEditOptions,
  segments: TranscriptionSegmentMin[]
): FFmpegOperation[] {
  const ops: FFmpegOperation[] = [];
  let step = 1;
  let currentInput = 'original';

  function pushOp(
    command_type: FFmpegOperation['command_type'],
    parameters: Record<string, unknown>,
    description: string
  ) {
    ops.push({
      step,
      command_type,
      parameters,
      input_file: currentInput,
      output_file: `step_${step}`,
      description,
    });
    currentInput = `step_${step}`;
    step++;
  }

  // 1. Remove silence — must come before speed/crop to work on original timing
  if (options.removeSilence && segments.length > 0) {
    pushOp(
      'silence_remove',
      { segments: segments.map((s) => ({ start: s.start, end: s.end })), padding_seconds: 0.15 },
      'Eliminar silencios'
    );
  }

  // 2. Speed change
  if (options.speed && options.speed !== 1.0) {
    pushOp(
      'speed',
      { speed_factor: options.speed },
      `Cambiar velocidad a ${options.speed}x`
    );
  }

  // 3. Crop to 9:16 — before subtitles so they render on correct frame dimensions
  if (options.verticalCrop) {
    pushOp(
      'crop',
      { target_width: 9, target_height: 16 },
      'Recortar a formato vertical 9:16 para redes sociales'
    );
  }

  // 4. Subtitles last — burned onto the final dimensions
  if (options.subtitles) {
    pushOp(
      'subtitle',
      {}, // ass_path is injected at processing time
      `Agregar subtítulos (estilo ${options.subtitleStyle ?? 'clasico'})`
    );
  }

  // The final operation must output 'final'
  if (ops.length > 0) {
    ops[ops.length - 1].output_file = 'final';
  }

  return ops;
}

/** Human-readable summary of the selected options */
export function buildOperationLabel(options: DirectEditOptions): string {
  const parts: string[] = [];
  if (options.removeSilence) parts.push('sin silencios');
  if (options.speed && options.speed !== 1.0) parts.push(`${options.speed}x velocidad`);
  if (options.verticalCrop) parts.push('formato 9:16');
  if (options.subtitles) parts.push(`subtítulos ${options.subtitleStyle ?? 'clásico'}`);
  return parts.length > 0 ? `Exportar: ${parts.join(' + ')}` : 'Edición personalizada';
}
