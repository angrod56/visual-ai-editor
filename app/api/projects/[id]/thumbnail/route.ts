import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { downloadPartialBuffer, uploadBuffer, getSignedUrl } from '@/lib/utils/storage';
import fs from 'fs/promises';
import path from 'path';

export const maxDuration = 60;

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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: project } = await supabase
    .from('video_projects')
    .select('storage_path, duration_seconds, thumbnail_path, user_id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

  // If thumbnail already exists, just return its signed URL
  if (project.thumbnail_path) {
    const thumbnail_url = await getSignedUrl(project.thumbnail_path);
    return NextResponse.json({ thumbnail_url });
  }

  const tmpVideo = path.join('/tmp', `${projectId}_tn_src.mp4`);
  const tmpThumb = path.join('/tmp', `${projectId}_tn.jpg`);

  try {
    // Download only the first 8 MB — enough to extract a frame near the start
    // without pulling the full video (avoids Vercel 60s timeout for long videos)
    const buffer = await downloadPartialBuffer(project.storage_path, 8 * 1024 * 1024);
    await fs.writeFile(tmpVideo, buffer);

    await new Promise<void>((resolve, reject) => {
      getFFmpeg()(tmpVideo)
        .seekInput(0)          // first frame — reliable with partial file
        .outputOptions([
          '-vframes', '1',
          '-vf', 'scale=640:-2', // -2 keeps even height (required by some encoders)
          '-q:v', '3',
        ])
        .output(tmpThumb)
        .on('end', () => resolve())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on('error', (err: any) => reject(new Error(err.message)))
        .run();
    });

    const thumbBuffer = await fs.readFile(tmpThumb);
    const thumbKey = `thumbnails/${user.id}/${projectId}.jpg`;
    await uploadBuffer(thumbBuffer, thumbKey, 'image/jpeg');

    await supabase
      .from('video_projects')
      .update({ thumbnail_path: thumbKey, updated_at: new Date().toISOString() })
      .eq('id', projectId);

    const thumbnail_url = await getSignedUrl(thumbKey);
    return NextResponse.json({ thumbnail_url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error generando thumbnail';
    console.error('[thumbnail]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.unlink(tmpVideo).catch(() => {});
    await fs.unlink(tmpThumb).catch(() => {});
  }
}
