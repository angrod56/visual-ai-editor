import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data } = await supabase
    .from('edit_presets')
    .select('*')
    .or(`user_id.eq.${user.id},is_public.eq.true`)
    .order('usage_count', { ascending: false });

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json();
  const { name, description, template_instruction, is_public = false } = body;

  if (!name || !template_instruction) {
    return NextResponse.json({ error: 'name y template_instruction son requeridos' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('edit_presets')
    .insert({ user_id: user.id, name, description, template_instruction, is_public })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
