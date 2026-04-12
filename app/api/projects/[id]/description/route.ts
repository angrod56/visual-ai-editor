import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateVideoDescription } from '@/lib/claude/description-generator';
import { VideoProject, Transcription } from '@/types';

export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: project } = await supabase
    .from('video_projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

  const typed = project as VideoProject;
  const transcription = (typed.transcription as Transcription) ?? { segments: [] };

  if (transcription.segments.length === 0) {
    return NextResponse.json({ error: 'Este proyecto no tiene transcripción' }, { status: 400 });
  }

  try {
    const description = await generateVideoDescription(
      transcription.segments,
      typed.title ?? typed.original_filename ?? 'Video',
      typed.duration_seconds ?? 0
    );
    return NextResponse.json(description);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
