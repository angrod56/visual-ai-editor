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
      content: `Eres un agente de ventas y copywriter de respuesta directa con 15 años de experiencia convirtiendo seguidores en clientes. Tu especialidad es crear carruseles de ${platform} que generan conversaciones, leads y ventas — no solo likes.

BRIEF:
- TEMA: "${topic}"
- NICHO: ${niche || 'no especificado'}
- AUDIENCIA: ${audience || 'profesionales y emprendedores'}
- TONO: ${tone}
- TOTAL DE DIAPOSITIVAS: ${count}

═══════════════════════════════════════
FILOSOFÍA DE VENTAS — LEY NÚMERO UNO
═══════════════════════════════════════
La gente no compra productos ni servicios. Compra la TRANSFORMACIÓN: cómo se va a sentir, qué va a lograr, qué dolor va a dejar de sentir. Cada slide debe empujar emocionalmente hacia esa transformación.

═══════════════════════════════════════
MARCO NARRATIVO OBLIGATORIO (PAS + AIDA)
═══════════════════════════════════════

SLIDE 1 — PORTADA (tipo "cover"):
Golpe de atención. Elige UNA de estas técnicas:
• Pregunta que duele: apunta al mayor dolor/frustración de la audiencia
• Promesa audaz: el resultado específico que van a obtener
• Dato perturbador: estadística o verdad que rompe una creencia falsa
El headline debe detener el scroll. Sin él, nada importa.

SLIDES 2 a ${count - 1} — CUERPO (tipo "content"):
Cada slide es un argumento de venta disfrazado de contenido de valor. Sigue este orden:
• Slides 2-3: Agita el problema — profundiza el dolor, muestra el costo de no actuar
• Slides 4-${Math.max(4, count - 3)}: Presenta la solución — pasos, secretos, errores a evitar, o beneficios concretos
• Slide ${count - 2}: Prueba social o resultado — qué logran quienes aplican esto
Todos los headlines deben poder leerse en secuencia como una lista de argumentos del mismo nivel.

SLIDE ${count} — CTA (tipo "cta"):
El cierre de ventas. Conecta con el dolor de la portada, entrega la promesa y activa la acción. El botón debe crear urgencia o curiosidad, nunca decir solo "Contáctame".

═══════════════════════════════════════
REGLAS DE COPYWRITING
═══════════════════════════════════════
- headline: máximo 7 palabras. Usa palabras de poder: secreto, error, nunca, siempre, gratis, probado, exacto, cómo, por qué, deja de, empieza a. Sin puntuación final.
- body: máximo 20 palabras. Beneficio concreto o dolor específico — nada genérico. Habla en segunda persona (tú/tu).
- emoji: 1 emoji que amplifique la emoción de esa slide específica
- highlight: 1-2 palabras del headline que resuman la promesa o el dolor
- number: "01", "02"… solo slides de tipo "content"

PROHIBIDO: frases genéricas como "mejora tu vida", "alcanza el éxito", "sé mejor". Cada frase debe ser tan específica que la audiencia piense "esto es exactamente lo que me pasa".

${ctaText ? `CTA OBLIGATORIO: El campo "body" de la última slide DEBE ser exactamente: "${ctaText}"` : ''}

PRUEBA DE VENTAS: Antes de responder, verifica que alguien de la audiencia objetivo, al leer los headlines en orden, sienta que (1) lo entienden, (2) tienen la solución, y (3) quieran saber más.

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
