import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadStream } from '@/lib/utils/storage';
import { buildOriginalPath } from '@/lib/utils/video';
import { v4 as uuidv4 } from 'uuid';

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

    // Pick smallest combined video+audio format
    let format;
    for (const quality of ['bestefficiency', 'best'] as const) {
      try { format = info.chooseFormat({ type: 'video+audio', quality }); break; } catch { /* try next */ }
    }
    if (!format) {
      const fmts = info.streaming_data?.formats ?? [];
      format = fmts[0];
    }
    if (!format) throw new Error('No se encontró un formato de video compatible');

    const streamUrl = format.decipher(yt.session.player);

    // Fetch the stream — stream directly to R2 (no disk write, no full-buffer)
    const streamRes = await fetch(streamUrl);
    if (!streamRes.ok) throw new Error(`YouTube devolvió ${streamRes.status} al descargar`);
    if (!streamRes.body) throw new Error('Stream vacío de YouTube');

    const projectId = uuidv4();
    const filename = `${title.replace(/[^\w\s-]/g, '').trim().slice(0, 80)}.mp4`;
    const storagePath = buildOriginalPath(user.id, projectId, filename);

    // Stream YouTube → R2 directly (multipart upload, 5 MB parts)
    const totalBytes = await uploadStream(streamRes, storagePath, 'video/mp4');

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
  }
}
