import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { topic, niche, audience, platform = 'Instagram', slideCount = 7, tone = 'Educativo' } = await request.json();
  if (!topic) return NextResponse.json({ error: 'topic es requerido' }, { status: 400 });

  const count = Math.min(Math.max(slideCount, 4), 12);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Eres un experto en marketing de contenidos y diseño editorial para redes sociales. Crea un carrusel profesional de alto engagement para ${platform}.

TEMA: "${topic}"
NICHO: ${niche || 'no especificado'}
AUDIENCIA: ${audience || 'profesionales y emprendedores'}
TONO: ${tone}
TOTAL DE DIAPOSITIVAS: ${count}

ESTRUCTURA OBLIGATORIA:
- Diapositiva 1: tipo "cover" → portada impactante con título y subtítulo
- Diapositivas 2 a ${count - 1}: tipo "content" → puntos clave numerados (01, 02, 03…)
- Última diapositiva: tipo "cta" → llamada a la acción clara

REGLAS DE REDACCIÓN:
- headline: máximo 7 palabras, directo, sin puntuación final
- body: máximo 20 palabras, amplía el headline con un dato o beneficio concreto
- emoji: 1 emoji relevante y visual (evita genéricos como 📌)
- highlight: 1 o 2 palabras del headline para resaltar tipográficamente
- number: "01", "02"... solo para slides de tipo "content"

IMPORTANTE: Responde SOLO con JSON válido, sin texto adicional.

{
  "title": "Título del carrusel",
  "subtitle": "Subtítulo o descripción breve del carrusel",
  "slides": [
    {
      "id": 1,
      "type": "cover",
      "headline": "...",
      "body": "...",
      "emoji": "🎯",
      "highlight": "palabra"
    },
    {
      "id": 2,
      "type": "content",
      "number": "01",
      "headline": "...",
      "body": "...",
      "emoji": "✅",
      "highlight": "palabra"
    },
    {
      "id": ${count},
      "type": "cta",
      "headline": "...",
      "body": "Texto del botón de acción",
      "emoji": "🚀",
      "highlight": "palabra"
    }
  ]
}`,
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  try {
    return NextResponse.json(JSON.parse(text.trim()));
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return NextResponse.json(JSON.parse(match[0])); } catch {}
    }
    return NextResponse.json({ error: 'Error al parsear respuesta', raw: text }, { status: 500 });
  }
}
