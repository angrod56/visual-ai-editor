import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateVideoChapters } from '@/lib/claude/description-generator';
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
    return NextResponse.json({ error: 'Sin transcripción disponible' }, { status: 400 });
  }

  try {
    const chapters = await generateVideoChapters(
      transcription.segments,
      typed.duration_seconds ?? 0
    );
    return NextResponse.json({ chapters });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
