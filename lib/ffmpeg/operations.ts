import { FFmpegOperation } from '@/types';

/**
 * Build a simple trim operation
 */
export function buildTrimOperation(startTime: number, endTime: number): FFmpegOperation {
  return {
    step: 1,
    command_type: 'trim',
    parameters: { start_time: startTime, end_time: endTime },
    input_file: 'original',
    output_file: 'final',
    description: `Recortar de ${startTime}s a ${endTime}s`,
  };
}

/**
 * Build a speed-change operation
 */
export function buildSpeedOperation(speedFactor: number): FFmpegOperation {
  return {
    step: 1,
    command_type: 'speed',
    parameters: { speed_factor: speedFactor },
    input_file: 'original',
    output_file: 'final',
    description: `Cambiar velocidad a ${speedFactor}x`,
  };
}

/**
 * Build a resize operation for platform-specific dimensions
 */
export function buildResizeOperation(
  width: number,
  height: number,
  step = 1
): FFmpegOperation {
  return {
    step,
    command_type: 'resize',
    parameters: { width, height },
    input_file: step === 1 ? 'original' : `step_${step - 1}`,
    output_file: 'final',
    description: `Redimensionar a ${width}x${height}`,
  };
}

/**
 * Platform preset dimensions
 */
export const PLATFORM_DIMENSIONS = {
  instagram_reel: { width: 1080, height: 1920 },
  tiktok: { width: 1080, height: 1920 },
  youtube_shorts: { width: 1080, height: 1920 },
  youtube: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
} as const;
