import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { r2, R2_BUCKET } from '@/lib/r2/client';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new NextResponse('No autorizado', { status: 401 });

  const { data: project } = await supabase
    .from('video_projects')
    .select('storage_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!project) return new NextResponse('No encontrado', { status: 404 });

  const range = request.headers.get('range');

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: project.storage_path,
    ...(range ? { Range: range } : {}),
  });

  const response = await r2.send(command);

  if (!response.Body) return new NextResponse('Error al obtener video', { status: 500 });

  const headers: Record<string, string> = {
    'Content-Type': response.ContentType ?? 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
  };

  if (response.ContentLength) {
    headers['Content-Length'] = String(response.ContentLength);
  }
  if (response.ContentRange) {
    headers['Content-Range'] = response.ContentRange;
  }

  const status = range ? 206 : 200;

  // Stream the response body
  const stream = response.Body as unknown as ReadableStream;
  return new NextResponse(stream, { status, headers });
}
