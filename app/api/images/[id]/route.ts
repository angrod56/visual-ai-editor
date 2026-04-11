import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deleteFile, getSignedUrl } from '@/lib/utils/storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: img } = await supabase
    .from('generated_images')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!img) return NextResponse.json({ error: 'Imagen no encontrada' }, { status: 404 });

  const signed_url = await getSignedUrl(img.storage_path);
  return NextResponse.json({ ...img, signed_url });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: img } = await supabase
    .from('generated_images')
    .select('storage_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!img) return NextResponse.json({ error: 'Imagen no encontrada' }, { status: 404 });

  await deleteFile(img.storage_path).catch(() => {});
  await supabase.from('generated_images').delete().eq('id', id);

  return NextResponse.json({ ok: true });
}
