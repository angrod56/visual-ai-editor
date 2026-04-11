import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { topic, niche, audience, platform = 'Instagram', slideCount = 7, tone = 'Educativo', ctaText } = await request.json();
  if (!topic) return NextResponse.json({ error: 'topic es requerido' }, { status: 400 });

  const count = Math.min(Math.max(slideCount, 4), 12);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Eres un director creativo senior especializado en contenido viral para redes sociales. Crea un carrusel narrativamente coherente para ${platform}.

TEMA: "${topic}"
NICHO: ${niche || 'no especificado'}
AUDIENCIA: ${audience || 'profesionales y emprendedores'}
TONO: ${tone}
TOTAL DE DIAPOSITIVAS: ${count}

COHERENCIA NARRATIVA — REGLA MÁS IMPORTANTE:
El carrusel debe leerse como una historia con inicio, desarrollo y cierre. Cada diapositiva es un capítulo que avanza la idea principal del título. Sigue este arco obligatorio:
1. PORTADA: formula una promesa o pregunta que genera curiosidad sobre el tema
2. CONTENIDO (slides 2 a ${count - 1}): cada punto es una respuesta, paso o argumento que cumple esa promesa. Los headlines deben poder leerse en secuencia y tener sentido juntos como una lista. Usa el mismo campo semántico, el mismo nivel de especificidad y el mismo sujeto implícito en todos.
3. CTA: conecta directamente con la promesa de la portada — cierra el círculo.

ESTRUCTURA:
- Diapositiva 1: tipo "cover" → portada que lanza la promesa del carrusel
- Diapositivas 2 a ${count - 1}: tipo "content" → puntos numerados (01, 02, 03…) que desarrollan el tema
- Última diapositiva: tipo "cta" → cierre que conecta con la portada y activa acción

REGLAS DE REDACCIÓN:
- headline: máximo 7 palabras, directo, sin puntuación final. Debe sonar como parte de la misma lista que los demás headlines de contenido.
- body: máximo 20 palabras, amplía el headline con un ejemplo, dato o beneficio concreto relacionado con el TEMA principal
- emoji: 1 emoji que refuerce visualmente el mensaje específico de esa slide (no emojis genéricos)
- highlight: 1 o 2 palabras clave del headline que resuman su esencia
- number: "01", "02"… solo para slides de tipo "content"

PRUEBA DE COHERENCIA: Antes de responder, verifica que los headlines de las slides de contenido puedan leerse como: "${topic}: [01], [02], [03]…" y tengan sentido.

${ctaText ? `CTA OBLIGATORIO: El campo "body" de la última slide DEBE ser exactamente: "${ctaText}"` : ''}

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
