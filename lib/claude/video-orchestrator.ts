import Anthropic from '@anthropic-ai/sdk';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './prompts';
import { EditPlanSchema, VideoContext, EditPlanValidated } from './types';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

/**
 * Interpret a natural-language editing instruction using Claude.
 * Returns a validated EditPlan with ffmpeg_operations ready to execute.
 */
export async function interpretInstruction(
  instruction: string,
  videoContext: VideoContext
): Promise<EditPlanValidated> {
  const userMessage = buildUserMessage(instruction, videoContext);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: ORCHESTRATOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Claude devolvió un tipo de contenido inesperado');
      }

      // Strip potential markdown code fences Claude might still add
      const cleaned = content.text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed: unknown = JSON.parse(cleaned);
      const validated = EditPlanSchema.parse(parsed);
      return validated;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `No se pudo interpretar la instrucción después de ${MAX_RETRIES} intentos. Último error: ${lastError?.message}`
  );
}

function buildUserMessage(instruction: string, ctx: VideoContext): string {
  const durationMin = Math.floor(ctx.duration / 60);
  const durationSec = Math.floor(ctx.duration % 60);

  const transcriptText = ctx.transcription.segments
    .map((s) => `[${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s]: "${s.text}"`)
    .join('\n');

  return `INSTRUCCIÓN DEL USUARIO: "${instruction}"

CONTEXTO DEL VIDEO:
- Nombre: ${ctx.filename}
- Duración: ${ctx.duration.toFixed(1)} segundos (${durationMin}:${String(durationSec).padStart(2, '0')})
- Resolución: ${ctx.resolution}
- FPS: ${ctx.fps}

TRANSCRIPCIÓN COMPLETA:
${transcriptText || '(transcripción no disponible)'}

Genera el EditPlan JSON para ejecutar esta instrucción. Responde SOLO con el JSON, sin texto adicional.`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
