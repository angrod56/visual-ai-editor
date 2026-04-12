import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { downloadToBuffer } from '@/lib/utils/storage';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

export const maxDuration = 300;

// Lazy init — must not run at module load time (breaks Next.js build on Vercel)
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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    .select('storage_path, original_filename')
    .eq('id', project_id)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
  }

  const tmpVideo = path.join('/tmp', `${project_id}_transcribe.mp4`);
  const tmpAudio = path.join('/tmp', `${project_id}_audio.mp3`);

  try {
    // 1. Download video from R2
    const buffer = await downloadToBuffer(project.storage_path);
    await fs.writeFile(tmpVideo, buffer);

    // 2. Extract audio as MP3 with FFmpeg (much smaller than video — stays under Whisper's 25MB limit)
    await extractAudio(tmpVideo, tmpAudio);

    // 3. Check audio file size
    const audioStats = await fs.stat(tmpAudio);
    const MAX_WHISPER_SIZE = 24 * 1024 * 1024; // 24MB safety margin

    if (audioStats.size > MAX_WHISPER_SIZE) {
      // Audio still too large — mark as ready without transcription
      await supabase
        .from('video_projects')
        .update({ transcription: { segments: [] }, status: 'ready', updated_at: new Date().toISOString() })
        .eq('id', project_id);
      return NextResponse.json({ transcription: { segments: [] }, warning: 'Audio demasiado largo para transcribir' });
    }

    // 4. Send audio to Whisper with word-level timestamps
    const audioBuffer = await fs.readFile(tmpAudio);
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' }),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    });

    // 5. Normalize — attach word timestamps to each segment
    type WhisperWord = { word: string; start: number; end: number };
    type WhisperSegment = { start: number; end: number; text: string };
    const raw = transcriptionResponse as unknown as {
      segments?: WhisperSegment[];
      words?: WhisperWord[];
    };

    const allWords: WhisperWord[] = raw.words ?? [];
    const rawSegments: WhisperSegment[] = raw.segments ?? [];

    const segments = rawSegments.map((s) => {
      const segWords = allWords
        .filter((w) => w.start >= s.start - 0.05 && w.end <= s.end + 0.05)
        .map((w) => ({ word: w.word.trim(), start: w.start, end: w.end }));
      return {
        start: s.start,
        end: s.end,
        text: s.text.trim(),
        ...(segWords.length > 0 ? { words: segWords } : {}),
      };
    });

    const transcription = {
      segments,
      language: transcriptionResponse.language ?? 'es',
    };

    await supabase
      .from('video_projects')
      .update({ transcription, status: 'ready', updated_at: new Date().toISOString() })
      .eq('id', project_id);

    return NextResponse.json({ transcription });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[transcribe]', message);
    return NextResponse.json({ error: `Error al transcribir: ${message}` }, { status: 500 });
  } finally {
    await fs.unlink(tmpVideo).catch(() => {});
    await fs.unlink(tmpAudio).catch(() => {});
  }
}

function extractAudio(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getFFmpeg()(inputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('64k')   // low bitrate — enough for speech, keeps file small
      .format('mp3')
      .output(outputPath)
      .on('end', () => resolve())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('error', (err: any) => reject(new Error(`FFmpeg audio extract: ${err.message}`)))
      .run();
  });
}
