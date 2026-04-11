import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET — list user's saved carousels
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data, error } = await supabase
    .from('carousels')
    .select('id, title, topic, theme_key, slide_count, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST — save a carousel
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { title, topic, slides, theme_key } = await request.json();
  if (!title || !slides?.length) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });

  const { data, error } = await supabase
    .from('carousels')
    .insert({
      user_id: user.id,
      title,
      topic: topic ?? title,
      slides,
      theme_key: theme_key ?? 'dark',
      slide_count: slides.length,
    })
    .select('id, title, topic, theme_key, slide_count, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
