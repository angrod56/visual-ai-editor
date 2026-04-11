import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/projects/[id]/retry-transcribe
 * Re-triggers transcription for a project by calling the transcribe endpoint.
 * Useful when transcription failed during initial upload processing.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  // Verify project belongs to user
  const { data: project } = await supabase
    .from('video_projects')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

  // Reset status so transcribe route can run
  await supabase
    .from('video_projects')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', id);

  // Call transcription internally
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const transcribeRes = await fetch(`${baseUrl}/api/process/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Forward auth cookies
      cookie: request.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({ project_id: id }),
  });

  if (!transcribeRes.ok) {
    const err = await transcribeRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as { error?: string }).error ?? 'Error al transcribir' },
      { status: transcribeRes.status }
    );
  }

  const result = await transcribeRes.json();
  return NextResponse.json(result);
}
