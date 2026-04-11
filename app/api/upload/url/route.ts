import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadBuffer } from '@/lib/utils/storage';
import { buildOriginalPath } from '@/lib/utils/video';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

export const maxDuration = 300;

// Lazy load ytdl to avoid build-time issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ytdl: any = null;
function getYtdl() {
  if (!ytdl) ytdl = require('@distube/ytdl-core');
  return ytdl;
}

type Platform = 'youtube' | 'instagram' | 'tiktok' | 'unknown';

function detectPlatform(url: string): Platform {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/instagram\.com/.test(url)) return 'instagram';
  if (/tiktok\.com/.test(url)) return 'tiktok';
  return 'unknown';
}

/** Download a YouTube video to a local tmp file, returns the path */
async function downloadYouTube(url: string, tmpPath: string): Promise<{ title: string }> {
  const lib = getYtdl();

  // Get info first to validate and get title
  const info = await lib.getInfo(url);
  const title: string = info.videoDetails.title ?? 'video';
  const durationSec = parseInt(info.videoDetails.lengthSeconds ?? '0', 10);

  if (durationSec > 30 * 60) {
    throw new Error('El video supera los 30 minutos. Sube un video más corto.');
  }

  // Pick best format with both video+audio, prefer mp4
  const format = lib.chooseFormat(info.formats, {
    quality: 'highestvideo',
    filter: (f: { hasVideo: boolean; hasAudio: boolean; container: string }) =>
      f.hasVideo && f.hasAudio && f.container === 'mp4',
  }) ?? lib.chooseFormat(info.formats, { quality: 'highest', filter: 'audioandvideo' });

  if (!format) throw new Error('No se encontró un formato de video compatible');

  return new Promise((resolve, reject) => {
    const stream = lib(url, { format });
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      await fs.writeFile(tmpPath, buffer);
      resolve({ title });
    });
    stream.on('error', (err: Error) => reject(new Error(`Error al descargar YouTube: ${err.message}`)));
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
      {
        error: `${platform === 'instagram' ? 'Instagram' : 'TikTok'} requiere descarga manual por restricciones de la plataforma. Descarga el video y súbelo directamente.`,
        platform,
      },
      { status: 422 }
    );
  }

  if (platform !== 'youtube') {
    return NextResponse.json(
      { error: 'Solo se soportan URLs de YouTube por ahora.' },
      { status: 422 }
    );
  }

  const projectId = uuidv4();
  const tmpPath = path.join('/tmp', `${projectId}_yt.mp4`);

  try {
    // Download from YouTube
    const { title } = await downloadYouTube(url, tmpPath);

    // Read downloaded file
    const buffer = await fs.readFile(tmpPath);

    if (buffer.length > 500 * 1024 * 1024) {
      throw new Error('El video supera el límite de 500 MB');
    }

    const filename = `${title.replace(/[^\w\s-]/g, '').trim().slice(0, 80)}.mp4`;
    const storagePath = buildOriginalPath(user.id, projectId, filename);

    // Upload to R2
    await uploadBuffer(buffer, storagePath, 'video/mp4');

    // Create project record
    const { data: project, error: dbError } = await supabase
      .from('video_projects')
      .insert({
        id: projectId,
        user_id: user.id,
        title: title.slice(0, 120),
        original_filename: filename,
        storage_path: storagePath,
        file_size_bytes: buffer.length,
        status: 'uploading',
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    return NextResponse.json({ project_id: project.id }, { status: 201 });
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}
