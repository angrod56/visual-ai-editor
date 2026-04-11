import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { product, niche, audience, cta } = await request.json();
  if (!product) return NextResponse.json({ error: 'product es requerido' }, { status: 400 });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 5000,
    messages: [{
      role: 'user',
      content: `Eres un estratega de contenido y copywriter de ventas experto en embudos de conversión para redes sociales. Tu trabajo es diseñar planes de contenido que conviertan seguidores en clientes.

NEGOCIO:
- Producto/Servicio: "${product}"
- Nicho: ${niche || 'no especificado'}
- Audiencia: ${audience || 'profesionales y emprendedores'}
- CTA principal: ${cta || 'Contáctame por DM'}

════════════════════════════════════════
TAREA: PLAN DE CONTENIDO — 10 CARRUSELES
════════════════════════════════════════
Crea exactamente 10 ideas de carrusel, cada uno para una etapa específica del embudo de ventas. El objetivo es que los 10 publicados juntos lleven al seguidor desde desconocer el problema hasta comprar.

LAS 10 ETAPAS (en este orden exacto):

1. ATENCIÓN — Detener el scroll. El dolor más urgente de la audiencia.
2. AGITACIÓN — Profundizar el problema. Qué pasa si no lo resuelven.
3. ESPERANZA — Existe una solución. Abrir posibilidad sin revelar todo.
4. EDUCACIÓN — Enseñar el "cómo". Dar valor real que demuestre expertise.
5. AUTORIDAD — Por qué tú. Credenciales, método único, experiencia.
6. PRUEBA SOCIAL — Resultados reales. Transformaciones de clientes.
7. OBJECIONES — Destruir el "sí, pero…". Las 3 excusas más comunes.
8. DIFERENCIACIÓN — Por qué tú y no la competencia. Lo que solo tú ofreces.
9. OFERTA — Presentar la propuesta. Sin disculpas, sin rodeos.
10. URGENCIA — Por qué actuar ahora. El costo de esperar.

Para cada etapa genera:
- topic: el tema específico del carrusel (máx 12 palabras), orientado a ventas
- hook: la primera frase de la portada que detiene el scroll (máx 8 palabras, impacto máximo)
- objective: qué debe sentir/pensar el lector al terminar (1 frase)
- angle: el enfoque o giro creativo que hace único este carrusel (1-2 frases)
- cta_idea: qué acción concreta pedir al final de este carrusel específico

REGLA: Cada topic debe ser tan específico al negocio "${product}" que no pueda confundirse con cualquier otro negocio.

IMPORTANTE: Responde SOLO con JSON válido, sin texto adicional.

{
  "plan": [
    {
      "stage_number": 1,
      "stage": "Atención",
      "stage_color": "red",
      "topic": "...",
      "hook": "...",
      "objective": "...",
      "angle": "...",
      "cta_idea": "..."
    },
    {
      "stage_number": 2,
      "stage": "Agitación",
      "stage_color": "orange",
      "topic": "...",
      "hook": "...",
      "objective": "...",
      "angle": "...",
      "cta_idea": "..."
    },
    {
      "stage_number": 3,
      "stage": "Esperanza",
      "stage_color": "yellow",
      "topic": "...",
      "hook": "...",
      "objective": "...",
      "angle": "...",
      "cta_idea": "..."
    },
    {
      "stage_number": 4,
      "stage": "Educación",
      "stage_color": "green",
      "topic": "...",
      "hook": "...",
      "objective": "...",
      "angle": "...",
      "cta_idea": "..."
    },
    {
      "stage_number": 5,
      "stage": "Autoridad",
      "stage_color": "teal",
      "topic": "...",
      "hook": "...",
      "objective": "...",
      "angle": "...",
      "cta_idea": "..."
    },
    {
      "stage_number": 6,
      "stage": "Prueba Social",
      "stage_color": "blue",
      "topic": "...",
      "hook": "...",
      "objective": "...",
      "angle": "...",
      "cta_idea": "..."
    },
    {
      "stage_number": 7,
      "stage": "Objeciones",
      "stage_color": "indigo",
      "topic": "...",
      "hook": "...",
      "objective": "...",
      "angle": "...",
      "cta_idea": "..."
    },
    {
      "stage_number": 8,
      "stage": "Diferenciación",
      "stage_color": "violet",
      "topic": "...",
      "hook": "...",
      "objective": "...",
      "angle": "...",
      "cta_idea": "..."
    },
    {
      "stage_number": 9,
      "stage": "Oferta",
      "stage_color": "purple",
      "topic": "...",
      "hook": "...",
      "objective": "...",
      "angle": "...",
      "cta_idea": "..."
    },
    {
      "stage_number": 10,
      "stage": "Urgencia",
      "stage_color": "pink",
      "topic": "...",
      "hook": "...",
      "objective": "...",
      "angle": "...",
      "cta_idea": "..."
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
