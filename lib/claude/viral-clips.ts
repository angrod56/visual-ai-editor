import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ViralClipSchema = z.object({
  title: z.string(),
  start: z.number(),
  end: z.number(),
  hook: z.string(),           // the opening sentence that grabs attention
  viral_score: z.number(),    // 0–100
  reason: z.string(),         // why this segment is viral
  content_type: z.enum(['education', 'humor', 'emotion', 'controversy', 'story', 'tip']),
});

export type ViralClip = z.infer<typeof ViralClipSchema>;

const ResponseSchema = z.object({
  clips: z.array(ViralClipSchema),
});

const SYSTEM_PROMPT = `Eres un experto en contenido viral para redes sociales (TikTok, Reels, Shorts).
Tu tarea es analizar la transcripción de un video y encontrar los segmentos con mayor potencial viral.

CRITERIOS DE SELECCIÓN:
1. HOOK fuerte en los primeros 3 segundos (pregunta intrigante, afirmación sorprendente, dato impactante)
2. Duración entre 15 y 58 segundos (óptimo para TikTok/Reels)
3. Inicio en un punto de alta energía o curiosidad, no en mitad de una frase
4. Contenido completo: tiene inicio, desarrollo y cierre claro
5. Alta densidad de valor: información útil, emoción o entretenimiento concentrado
6. Sin silencios largos al inicio

TIPOS DE CONTENIDO VIRAL:
- education: enseña algo valioso de forma concisa
- humor: momento gracioso o inesperado
- emotion: historia o momento emocionalmente resonante
- controversy: opinión fuerte o punto de vista inesperado
- story: narrativa con arco completo
- tip: consejo práctico e inmediato

Responde ÚNICAMENTE con JSON válido, sin markdown ni texto adicional.`;

export async function findViralClips(
  segments: Array<{ start: number; end: number; text: string }>,
  duration: number
): Promise<ViralClip[]> {
  if (segments.length === 0) {
    throw new Error('El video no tiene transcripción disponible para analizar');
  }

  const transcript = segments
    .map((s) => `[${s.start.toFixed(1)}s]: "${s.text.trim()}"`)
    .join('\n');

  const userMessage = `VIDEO: duración total ${duration.toFixed(0)} segundos

TRANSCRIPCIÓN:
${transcript}

Encuentra entre 3 y 5 clips con el mayor potencial viral. Cada clip debe durar entre 15 y 58 segundos. Ajusta los tiempos exactos al inicio y fin de frases completas.

Responde con este JSON exacto:
{
  "clips": [
    {
      "title": "Título llamativo del clip (máx 60 caracteres)",
      "start": 12.5,
      "end": 48.0,
      "hook": "Primera oración del clip que engancha",
      "viral_score": 87,
      "reason": "Por qué este segmento tiene potencial viral",
      "content_type": "education"
    }
  ]
}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });

      const text = response.content[0];
      if (text.type !== 'text') throw new Error('Respuesta inesperada de Claude');

      const cleaned = text.text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = ResponseSchema.parse(JSON.parse(cleaned));

      // Filter out clips longer than 60s or invalid ranges
      return parsed.clips.filter(
        (c) => c.end > c.start && (c.end - c.start) <= 60 && c.start >= 0 && c.end <= duration + 2
      );
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  return [];
}
