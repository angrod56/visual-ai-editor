import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadBuffer } from '@/lib/utils/storage';

// DALL-E 3 format mapping
const DALLE_FORMATS: Record<string, { size: '1024x1024' | '1024x1792' | '1792x1024'; width: number; height: number }> = {
  square:     { size: '1024x1024',  width: 1024, height: 1024 },
  portrait:   { size: '1024x1792',  width: 1024, height: 1792 },
  portrait43: { size: '1024x1792',  width: 1024, height: 1365 },
  landscape:  { size: '1792x1024',  width: 1792, height: 1024 },
};

const GEMINI_DIMENSIONS: Record<string, { width: number; height: number }> = {
  square:     { width: 1024, height: 1024 },
  portrait:   { width: 1024, height: 1792 },
  portrait43: { width: 1024, height: 1365 },
  landscape:  { width: 1792, height: 1024 },
};

const GEMINI_IMAGE_MODELS = [
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.0-flash-exp',
];

async function generateOneWithGemini(prompt: string): Promise<Buffer | null> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const fullPrompt = `${prompt}. Hyperrealistic commercial photography. Ultra high resolution, sharp focus, professional color grading, suitable for premium Meta advertising campaigns. Photorealistic, not illustrated, not AI-looking.`;

  let lastError: unknown;
  for (const model of GEMINI_IMAGE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: fullPrompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          return Buffer.from(part.inlineData.data, 'base64');
        }
      }
      // Response came back but no image — log for debugging
      console.warn(`[Gemini] Model ${model} returned no image. Candidates:`, JSON.stringify(response.candidates?.map(c => c.content?.parts?.map(p => ({ type: p.inlineData ? 'image' : 'text', text: p.text?.slice(0, 80) })))));
    } catch (err) {
      console.warn(`[Gemini] Model ${model} failed:`, err);
      lastError = err;
    }
  }

  throw lastError ?? new Error('Gemini: no image returned from any model');
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateWithRetry(prompt: string, attempt = 0): Promise<Buffer> {
  try {
    const result = await generateOneWithGemini(prompt);
    if (!result) throw new Error('No image data returned');
    return result;
  } catch (err) {
    if (attempt < 2) {
      await sleep(1500 * (attempt + 1));
      return generateWithRetry(prompt, attempt + 1);
    }
    throw err;
  }
}

async function generateWithGemini(prompt: string, count: number): Promise<{ buffers: Buffer[]; errors: string[] }> {
  const buffers: Buffer[] = [];
  const errors: string[] = [];
  for (let i = 0; i < count; i++) {
    if (i > 0) await sleep(600);
    try {
      const buf = await generateWithRetry(prompt);
      buffers.push(buf);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Gemini] Image ${i + 1}/${count} failed:`, msg);
      errors.push(msg);
    }
  }
  return { buffers, errors };
}

async function generateWithDalle3(prompt: string, format: string, quality: string): Promise<Buffer> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const fmt = DALLE_FORMATS[format] ?? DALLE_FORMATS.square;

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: `${prompt}. Hyperrealistic commercial photography. Ultra high resolution, 8K quality, sharp focus, professional color grading, suitable for premium Meta advertising campaigns. Photorealistic, not illustrated, not AI-looking.`,
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
    provider = 'gemini',
    topic,
    platform,
    script_data,
  } = await request.json();

  if (!prompt) return NextResponse.json({ error: 'prompt es requerido' }, { status: 400 });

  const batchSize = Math.min(Math.max(count, 1), 4);
  const useGemini = provider === 'gemini' && !!process.env.GEMINI_API_KEY;

  const dimensions = useGemini
    ? (GEMINI_DIMENSIONS[format] ?? GEMINI_DIMENSIONS.square)
    : { width: DALLE_FORMATS[format]?.width ?? 1024, height: DALLE_FORMATS[format]?.height ?? 1024 };

  let buffers: Buffer[] = [];
  let genErrors: string[] = [];

  try {
    if (useGemini) {
      const result = await generateWithGemini(prompt, batchSize);
      buffers = result.buffers;
      genErrors = result.errors;
    } else {
      const results = await Promise.allSettled(
        Array.from({ length: batchSize }, () => generateWithDalle3(prompt, format, quality))
      );
      buffers = results
        .filter((r): r is PromiseFulfilledResult<Buffer> => r.status === 'fulfilled')
        .map((r) => r.value);
      genErrors = results
        .filter((r) => r.status === 'rejected')
        .map((r) => (r as PromiseRejectedResult).reason?.message ?? 'Error desconocido');
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  if (buffers.length === 0) {
    return NextResponse.json({ error: `No se pudo generar ninguna imagen. Error: ${genErrors[0] ?? 'desconocido'}` }, { status: 500 });
  }

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
        model: useGemini ? 'gemini-2.0-flash-image' : `dall-e-3-${quality}`,
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

  return NextResponse.json({ images, failed: genErrors.length, errors: genErrors });
}
