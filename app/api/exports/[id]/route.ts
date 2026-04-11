import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSignedUrl } from '@/lib/utils/storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  // Verify the export belongs to the user via the project
  const { data: exportRecord } = await supabase
    .from('video_exports')
    .select('*, video_projects!inner(user_id)')
    .eq('id', id)
    .single();

  if (!exportRecord) {
    return NextResponse.json({ error: 'Export no encontrado' }, { status: 404 });
  }

  type ExportWithProject = typeof exportRecord & {
    video_projects: { user_id: string };
  };
  const typed = exportRecord as ExportWithProject;

  if (typed.video_projects.user_id !== user.id) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const signedUrl = await getSignedUrl(typed.storage_path);

  return NextResponse.json({ download_url: signedUrl, export: typed });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: exportRecord } = await supabase
    .from('video_exports')
    .select('*, video_projects!inner(user_id)')
    .eq('id', id)
    .single();

  if (!exportRecord) return NextResponse.json({ error: 'Export no encontrado' }, { status: 404 });

  type ExportWithProject = typeof exportRecord & { video_projects: { user_id: string } };
  if ((exportRecord as ExportWithProject).video_projects.user_id !== user.id) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  await supabase.from('video_exports').delete().eq('id', id);

  return NextResponse.json({ ok: true });
}
