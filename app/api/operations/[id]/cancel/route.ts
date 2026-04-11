import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { error } = await supabase
    .from('edit_operations')
    .update({
      status: 'failed',
      error_message: 'Cancelado por el usuario',
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .in('status', ['pending', 'processing']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ cancelled: true });
}
