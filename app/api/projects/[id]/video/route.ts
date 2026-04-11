import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { r2, R2_BUCKET } from '@/lib/r2/client';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

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

  try {
    // If range request, use it; otherwise get full object
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: project.storage_path,
      ...(range ? { Range: range } : {}),
    });

    const r2Response = await r2.send(command);
    if (!r2Response.Body) return new NextResponse('Sin contenido', { status: 500 });

    // Convert Node.js stream to Web ReadableStream
    const nodeStream = r2Response.Body as Readable;
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      'Content-Type': r2Response.ContentType ?? 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    };
    if (r2Response.ContentLength) headers['Content-Length'] = String(r2Response.ContentLength);
    if (r2Response.ContentRange) headers['Content-Range'] = r2Response.ContentRange;

    return new NextResponse(webStream, {
      status: range ? 206 : 200,
      headers,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return new NextResponse(msg, { status: 500 });
  }
}

// HEAD request — needed for some browsers before loading video
export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new NextResponse(null, { status: 401 });

  const { data: project } = await supabase
    .from('video_projects')
    .select('storage_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!project) return new NextResponse(null, { status: 404 });

  const r2Response = await r2.send(
    new HeadObjectCommand({ Bucket: R2_BUCKET, Key: project.storage_path })
  );

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': r2Response.ContentType ?? 'video/mp4',
      'Content-Length': String(r2Response.ContentLength ?? 0),
      'Accept-Ranges': 'bytes',
    },
  });
}
