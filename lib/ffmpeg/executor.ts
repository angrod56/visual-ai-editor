import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import path from 'path';
import fs from 'fs/promises';
import { FFmpegOperation } from '@/types';
import { secondsToSrtTimestamp, safePath } from './utils';

// Use bundled ffmpeg and ffprobe binaries
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

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
    let cmd = ffmpeg(inputPath);

    switch (op.command_type) {
      case 'trim': {
        const { start_time, end_time } = op.parameters as { start_time: number; end_time: number };
        cmd = cmd.setStartTime(start_time).setDuration(end_time - start_time);
        cmd = cmd.outputOptions(['-c copy']);
        break;
      }

      case 'speed': {
        const { speed_factor } = op.parameters as { speed_factor: number };
        // atempo accepts 0.5–2.0; chain filters for values outside that range
        const atempoFilters = buildAtempoFilters(speed_factor);
        cmd = cmd
          .videoFilters(`setpts=${(1 / speed_factor).toFixed(4)}*PTS`)
          .audioFilters(atempoFilters);
        break;
      }

      case 'resize': {
        const { width, height } = op.parameters as { width: number; height: number };
        cmd = cmd
          .videoFilters(`scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`)
          .outputOptions(['-c:a copy']);
        break;
      }

      case 'audio_extract': {
        const { format = 'mp3' } = op.parameters as { format?: string };
        cmd = cmd
          .noVideo()
          .audioCodec(format === 'mp3' ? 'libmp3lame' : format === 'aac' ? 'aac' : 'pcm_s16le')
          .format(format);
        // Override output path extension
        outputPath = outputPath.replace('.mp4', `.${format}`);
        break;
      }

      case 'subtitle': {
        const { srt_path } = op.parameters as { srt_path: string };
        const escapedPath = safePath(srt_path).replace(/:/g, '\\:');
        cmd = cmd
          .videoFilters(`subtitles='${escapedPath}'`)
          .outputOptions(['-c:a copy']);
        break;
      }

      case 'filter': {
        const { filter_string } = op.parameters as { filter_string: string };
        cmd = cmd.complexFilter(filter_string);
        break;
      }

      case 'concat': {
        // parameters.files: string[] — additional input files to concatenate
        const { files = [] } = op.parameters as { files?: string[] };
        for (const f of files) cmd = cmd.addInput(f);
        const n = files.length + 1;
        cmd = cmd.complexFilter(`concat=n=${n}:v=1:a=1[outv][outa]`, ['outv', 'outa']);
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
          .complexFilter([`overlay=${x}:${y}`]);
        break;
      }
    }

    cmd
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`FFmpeg error (step ${op.step}): ${err.message}`)))
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
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new Error(`ffprobe error: ${err.message}`));

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');
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
