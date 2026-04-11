import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSignedUrl } from '@/lib/utils/storage';
import { GeneratedImage } from '@/types';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: images } = await supabase
    .from('generated_images')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!images) return NextResponse.json([]);

  // Generate signed URLs in parallel
  const withUrls: GeneratedImage[] = await Promise.all(
    images.map(async (img) => {
      try {
        const signed_url = await getSignedUrl(img.storage_path);
        return { ...img, signed_url };
      } catch {
        return { ...img, signed_url: undefined };
      }
    })
  );

  return NextResponse.json(withUrls);
}
