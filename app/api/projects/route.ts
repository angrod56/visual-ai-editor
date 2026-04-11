import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSignedUrl } from '@/lib/utils/storage';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data, error } = await supabase
    .from('video_projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach signed thumbnail URLs for projects that have one
  const projects = await Promise.all(
    (data ?? []).map(async (p) => {
      if (!p.thumbnail_path) return p;
      try {
        const thumbnail_url = await getSignedUrl(p.thumbnail_path);
        return { ...p, thumbnail_url };
      } catch {
        return p;
      }
    })
  );

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json();
  const { title, original_filename, storage_path, file_size_bytes } = body;

  const { data, error } = await supabase
    .from('video_projects')
    .insert({
      user_id: user.id,
      title: title ?? original_filename,
      original_filename,
      storage_path,
      file_size_bytes,
      status: 'uploading',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
