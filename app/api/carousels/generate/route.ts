import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Narrative arcs per carousel type (from instagram-carousel-designer skill) ──
const CAROUSEL_ARCS: Record<string, { name: string; slides: string; hook: string; close: string; arc: string }> = {
  educativo: {
    name: 'Educativo (Tips / Pasos / Tutorial)',
    slides: '7–10',
    hook: 'dato sorprendente, pregunta directa o afirmación contraintuitiva',
    close: 'resumen visual + CTA de guardar/compartir',
    arc: 'Problema → Promesa → Contenido (pasos/tips) → Síntesis → CTA',
  },
  promocional: {
    name: 'Promocional (Lanzamiento / Oferta)',
    slides: '8–12',
    hook: 'resultado transformador o pregunta de identificación con el dolor',
    close: 'CTA directo con fricción reducida ("Link en bio" / "Responde QUIERO")',
    arc: 'Dolor → Agitación → Solución → Prueba social → Oferta → Urgencia → CTA',
  },
  storytelling: {
    name: 'Storytelling / Narrativo',
    slides: '8–15',
    hook: 'confesión, momento de vergüenza o logro inesperado',
    close: 'reflexión + invitación a comentar',
    arc: 'Situación inicial → Tensión → Punto de quiebre → Aprendizaje → Aplicación → CTA',
  },
  caso_estudio: {
    name: 'Caso de Estudio / Resultados',
    slides: '8–12',
    hook: 'resultado numérico específico (ej: "De $0 a $12,000 en 47 días")',
    close: 'CTA para replicar el resultado',
    arc: 'Contexto del cliente → Problema → Estrategia → Implementación → Resultados → Lección → CTA',
  },
};

// ── Brand profiles ──
const BRAND_PROFILES: Record<string, { name: string; voice: string; colors: string }> = {
  mentoriasangel: {
    name: '@mentoriasangel / MDC Company',
    voice: 'directo, inspirador, emprendedor latinoamericano, segunda persona (tú), sin formalismos',
    colors: 'fondo #0D0D0D, acento naranja #F97316, texto blanco #FFFFFF, texto secundario #A0A0A0',
  },
  generico: {
    name: 'Genérico / Neutral',
    voice: 'profesional y adaptable, segunda persona (tú), tono aspiracional',
    colors: 'fondo oscuro, acento ámbar, texto blanco',
  },
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const {
    topic,
    niche,
    audience,
    platform = 'Instagram',
    slideCount = 7,
    carouselType = 'educativo',
    brand = 'generico',
    ctaText,
    transcription,
  } = await request.json();

  if (!topic && !transcription) return NextResponse.json({ error: 'topic o transcription es requerido' }, { status: 400 });

  const count = Math.min(Math.max(slideCount, 4), 15);
  const effectiveTopic = topic || 'extraído de la transcripción del video';
  const arc = CAROUSEL_ARCS[carouselType] ?? CAROUSEL_ARCS.educativo;
  const brandProfile = BRAND_PROFILES[brand] ?? BRAND_PROFILES.generico;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 5000,
    messages: [{
      role: 'user',
      content: `Eres un copywriter experto en Instagram con 15 años creando carruseles que detienen el scroll y convierten seguidores en clientes. Eres el diseñador de contenido principal de ${brandProfile.name}.

═══════════════════════════════════════
BRIEF DEL CARRUSEL
═══════════════════════════════════════
- TEMA: "${effectiveTopic}"
- TIPO: ${arc.name}
- PLATAFORMA: ${platform}
- NICHO: ${niche || 'no especificado'}
- AUDIENCIA: ${audience || 'profesionales y emprendedores'}
- DIAPOSITIVAS: ${count}
- MARCA: ${brandProfile.name}
- VOZ: ${brandProfile.voice}
- COLORES: ${brandProfile.colors}${transcription ? `

TRANSCRIPCIÓN DEL VIDEO (fuente principal de contenido — extrae los insights clave, frases y puntos de valor para construir el carrusel):
"""
${transcription.slice(0, 6000)}
"""` : ''}

═══════════════════════════════════════
ARCO NARRATIVO OBLIGATORIO
═══════════════════════════════════════
${arc.arc}

SLIDE 1 — PORTADA/HOOK (tipo "cover"):
Hook: ${arc.hook}
Regla: máximo 8 palabras en el titular. Debe generar "necesito ver el siguiente slide" de forma inmediata.

SLIDES 2 a ${count - 1} — CUERPO (tipo "content"):
Un solo concepto por slide. Nunca dos ideas en el mismo slide.
Titular de slide: máximo 6 palabras, empieza con verbo o número.
Cuerpo: máximo 3 líneas, fuente legible en móvil.

SLIDE ${count} — CIERRE/CTA (tipo "cta"):
${arc.close}
Una sola acción. Verbo directo: "Guarda este post", "Comenta X", "Haz clic en bio".
${carouselType === 'promocional' ? 'Incluir urgencia o escasez.' : ''}

═══════════════════════════════════════
REGLAS DE COPYWRITING (SKILL MDC)
═══════════════════════════════════════
- headline: máximo 7 palabras. Palabras de poder: secreto, error, nunca, siempre, probado, exacto, cómo, por qué, deja de, empieza a. SIN puntuación al final.
- body: máximo 20 palabras. Beneficio concreto o dolor específico — cero frases genéricas. Segunda persona (tú/tu).
- emoji: 1 emoji que amplifique la emoción específica de ESA slide
- highlight: 1-2 palabras del headline que resuman la promesa o el dolor (se resaltan visualmente)
- number: "01", "02"… SOLO en slides de tipo "content"
- canva_note: instrucción breve para el diseñador (elemento visual sugerido, color de fondo, jerarquía)

PROHIBIDO: "mejora tu vida", "alcanza el éxito", "sé mejor". Cada frase debe ser tan específica que la audiencia piense "esto es exactamente lo que me pasa".

${ctaText ? `CTA OBLIGATORIO: El campo "body" de la última slide DEBE ser exactamente: "${ctaText}"` : ''}

PRUEBA ANTES DE RESPONDER: Lee los headlines en orden. ¿Alguien de la audiencia siente que (1) lo entienden, (2) tienen la solución, y (3) quiere seguir leyendo? Si no, reescribe.

IMPORTANTE: Responde SOLO con JSON válido, sin texto adicional.

{
  "title": "Título del carrusel",
  "subtitle": "Subtítulo o descripción breve",
  "carousel_type": "${carouselType}",
  "brand": "${brand}",
  "slides": [
    {
      "id": 1,
      "type": "cover",
      "headline": "...",
      "body": "...",
      "emoji": "🎯",
      "highlight": "palabra",
      "canva_note": "Foto de portada impactante, overlay oscuro 70%, titular centrado"
    },
    {
      "id": 2,
      "type": "content",
      "number": "01",
      "headline": "...",
      "body": "...",
      "emoji": "✅",
      "highlight": "palabra",
      "canva_note": "Fondo sólido ${brand === 'mentoriasangel' ? '#0D0D0D' : 'oscuro'}, ícono relacionado arriba derecha"
    },
    {
      "id": ${count},
      "type": "cta",
      "headline": "...",
      "body": "Texto del botón de acción",
      "emoji": "🚀",
      "highlight": "palabra",
      "canva_note": "Fondo con gradiente, foto del autor si aplica, CTA en botón redondeado"
    }
  ]
}`,
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); }
      catch { return NextResponse.json({ error: 'Error al parsear respuesta', raw: text }, { status: 500 }); }
    } else {
      return NextResponse.json({ error: 'Error al parsear respuesta', raw: text }, { status: 500 });
    }
  }

  return NextResponse.json(parsed!);
}
