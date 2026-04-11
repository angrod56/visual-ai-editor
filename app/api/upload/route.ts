import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadBuffer, deleteFile } from '@/lib/utils/storage';
import { buildOriginalPath } from '@/lib/utils/video';
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });

  const MAX_SIZE = 500 * 1024 * 1024; // 500 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'El archivo supera el límite de 500 MB' }, { status: 413 });
  }

  const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/avi'];
  if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|avi)$/i)) {
    return NextResponse.json(
      { error: 'Formato no soportado. Use .mp4, .mov o .avi' },
      { status: 415 }
    );
  }

  const projectId = uuidv4();
  const storagePath = buildOriginalPath(user.id, projectId, file.name);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    // Upload to Cloudflare R2
    await uploadBuffer(buffer, storagePath, file.type);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: `Error al subir: ${msg}` }, { status: 500 });
  }

  // Create the project record in Supabase DB
  const { data: project, error: dbError } = await supabase
    .from('video_projects')
    .insert({
      id: projectId,
      user_id: user.id,
      title: file.name.replace(/\.[^.]+$/, ''),
      original_filename: file.name,
      storage_path: storagePath,
      file_size_bytes: file.size,
      status: 'uploading',
    })
    .select()
    .single();

  if (dbError) {
    await deleteFile(storagePath).catch(() => {});
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ project_id: project.id, storage_path: storagePath }, { status: 201 });
}
