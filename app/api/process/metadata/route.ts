import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { downloadToBuffer, uploadBuffer } from '@/lib/utils/storage';
import { probeVideo } from '@/lib/ffmpeg/executor';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import fs from 'fs/promises';
import path from 'path';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { project_id } = await request.json();
  if (!project_id) return NextResponse.json({ error: 'project_id requerido' }, { status: 400 });

  const { data: project, error: projectError } = await supabase
    .from('video_projects')
    .select('storage_path, status')
    .eq('id', project_id)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
  }

  const tmpPath = path.join('/tmp', `${project_id}_meta.mp4`);
  const tmpThumb = path.join('/tmp', `${project_id}_thumb.jpg`);

  try {
    // Download video to /tmp for ffprobe
    const buffer = await downloadToBuffer(project.storage_path);
    await fs.writeFile(tmpPath, buffer);

    const probe = await probeVideo(tmpPath);

    const resolution = `${probe.width}x${probe.height}`;
    const metadata = {
      bitrate: probe.videoBitrate,
      video_codec: probe.videoCodec,
      audio_codec: probe.audioCodec,
      format: 'mp4',
    };

    // Extract thumbnail frame at ~5 s (or 10% into the video if shorter)
    const thumbTimestamp = Math.min(5, probe.duration * 0.1);
    let thumbnailPath: string | null = null;
    try {
      await extractFrame(tmpPath, tmpThumb, thumbTimestamp);
      const thumbBuffer = await fs.readFile(tmpThumb);
      const thumbKey = `thumbnails/${user.id}/${project_id}.jpg`;
      await uploadBuffer(thumbBuffer, thumbKey, 'image/jpeg');
      thumbnailPath = thumbKey;
    } catch {
      // Thumbnail is optional — don't fail the whole route
    }

    // Update project with extracted metadata
    await supabase
      .from('video_projects')
      .update({
        duration_seconds: probe.duration,
        resolution,
        fps: probe.fps,
        metadata,
        ...(thumbnailPath ? { thumbnail_path: thumbnailPath } : {}),
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', project_id);

    return NextResponse.json({
      duration_seconds: probe.duration,
      resolution,
      fps: probe.fps,
      file_size_bytes: buffer.length,
      metadata,
    });
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
    await fs.unlink(tmpThumb).catch(() => {});
  }
}

function extractFrame(inputPath: string, outputPath: string, timestamp: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(timestamp)
      .frames(1)
      .outputOptions(['-vf', 'scale=640:-1', '-q:v', '3'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`FFmpeg thumbnail: ${err.message}`)))
      .run();
  });
}
