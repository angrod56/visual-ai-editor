import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadBuffer } from '@/lib/utils/storage';

// DALL-E 3 format mapping
const DALLE_FORMATS: Record<string, { size: '1024x1024' | '1024x1792' | '1792x1024'; width: number; height: number }> = {
  square:    { size: '1024x1024',  width: 1024, height: 1024 },
  portrait:  { size: '1024x1792',  width: 1024, height: 1792 },
  landscape: { size: '1792x1024',  width: 1792, height: 1024 },
};

// Imagen 3 native aspect ratios
const IMAGEN_ASPECT_RATIOS: Record<string, string> = {
  square:    '1:1',
  portrait:  '9:16',
  landscape: '16:9',
  portrait43: '3:4',
};

const IMAGEN_DIMENSIONS: Record<string, { width: number; height: number }> = {
  square:     { width: 1024, height: 1024 },
  portrait:   { width: 1024, height: 1792 },
  landscape:  { width: 1792, height: 1024 },
  portrait43: { width: 1024, height: 1365 },
};

async function generateWithImagen3(
  prompt: string,
  format: string,
  count: number
): Promise<Buffer[]> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const aspectRatio = IMAGEN_ASPECT_RATIOS[format] ?? '1:1';

  const response = await ai.models.generateImages({
    model: 'imagen-3.0-generate-002',
    prompt: `${prompt}. Professional advertising photo, high quality, suitable for Meta ads, commercial photography style.`,
    config: {
      numberOfImages: count,
      aspectRatio: aspectRatio as '1:1' | '9:16' | '16:9' | '3:4' | '4:3',
      outputMimeType: 'image/jpeg',
    },
  });

  const bufferList: Buffer[] = [];
  for (const img of response.generatedImages ?? []) {
    if (img.image?.imageBytes) {
      bufferList.push(Buffer.from(img.image.imageBytes, 'base64'));
    }
  }
  return bufferList;
}

async function generateWithDalle3(
  prompt: string,
  format: string,
  quality: string
): Promise<Buffer> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const fmt = DALLE_FORMATS[format] ?? DALLE_FORMATS.square;

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: `${prompt}. Professional advertising photo, high quality, suitable for Meta ads, commercial photography style.`,
    size: fmt.size,
    quality: quality as 'standard' | 'hd',
    n: 1,
  });

  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL returned');

  const imageRes = await fetch(imageUrl);
  return Buffer.from(await imageRes.arrayBuffer());
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const {
    prompt,
    format = 'square',
    count = 2,
    quality = 'standard',
    provider = 'imagen3',
    topic,
    platform,
    script_data,
  } = await request.json();

  if (!prompt) return NextResponse.json({ error: 'prompt es requerido' }, { status: 400 });

  const batchSize = Math.min(Math.max(count, 1), 4);
  const useImagen = provider === 'imagen3' && !!process.env.GEMINI_API_KEY;

  const dimensions = useImagen
    ? (IMAGEN_DIMENSIONS[format] ?? IMAGEN_DIMENSIONS.square)
    : { width: DALLE_FORMATS[format]?.width ?? 1024, height: DALLE_FORMATS[format]?.height ?? 1024 };

  let buffers: Buffer[] = [];

  try {
    if (useImagen) {
      buffers = await generateWithImagen3(prompt, format, batchSize);
    } else {
      // DALL-E 3: one request per image, run in parallel
      const results = await Promise.allSettled(
        Array.from({ length: batchSize }, () => generateWithDalle3(prompt, format, quality))
      );
      buffers = results
        .filter((r): r is PromiseFulfilledResult<Buffer> => r.status === 'fulfilled')
        .map((r) => r.value);
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  // Upload all buffers and insert DB records
  const insertions = buffers.map(async (buffer) => {
    const imageId = crypto.randomUUID();
    const storagePath = `images/${user.id}/${imageId}.jpg`;
    await uploadBuffer(buffer, storagePath, 'image/jpeg');

    const { data: record } = await supabase
      .from('generated_images')
      .insert({
        user_id: user.id,
        prompt,
        topic: topic ?? null,
        platform: platform ?? null,
        format,
        width: dimensions.width,
        height: dimensions.height,
        storage_path: storagePath,
        script_data: script_data ?? null,
        model: useImagen ? 'imagen-3' : `dall-e-3-${quality}`,
        status: 'completed',
      })
      .select()
      .single();

    return record;
  });

  const results = await Promise.allSettled(insertions);
  const images = results
    .filter((r): r is PromiseFulfilledResult<NonNullable<typeof results[0] extends PromiseFulfilledResult<infer T> ? T : never>> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);

  return NextResponse.json({ images, failed: batchSize - images.length });
}
