import path from 'path';
import fs from 'fs/promises';
import { FFmpegOperation } from '@/types';
import { secondsToSrtTimestamp, safePath } from './utils';

// Lazy init — must not run at module load time (breaks Next.js build on Vercel)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ffmpeg: any = null;
function getFFmpeg() {
  if (!_ffmpeg) {
    _ffmpeg = require('fluent-ffmpeg');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
    _ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    _ffmpeg.setFfprobePath(ffprobeInstaller.path);
  }
  return _ffmpeg;
}

export interface ExecuteResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

/**
 * Execute a sequence of FFmpeg operations derived from an EditPlan.
 * Each step's output becomes the next step's input.
 */
export async function executeEditPlan(
  inputPath: string,
  operations: FFmpegOperation[],
  outputDir: string
): Promise<ExecuteResult> {
  await fs.mkdir(outputDir, { recursive: true });

  const tempFiles: string[] = [];
  let currentInput = inputPath;

  try {
    for (const op of operations) {
      const isFinal = op.output_file === 'final';
      const outputPath = isFinal
        ? path.join(outputDir, 'output.mp4')
        : path.join(outputDir, `step_${op.step}.mp4`);

      await executeSingleOperation(currentInput, op, outputPath);

      if (!isFinal) tempFiles.push(outputPath);
      currentInput = outputPath;
    }

    // Clean up intermediate temp files (keep the last one = final output)
    for (const tempFile of tempFiles) {
      await fs.unlink(tempFile).catch(() => {});
    }

    return { success: true, outputPath: currentInput };
  } catch (error) {
    for (const tempFile of [...tempFiles, currentInput]) {
      await fs.unlink(tempFile).catch(() => {});
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido en FFmpeg',
    };
  }
}

async function executeSingleOperation(
  inputPath: string,
  op: FFmpegOperation,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd = getFFmpeg()(inputPath);

    switch (op.command_type) {
      case 'trim': {
        const { start_time, end_time } = op.parameters as { start_time: number; end_time: number };
        cmd = cmd.setStartTime(start_time).setDuration(end_time - start_time);
        cmd = cmd.outputOptions(['-c copy']);
        break;
      }

      case 'speed': {
        const { speed_factor } = op.parameters as { speed_factor: number };
        const atempoFilters = buildAtempoFilters(speed_factor);
        cmd = cmd
          .videoFilters(`setpts=${(1 / speed_factor).toFixed(4)}*PTS`)
          .audioFilters(atempoFilters)
          .outputOptions(['-preset ultrafast', '-crf 28']);
        break;
      }

      case 'resize': {
        const { width, height } = op.parameters as { width: number; height: number };
        cmd = cmd
          .videoFilters(`scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`)
          .outputOptions(['-c:a copy', '-preset ultrafast', '-crf 28']);
        break;
      }

      case 'crop': {
        // Center-crop to a target aspect ratio (e.g. 9:16 for vertical video).
        // Parameters: target_width, target_height (the desired aspect dimensions, e.g. 9 and 16)
        // or width/height as actual pixel dimensions.
        const params = op.parameters as {
          target_width?: number;
          target_height?: number;
          width?: number;
          height?: number;
        };
        if (params.width && params.height) {
          // Absolute pixel dimensions: scale to fill then crop center
          const w = params.width;
          const h = params.height;
          cmd = cmd
            .videoFilters(
              `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`
            )
            .outputOptions(['-c:a copy', '-preset ultrafast', '-crf 28']);
        } else {
          // Ratio crop (default: 9:16 vertical)
          const tw = params.target_width ?? 9;
          const th = params.target_height ?? 16;
          // Crop to ratio from center: keep full height, crop width
          cmd = cmd
            .videoFilters(
              `crop=ih*${tw}/${th}:ih:(iw-ih*${tw}/${th})/2:0`
            )
            .outputOptions(['-c:a copy', '-preset ultrafast', '-crf 28']);
        }
        break;
      }

      case 'silence_remove': {
        // Remove silent gaps using transcription segments (spoken parts).
        // Parameters: segments = [{start: number, end: number}], padding_seconds (optional)
        const { segments = [], padding_seconds = 0.1 } = op.parameters as {
          segments: Array<{ start: number; end: number }>;
          padding_seconds?: number;
        };

        if (segments.length === 0) {
          // Fallback: just copy the video unchanged
          cmd = cmd.outputOptions(['-c copy']);
        } else {
          // Build select expression for video and audio
          const selectExpr = segments
            .map((s) => {
              const t0 = Math.max(0, s.start - padding_seconds).toFixed(3);
              const t1 = (s.end + padding_seconds).toFixed(3);
              return `between(t,${t0},${t1})`;
            })
            .join('+');

          cmd = cmd
            .complexFilter([
              `[0:v]select='${selectExpr}',setpts=N/FRAME_RATE/TB[v]`,
              `[0:a]aselect='${selectExpr}',asetpts=N/SR/TB[a]`,
            ])
            .outputOptions(['-map [v]', '-map [a]', '-preset ultrafast', '-crf 28']);
        }
        break;
      }

      case 'audio_extract': {
        const { format = 'mp3' } = op.parameters as { format?: string };
        cmd = cmd
          .noVideo()
          .audioCodec(format === 'mp3' ? 'libmp3lame' : format === 'aac' ? 'aac' : 'pcm_s16le')
          .format(format);
        outputPath = outputPath.replace('.mp4', `.${format}`);
        break;
      }

      case 'subtitle': {
        const { srt_path } = op.parameters as { srt_path: string };
        // Burn subtitles into video frames so they are visible in any player/browser.
        // Escape path for FFmpeg filter string (backslashes and colons are special chars).
        const escapedPath = safePath(srt_path).replace(/:/g, '\\:').replace(/'/g, "\\'");
        cmd = cmd
          .videoFilters(`subtitles='${escapedPath}'`)
          .outputOptions(['-c:a copy', '-preset ultrafast', '-crf 28']);
        break;
      }

      case 'filter': {
        const { filter_string } = op.parameters as { filter_string: string };
        cmd = cmd
          .complexFilter(filter_string)
          .outputOptions(['-preset ultrafast', '-crf 28']);
        break;
      }

      case 'concat': {
        const { files = [] } = op.parameters as { files?: string[] };
        for (const f of files) cmd = cmd.addInput(f);
        const n = files.length + 1;
        cmd = cmd
          .complexFilter(`concat=n=${n}:v=1:a=1[outv][outa]`, ['outv', 'outa'])
          .outputOptions(['-preset ultrafast', '-crf 28']);
        break;
      }

      case 'overlay': {
        const { overlay_path, x = 0, y = 0 } = op.parameters as {
          overlay_path: string;
          x?: number;
          y?: number;
        };
        cmd = cmd
          .addInput(overlay_path)
          .complexFilter([`overlay=${x}:${y}`])
          .outputOptions(['-preset ultrafast', '-crf 28']);
        break;
      }
    }

    cmd
      .output(outputPath)
      .on('end', () => resolve())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('error', (err: any) => reject(new Error(`FFmpeg error (step ${op.step}): ${err.message}`)))
      .run();
  });
}

/**
 * Build chained atempo audio filters for speeds outside the 0.5–2.0 range.
 */
function buildAtempoFilters(speed: number): string {
  const filters: string[] = [];
  let remaining = speed;

  while (remaining > 2.0) {
    filters.push('atempo=2.0');
    remaining /= 2.0;
  }
  while (remaining < 0.5) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }
  filters.push(`atempo=${remaining.toFixed(4)}`);
  return filters.join(',');
}

/**
 * Generate an SRT subtitle file from transcription segments.
 * Returns the file path of the written .srt file.
 */
export async function generateSRTFile(
  segments: Array<{ start: number; end: number; text: string }>,
  outputDir: string
): Promise<string> {
  const srtContent = segments
    .map((seg, i) => {
      return `${i + 1}\n${secondsToSrtTimestamp(seg.start)} --> ${secondsToSrtTimestamp(seg.end)}\n${seg.text.trim()}\n`;
    })
    .join('\n');

  const srtPath = path.join(outputDir, 'subtitles.srt');
  await fs.writeFile(srtPath, srtContent, 'utf-8');
  return srtPath;
}

/**
 * Extract video metadata using ffprobe.
 */
export async function probeVideo(
  filePath: string
): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
  videoBitrate: number;
  videoCodec: string;
  audioCodec: string;
}> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getFFmpeg().ffprobe(filePath, (err: any, metadata: any) => {
      if (err) return reject(new Error(`ffprobe error: ${err.message}`));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio');
      const duration = metadata.format.duration ?? 0;

      // Parse FPS from r_frame_rate "30/1" or "30000/1001"
      const fpsRaw = videoStream?.r_frame_rate ?? '25/1';
      const [num, den] = fpsRaw.split('/').map(Number);
      const fps = den ? num / den : num;

      resolve({
        duration,
        width: videoStream?.width ?? 0,
        height: videoStream?.height ?? 0,
        fps: Math.round(fps * 100) / 100,
        videoBitrate: Number(metadata.format.bit_rate ?? 0),
        videoCodec: videoStream?.codec_name ?? 'unknown',
        audioCodec: audioStream?.codec_name ?? 'unknown',
      });
    });
  });
}
