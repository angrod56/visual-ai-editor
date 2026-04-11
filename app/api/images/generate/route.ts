import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { uploadBuffer } from '@/lib/utils/storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FORMAT_CONFIG: Record<string, { size: '1024x1024' | '1024x1792' | '1792x1024'; width: number; height: number }> = {
  square:    { size: '1024x1024',  width: 1024, height: 1024 },
  portrait:  { size: '1024x1792',  width: 1024, height: 1792 },
  landscape: { size: '1792x1024',  width: 1792, height: 1024 },
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { prompt, format = 'square', count = 2, quality = 'standard', topic, platform, script_data } = await request.json();
  if (!prompt) return NextResponse.json({ error: 'prompt es requerido' }, { status: 400 });

  const fmt = FORMAT_CONFIG[format] ?? FORMAT_CONFIG.square;
  const batchSize = Math.min(Math.max(count, 1), 4);

  const generations = Array.from({ length: batchSize }, async () => {
    // Generate with DALL-E 3
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `${prompt}. Professional advertising photo, high quality, suitable for Meta ads, commercial photography style.`,
      size: fmt.size,
      quality: quality as 'standard' | 'hd',
      n: 1,
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) throw new Error('No image URL returned');

    // Download image from OpenAI CDN
    const imageRes = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

    // Upload to R2
    const imageId = crypto.randomUUID();
    const storagePath = `images/${user.id}/${imageId}.jpg`;
    await uploadBuffer(imageBuffer, storagePath, 'image/jpeg');

    // Insert record to DB
    const { data: record } = await supabase
      .from('generated_images')
      .insert({
        user_id: user.id,
        prompt,
        topic: topic ?? null,
        platform: platform ?? null,
        format,
        width: fmt.width,
        height: fmt.height,
        storage_path: storagePath,
        script_data: script_data ?? null,
        model: `dall-e-3-${quality}`,
        status: 'completed',
      })
      .select()
      .single();

    return record;
  });

  const results = await Promise.allSettled(generations);
  const images = results
    .filter((r): r is PromiseFulfilledResult<NonNullable<typeof results[0] extends PromiseFulfilledResult<infer T> ? T : never>> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);

  const failed = results.filter((r) => r.status === 'rejected').length;

  return NextResponse.json({ images, failed });
}
