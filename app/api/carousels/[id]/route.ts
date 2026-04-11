import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET — load a single carousel with full slides data
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data, error } = await supabase
    .from('carousels')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(data);
}

// DELETE — remove a carousel
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { error } = await supabase
    .from('carousels')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
