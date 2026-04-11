import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadBuffer } from '@/lib/utils/storage';

const DALLE_FORMATS: Record<string, { size: '1024x1024' | '1024x1792' | '1792x1024'; width: number; height: number }> = {
  square:     { size: '1024x1024',  width: 1024, height: 1024 },
  portrait:   { size: '1024x1792',  width: 1024, height: 1792 },
  portrait43: { size: '1024x1792',  width: 1024, height: 1365 },
  landscape:  { size: '1792x1024',  width: 1792, height: 1024 },
};

async function analyzeReferenceImage(openai: InstanceType<typeof import('openai').default>, base64: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'low' },
        },
        {
          type: 'text',
          text: 'Describe this person for an AI image generation prompt. Include: approximate age range, gender presentation, skin tone (be specific: e.g. "warm medium-brown skin"), hair color and style, key facial features, body type, and clothing style. Be concise but precise. Output ONLY the description in English, no preamble.',
        },
      ],
    }],
  });
  return response.choices[0]?.message?.content?.trim() ?? '';
}

async function generateWithDalle3(
  openai: InstanceType<typeof import('openai').default>,
  prompt: string,
  format: string,
  quality: string
): Promise<Buffer> {
  const fmt = DALLE_FORMATS[format] ?? DALLE_FORMATS.square;

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: `${prompt}. Hyperrealistic commercial photography. Ultra high resolution, 8K quality, sharp focus, professional color grading, suitable for premium Meta advertising campaigns. Photorealistic, not illustrated.`,
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

  const { prompt, format = 'square', count = 2, provider = 'dalle3', topic, platform, script_data, reference_image } = await request.json();
  if (!prompt) return NextResponse.json({ error: 'prompt es requerido' }, { status: 400 });

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const batchSize = Math.min(Math.max(count, 1), 4);
  const quality = provider === 'dalle3hd' ? 'hd' : 'standard';
  const dimensions = { width: DALLE_FORMATS[format]?.width ?? 1024, height: DALLE_FORMATS[format]?.height ?? 1024 };

  // If reference image provided, analyze it with GPT-4 Vision and enrich the prompt
  let finalPrompt = prompt;
  if (reference_image) {
    try {
      const personDescription = await analyzeReferenceImage(openai, reference_image);
      if (personDescription) {
        finalPrompt = `${prompt}. The main subject must closely resemble this real person: ${personDescription}. Maintain the exact same skin tone, hair, and facial characteristics. Ultra-realistic human appearance, not AI-generated looking.`;
      }
    } catch (err) {
      console.error('[Vision] Failed to analyze reference image:', err);
      // Continue without reference if analysis fails
    }
  }

  const results = await Promise.allSettled(
    Array.from({ length: batchSize }, () => generateWithDalle3(openai, finalPrompt, format, quality))
  );

  const buffers = results.filter((r): r is PromiseFulfilledResult<Buffer> => r.status === 'fulfilled').map((r) => r.value);
  const genErrors = results.filter((r) => r.status === 'rejected').map((r) => (r as PromiseRejectedResult).reason?.message ?? 'Error');

  if (buffers.length === 0) {
    return NextResponse.json({ error: `No se pudo generar ninguna imagen. ${genErrors[0] ?? ''}` }, { status: 500 });
  }

  const insertions = buffers.map(async (buffer) => {
    const imageId = crypto.randomUUID();
    const storagePath = `images/${user.id}/${imageId}.jpg`;
    await uploadBuffer(buffer, storagePath, 'image/jpeg');

    const { data: record } = await supabase
      .from('generated_images')
      .insert({
        user_id: user.id,
        prompt: finalPrompt,
        topic: topic ?? null,
        platform: platform ?? null,
        format,
        width: dimensions.width,
        height: dimensions.height,
        storage_path: storagePath,
        script_data: script_data ?? null,
        model: `dall-e-3-${quality}${reference_image ? '-ref' : ''}`,
        status: 'completed',
      })
      .select()
      .single();

    return record;
  });

  const saved = await Promise.allSettled(insertions);
  const images = saved
    .filter((r): r is PromiseFulfilledResult<NonNullable<typeof saved[0] extends PromiseFulfilledResult<infer T> ? T : never>> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);

  return NextResponse.json({ images, failed: genErrors.length, errors: genErrors });
}
