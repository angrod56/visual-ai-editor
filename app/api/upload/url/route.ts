import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadStream, uploadBuffer } from '@/lib/utils/storage';
import { buildOriginalPath } from '@/lib/utils/video';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

export const maxDuration = 300;

// Lazy-load Innertube to avoid module-init issues on Vercel
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _Innertube: any = null;
async function getInnertube() {
  if (!_Innertube) {
    const mod = await import('youtubei.js');
    _Innertube = mod.Innertube;
  }
  return _Innertube;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpeg: any = null;
function getFFmpeg() {
  if (!ffmpeg) {
    ffmpeg = require('fluent-ffmpeg');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    ffmpeg.setFfprobePath(ffprobeInstaller.path);
  }
  return ffmpeg;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

type Platform = 'youtube' | 'instagram' | 'tiktok' | 'unknown';
function detectPlatform(url: string): Platform {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/instagram\.com/.test(url)) return 'instagram';
  if (/tiktok\.com/.test(url)) return 'tiktok';
  return 'unknown';
}

async function fetchToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar stream`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function mergeAdaptiveStreams(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    getFFmpeg()()
      .input(videoPath)
      .input(audioPath)
      .outputOptions(['-c:v', 'copy', '-c:a', 'aac', '-shortest'])
      .output(outputPath)
      .on('end', () => resolve())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('error', (err: any) => reject(new Error(err.message)))
      .run();
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const url: string = body.url ?? '';

  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
  }

  const platform = detectPlatform(url);

  if (platform === 'instagram' || platform === 'tiktok') {
    return NextResponse.json(
      { error: `${platform === 'instagram' ? 'Instagram' : 'TikTok'} requiere descarga manual. Descarga el video y súbelo directamente.` },
      { status: 422 }
    );
  }
  if (platform !== 'youtube') {
    return NextResponse.json({ error: 'Solo se soportan URLs de YouTube por ahora.' }, { status: 422 });
  }

  const projectId = uuidv4();
  const tmpVideo = path.join('/tmp', `${projectId}_yt_video.mp4`);
  const tmpAudio = path.join('/tmp', `${projectId}_yt_audio.mp4`);
  const tmpMerged = path.join('/tmp', `${projectId}_yt_merged.mp4`);

  try {
    const videoId = extractVideoId(url);
    if (!videoId) throw new Error('No se pudo extraer el ID del video');

    const Innertube = await getInnertube();
    const yt = await Innertube.create({ generate_session_locally: true });
    const info = await yt.getBasicInfo(videoId, 'WEB');

    const title: string = info.basic_info.title ?? 'video';
    const durationSec: number = info.basic_info.duration ?? 0;

    if (durationSec > 30 * 60) {
      throw new Error('El video supera los 30 minutos. Elige un video más corto.');
    }

    const filename = `${title.replace(/[^\w\s-]/g, '').trim().slice(0, 80)}.mp4`;
    const storagePath = buildOriginalPath(user.id, projectId, filename);

    // Try combined video+audio formats first (fastest path — stream directly to R2)
    let combinedFormat;
    for (const quality of ['bestefficiency', 'best'] as const) {
      try { combinedFormat = info.chooseFormat({ type: 'video+audio', quality }); break; } catch { /* try next */ }
    }
    if (!combinedFormat) {
      const fmts = info.streaming_data?.formats ?? [];
      combinedFormat = fmts.length > 0 ? fmts[0] : null;
    }

    let totalBytes: number;

    if (combinedFormat) {
      // Fast path: stream combined format directly to R2
      const streamUrl = combinedFormat.decipher(yt.session.player);
      const streamRes = await fetch(streamUrl);
      if (!streamRes.ok) throw new Error(`YouTube devolvió ${streamRes.status} al descargar`);
      if (!streamRes.body) throw new Error('Stream vacío de YouTube');
      totalBytes = await uploadStream(streamRes, storagePath, 'video/mp4');
    } else {
      // Fallback: adaptive streams (separate video + audio) — merge with FFmpeg
      const adaptiveFmts = info.streaming_data?.adaptive_formats ?? [];
      if (adaptiveFmts.length === 0) throw new Error('No se encontró ningún formato de video disponible');

      // Pick lowest-bitrate video stream (smallest file) + best audio stream
      const videoFmt = adaptiveFmts
        .filter((f: { has_video?: boolean; has_audio?: boolean }) => f.has_video && !f.has_audio)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .sort((a: any, b: any) => (a.bitrate ?? 0) - (b.bitrate ?? 0))[0];
      const audioFmt = adaptiveFmts
        .filter((f: { has_video?: boolean; has_audio?: boolean }) => !f.has_video && f.has_audio)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .sort((a: any, b: any) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];

      if (!videoFmt) throw new Error('No se encontró stream de video');
      if (!audioFmt) throw new Error('No se encontró stream de audio');

      const videoUrl = videoFmt.decipher(yt.session.player);
      const audioUrl = audioFmt.decipher(yt.session.player);

      const [videoBuffer, audioBuffer] = await Promise.all([
        fetchToBuffer(videoUrl),
        fetchToBuffer(audioUrl),
      ]);

      await fs.writeFile(tmpVideo, videoBuffer);
      await fs.writeFile(tmpAudio, audioBuffer);

      await mergeAdaptiveStreams(tmpVideo, tmpAudio, tmpMerged);

      const mergedBuffer = await fs.readFile(tmpMerged);
      totalBytes = mergedBuffer.length;
      await uploadBuffer(mergedBuffer, storagePath, 'video/mp4');
    }

    const { data: project, error: dbError } = await supabase
      .from('video_projects')
      .insert({
        id: projectId,
        user_id: user.id,
        title: title.slice(0, 120),
        original_filename: filename,
        storage_path: storagePath,
        file_size_bytes: totalBytes,
        status: 'uploading',
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    return NextResponse.json({ project_id: project.id }, { status: 201 });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al importar';
    console.error('[upload/url]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.unlink(tmpVideo).catch(() => {});
    await fs.unlink(tmpAudio).catch(() => {});
    await fs.unlink(tmpMerged).catch(() => {});
  }
}
