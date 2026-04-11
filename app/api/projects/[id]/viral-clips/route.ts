import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findViralClips } from '@/lib/claude/viral-clips';
import { VideoProject, Transcription } from '@/types';

export const maxDuration = 60;

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
    .select('*')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

  const typedProject = project as VideoProject;
  const transcription = (typedProject.transcription as Transcription) ?? { segments: [] };

  if (transcription.segments.length === 0) {
    return NextResponse.json(
      { error: 'El video no tiene transcripción. Espera a que termine de procesarse.' },
      { status: 400 }
    );
  }

  const duration = typedProject.duration_seconds ?? 0;

  // Ask Claude which segments are viral
  const clips = await findViralClips(transcription.segments, duration);

  if (clips.length === 0) {
    return NextResponse.json({ error: 'No se encontraron segmentos virales' }, { status: 422 });
  }

  // Create one edit_operation per clip (direct trim mode)
  const operationIds: string[] = [];

  for (const clip of clips) {
    const directOptions = {
      trim: true,
      trimStart: clip.start,
      trimEnd: clip.end,
    };

    const instruction = clip.title;

    const { data: op } = await supabase
      .from('edit_operations')
      .insert({
        project_id: projectId,
        user_id: user.id,
        instruction,
        status: 'pending',
        ffmpeg_commands: {
          mode: 'direct',
          direct_options: directOptions,
          subtitle_style: 'clasico',
          viral_clip: {
            hook: clip.hook,
            viral_score: clip.viral_score,
            reason: clip.reason,
            content_type: clip.content_type,
          },
        },
      })
      .select('id')
      .single();

    if (op) {
      operationIds.push(op.id);
      // Fire processing asynchronously
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/edit/${op.id}/process`, {
        method: 'POST',
        keepalive: true,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ operation_ids: operationIds, clips });
}
