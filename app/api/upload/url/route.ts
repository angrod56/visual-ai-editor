import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadBuffer } from '@/lib/utils/storage';
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

/** Extract YouTube video ID from any standard URL format */
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

/** Download a YouTube video using Innertube (internal YouTube API — no bot-blocking) */
async function downloadYouTube(url: string, tmpPath: string): Promise<{ title: string }> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error('No se pudo extraer el ID del video de YouTube');

  const Innertube = await getInnertube();
  const yt = await Innertube.create({ generate_session_locally: true });

  const info = await yt.getBasicInfo(videoId, 'WEB');

  const title: string = info.basic_info.title ?? 'video';
  const durationSec: number = info.basic_info.duration ?? 0;

  if (durationSec > 30 * 60) {
    throw new Error('El video supera los 30 minutos. Elige un video más corto.');
  }

  // Use bestefficiency (smallest file) to reduce download time and avoid timeouts
  let format;
  try {
    format = info.chooseFormat({ type: 'video+audio', quality: 'bestefficiency' });
  } catch {
    try {
      format = info.chooseFormat({ type: 'video+audio', quality: 'best' });
    } catch {
      // Last resort: pick the first available video+audio format
      const fmts = info.streaming_data?.formats ?? [];
      format = fmts[0] ?? null;
    }
  }

  if (!format) throw new Error('No se encontró un formato de video compatible');

  const streamUrl = format.decipher(yt.session.player);

  // Download via fetch with a 50-second abort signal (leave buffer for upload)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50_000);

  let response: Response;
  try {
    response = await fetch(streamUrl, { signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('El video tardó demasiado en descargarse. Prueba con un video más corto o sube el archivo directamente.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) throw new Error(`Error al descargar stream: ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(tmpPath, buffer);

  return { title };
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
        error: `${platform === 'instagram' ? 'Instagram' : 'TikTok'} requiere descarga manual. Descarga el video y súbelo directamente.`,
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
    const { title } = await downloadYouTube(url, tmpPath);

    const buffer = await fs.readFile(tmpPath);

    if (buffer.length > 500 * 1024 * 1024) {
      throw new Error('El video supera el límite de 500 MB');
    }

    const filename = `${title.replace(/[^\w\s-]/g, '').trim().slice(0, 80)}.mp4`;
    const storagePath = buildOriginalPath(user.id, projectId, filename);

    await uploadBuffer(buffer, storagePath, 'video/mp4');

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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al importar';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}
