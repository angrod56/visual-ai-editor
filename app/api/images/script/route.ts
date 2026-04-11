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
      content: `Eres un director creativo senior especializado en Meta Ads de alta conversión (Facebook/Instagram). Tu trabajo es crear scripts de anuncios que detengan el scroll y generen ventas reales.

Genera ${count} scripts DIFERENTES entre sí para:
PRODUCTO/SERVICIO: "${topic}"
AUDIENCIA: ${audience || 'adultos en general interesados en el tema'}
PLATAFORMA: ${platform || 'Instagram y Facebook'}
TONO: ${tone || 'profesional, persuasivo y cercano'}

Cada script debe incluir:
- hook: frase de impacto que detiene el scroll en menos de 2 segundos (máx 10 palabras, en español, sin signos de interrogación genéricos)
- body: cuerpo persuasivo con beneficio claro + prueba social o urgencia (2-3 oraciones en español)
- cta: llamada a la acción directa e irresistible (máx 6 palabras en español)
- hashtags: 6 hashtags relevantes mezclando español e inglés
- visual_description: prompt profesional en INGLÉS para generar una fotografía comercial fotorrealista de alta calidad con IA. DEBE incluir obligatoriamente:
  * Tipo exacto de fotografía (product photography, lifestyle portrait, editorial fashion, etc.)
  * Sujeto principal con descripción detallada
  * Ángulo de cámara (eye-level, low angle, top-down, etc.)
  * Iluminación profesional (soft box studio lighting, golden hour, cinematic lighting, rim light, etc.)
  * Fondo/ambiente detallado (clean white backdrop, blurred urban background, luxury interior, etc.)
  * Paleta de colores dominante
  * Composición (rule of thirds, centered, negative space on left/right/top/bottom for text overlay)
  * Estilo fotográfico (hyperrealistic, photojournalistic, luxury commercial, etc.)
  * Instrucción: "NO text, logos, watermarks, or graphics. Leave [top/bottom] area with clean space for advertising text overlay. Shot on Sony A7R V, 85mm lens, f/1.8."

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
