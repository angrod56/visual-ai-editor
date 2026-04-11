import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { project_id, instruction } = await request.json();

  if (!project_id || !instruction?.trim()) {
    return NextResponse.json(
      { error: 'project_id e instruction son requeridos' },
      { status: 400 }
    );
  }

  // Verify project belongs to user
  const { data: project } = await supabase
    .from('video_projects')
    .select('id, status')
    .eq('id', project_id)
    .eq('user_id', user.id)
    .single();

  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

  // Create operation record and return immediately
  const { data: operation, error: opError } = await supabase
    .from('edit_operations')
    .insert({
      project_id,
      user_id: user.id,
      instruction,
      ai_interpretation: {},
      ffmpeg_commands: {},
      status: 'pending',
    })
    .select()
    .single();

  if (opError || !operation) {
    return NextResponse.json({ error: 'Error al crear operación' }, { status: 500 });
  }

  return NextResponse.json({ operation_id: operation.id }, { status: 201 });
}
