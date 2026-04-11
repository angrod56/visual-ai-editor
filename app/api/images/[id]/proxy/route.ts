import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { downloadToBuffer } from '@/lib/utils/storage';

// Proxies the image through our server so the browser canvas can draw it (no CORS issues)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('No autorizado', { status: 401 });

  const { data: img } = await supabase
    .from('generated_images')
    .select('storage_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!img) return new NextResponse('No encontrado', { status: 404 });

  const buffer = await downloadToBuffer(img.storage_path);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
