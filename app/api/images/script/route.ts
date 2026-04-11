import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { topic, audience, platform, tone, count = 4 } = await request.json();
  if (!topic) return NextResponse.json({ error: 'topic es requerido' }, { status: 400 });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `Eres un experto en publicidad digital y copywriting para Meta Ads (Facebook/Instagram).

Genera ${count} scripts profesionales y diferentes entre sí para anuncios sobre:
PRODUCTO/SERVICIO: "${topic}"
AUDIENCIA: ${audience || 'adultos en general interesados en el tema'}
PLATAFORMA: ${platform || 'Instagram y Facebook'}
TONO: ${tone || 'profesional, persuasivo y cercano'}

Cada script debe incluir:
- hook: frase que detiene el scroll y genera curiosidad (máx 12 palabras, en español)
- body: cuerpo del mensaje, claro y persuasivo (2-3 oraciones en español)
- cta: llamada a la acción directa y urgente (máx 6 palabras en español)
- hashtags: 6 hashtags relevantes en español e inglés
- visual_description: descripción detallada en INGLÉS para generar la imagen con IA. Debe especificar: tipo de fotografía, sujeto principal, ambiente, iluminación, paleta de colores, composición, estilo (ej: "cinematic product photography of..."). Debe ser profesional y apta para publicidad.

IMPORTANTE: Responde SOLO con JSON válido, sin texto adicional, sin bloques de código.
{
  "scripts": [
    {
      "id": 1,
      "hook": "...",
      "body": "...",
      "cta": "...",
      "hashtags": ["#ejemplo"],
      "visual_description": "..."
    }
  ]
}`
    }]
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  try {
    const json = JSON.parse(text.trim());
    return NextResponse.json(json);
  } catch {
    // Try to extract JSON if there's extra text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return NextResponse.json(JSON.parse(match[0]));
      } catch {}
    }
    return NextResponse.json({ error: 'Error al parsear respuesta', raw: text }, { status: 500 });
  }
}
