import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ARCS: Record<string, { name: string; arc: string; hook: string; close: string }> = {
  educativo:    { name: 'Educativo',            arc: 'Problema → Promesa → Pasos/Tips → Síntesis → CTA',                             hook: 'dato sorprendente, pregunta directa o afirmación contraintuitiva', close: 'resumen visual + CTA de guardar/compartir' },
  promocional:  { name: 'Promocional',          arc: 'Dolor → Agitación → Solución → Prueba social → Oferta → Urgencia → CTA',       hook: 'resultado transformador o pregunta de identificación con el dolor',  close: 'CTA directo con urgencia o escasez' },
  storytelling: { name: 'Storytelling',         arc: 'Situación inicial → Tensión → Punto de quiebre → Aprendizaje → Aplicación → CTA', hook: 'confesión, vergüenza o logro inesperado',                           close: 'reflexión + invitación a comentar' },
  caso_estudio: { name: 'Caso de Estudio',      arc: 'Contexto → Problema → Estrategia → Implementación → Resultados → Lección → CTA', hook: 'resultado numérico específico',                                     close: 'CTA para replicar el resultado' },
};

const BRANDS: Record<string, { name: string; voice: string }> = {
  mentoriasangel: { name: '@mentoriasangel / MDC Company', voice: 'directo, inspirador, emprendedor latinoamericano, segunda persona (tú), sin formalismos' },
  generico:       { name: 'Marca genérica',               voice: 'profesional y adaptable, segunda persona (tú), tono aspiracional' },
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const {
    topic, niche, audience, platform = 'Instagram',
    slideCount = 7, carouselType = 'educativo', brand = 'generico',
    ctaText, ctaComplement, transcription,
  } = await request.json();

  if (!topic && !transcription) return NextResponse.json({ error: 'topic o transcription es requerido' }, { status: 400 });

  const count   = Math.min(Math.max(slideCount, 4), 15);
  const arc     = ARCS[carouselType]   ?? ARCS.educativo;
  const brandPr = BRANDS[brand]        ?? BRANDS.generico;
  const effectiveTopic = topic || 'extraído de la transcripción del video';

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 6000,
    messages: [{
      role: 'user',
      content: `Eres un Director de Copywriting especializado en Instagram con 15 años de experiencia. Tu trabajo es crear el copy de un carrusel Y justificar cada decisión creativa para que el cliente pueda validar la coherencia antes de diseñar.

═══════════════════════════════════════
BRIEF
═══════════════════════════════════════
- TEMA: "${effectiveTopic}"
- TIPO: ${arc.name} — Arco: ${arc.arc}
- PLATAFORMA: ${platform}
- NICHO: ${niche || 'no especificado'}
- AUDIENCIA: ${audience || 'profesionales y emprendedores'}
- MARCA / VOZ: ${brandPr.name} — ${brandPr.voice}
- NÚMERO DE SLIDES: ${count}${transcription ? `

TRANSCRIPCIÓN DEL VIDEO (fuente principal — extrae insights, frases y puntos de valor):
"""
${transcription.slice(0, 6000)}
"""` : ''}${ctaText ? `\n- ACCIÓN DEL CTA: "${ctaText}"` : ''}${ctaComplement ? `\n- FRASE COMPLEMENTARIA DEL CTA: "${ctaComplement}"` : ''}

═══════════════════════════════════════
REGLAS DE COPY (MDC Skill)
═══════════════════════════════════════
• headline: máximo 7 palabras, empieza con verbo o número, sin puntuación final
• body: máximo 20 palabras, beneficio o dolor específico, segunda persona (tú/tu)
• Un solo concepto por slide — nunca dos ideas en la misma
• Hook (slide 1): ${arc.hook}
• Cierre (última slide): ${arc.close}
${ctaText ? `• La acción del CTA en body del último slide DEBE ser: "${ctaText}"` : ''}
${ctaComplement ? `• La frase complementaria del CTA DEBE incorporarse en el headline del último slide` : ''}

═══════════════════════════════════════
LO QUE DEBES PRODUCIR
═══════════════════════════════════════
Para CADA slide debes entregar:
1. El copy (headline + body + emoji + highlight)
2. copy_reason: 1-2 frases explicando POR QUÉ ese copy es efectivo para esta audiencia y objetivo
3. canva_note: instrucción visual para el diseñador

Al final del JSON, incluye una sección "coherence" con:
- score: número del 1 al 10 que evalúa la coherencia narrativa del carrusel completo
- notes: 2-3 líneas evaluando si el arco narrativo fluye, si el hook conecta con el CTA, y qué funciona mejor del copy

IMPORTANTE: Responde SOLO con JSON válido.

{
  "title": "Título del carrusel",
  "subtitle": "Subtítulo o descripción breve",
  "carousel_type": "${carouselType}",
  "brand": "${brand}",
  "coherence": {
    "score": 8,
    "notes": "El arco narrativo fluye de forma natural desde el hook hasta el CTA. El slide 1 genera tensión con el dolor correcto y el slide ${count} resuelve con urgencia. El punto más fuerte es..."
  },
  "slides": [
    {
      "id": 1,
      "type": "cover",
      "headline": "...",
      "body": "...",
      "emoji": "🎯",
      "highlight": "palabra clave",
      "copy_reason": "Este hook funciona porque...",
      "canva_note": "Foto de portada impactante, overlay oscuro 70%, titular centrado"
    },
    {
      "id": 2,
      "type": "content",
      "number": "01",
      "headline": "...",
      "body": "...",
      "emoji": "✅",
      "highlight": "palabra clave",
      "copy_reason": "Esta slide agita el problema porque...",
      "canva_note": "Fondo sólido oscuro, ícono relacionado arriba derecha"
    },
    {
      "id": ${count},
      "type": "cta",
      "headline": "...",
      "body": "${ctaText || 'Acción del CTA'}",
      "emoji": "🚀",
      "highlight": "palabra clave",
      "copy_reason": "Este cierre convierte porque...",
      "canva_note": "Fondo con gradiente, CTA en botón redondeado"
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
