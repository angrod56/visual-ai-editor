import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ResponseSchema = z.object({
  title: z.string(),
  youtube: z.string(),
  instagram: z.string(),
  tiktok: z.string(),
  tags: z.array(z.string()),
});

export type GeneratedDescription = z.infer<typeof ResponseSchema>;

const SYSTEM_PROMPT = `Eres un experto en marketing de contenido digital para YouTube, Instagram y TikTok.
Tu tarea es generar descripciones y títulos optimizados para un video a partir de su transcripción.

INSTRUCCIONES:
- title: título atractivo y claro, máximo 70 caracteres, sin clickbait vacío
- youtube: descripción completa (200-350 palabras). Incluye resumen del contenido, puntos clave del video como bullet points con timestamps si hay transcripción con tiempos, y llamada a la acción al final. Sin emojis excesivos.
- instagram: caption para Instagram/Reels (100-150 palabras). Empezar con hook fuerte. Tono conversacional. Terminar con pregunta para engagement. Sin hashtags aquí.
- tiktok: caption para TikTok (50-80 palabras). Ultra corto, directo, gancho en la primera línea. Incluir 3-5 hashtags relevantes al final.
- tags: array de 10-15 hashtags relevantes para todas las plataformas (sin #, solo la palabra)

Responde ÚNICAMENTE con JSON válido, sin markdown ni texto adicional.`;

export async function generateVideoDescription(
  segments: Array<{ start: number; end: number; text: string }>,
  title: string,
  durationSeconds: number
): Promise<GeneratedDescription> {
  if (segments.length === 0) {
    throw new Error('El video no tiene transcripción disponible');
  }

  const transcript = segments
    .map((s) => `[${formatTime(s.start)}] ${s.text.trim()}`)
    .join('\n');

  const durationMin = Math.round(durationSeconds / 60);

  const userPrompt = `Video: "${title}"
Duración: ${durationMin} minuto${durationMin !== 1 ? 's' : ''}

TRANSCRIPCIÓN:
${transcript}

Genera el título y las descripciones optimizadas para cada plataforma.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Respuesta inválida de Claude');

  const parsed = ResponseSchema.parse(JSON.parse(jsonMatch[0]));
  return parsed;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const CHAPTERS_SYSTEM_PROMPT = `Eres un experto en optimización de contenido para YouTube.
Tu tarea es generar capítulos (chapters) para un video a partir de su transcripción.

REGLAS:
- El primer capítulo SIEMPRE empieza en 0:00
- Mínimo 3 capítulos, máximo 12
- Cada capítulo dura al menos 30 segundos
- Los títulos son cortos (2-5 palabras), descriptivos y atractivos
- Usa los momentos donde realmente cambia el tema o el tono
- Responde ÚNICAMENTE con JSON válido: { "chapters": [ { "time": "0:00", "title": "..." } ] }`;

export interface VideoChapter {
  time: string;
  title: string;
}

export async function generateVideoChapters(
  segments: Array<{ start: number; end: number; text: string }>,
  durationSeconds: number
): Promise<VideoChapter[]> {
  if (segments.length === 0) throw new Error('Sin transcripción');

  const transcript = segments
    .map((s) => `[${formatTime(s.start)}] ${s.text.trim()}`)
    .join('\n');

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: CHAPTERS_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Duración total: ${formatTime(durationSeconds)}\n\nTRANSCRIPCIÓN:\n${transcript}`,
    }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Respuesta inválida');

  const parsed = JSON.parse(jsonMatch[0]) as { chapters: VideoChapter[] };
  return parsed.chapters ?? [];
}
