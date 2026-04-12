import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildDirectPlan, buildOperationLabel, DirectEditOptions } from '@/lib/ffmpeg/plan-builder';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json();
  const { project_id, instruction, subtitle_style, subtitle_position, subtitle_fontsize, direct_options } = body as {
    project_id: string;
    instruction?: string;
    subtitle_style?: string;
    subtitle_position?: string;
    subtitle_fontsize?: string;
    direct_options?: DirectEditOptions;
  };

  const hasDirectOps =
    direct_options &&
    (direct_options.subtitles ||
      direct_options.removeSilence ||
      direct_options.verticalCrop ||
      (direct_options.speed && direct_options.speed !== 1.0));

  if (!project_id || (!instruction?.trim() && !hasDirectOps)) {
    return NextResponse.json(
      { error: 'Selecciona al menos una transformación o escribe una instrucción' },
      { status: 400 }
    );
  }

  // Verify project belongs to user
  const { data: project } = await supabase
    .from('video_projects')
    .select('id, status, transcription')
    .eq('id', project_id)
    .eq('user_id', user.id)
    .single();

  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

  // For direct plans: build the FFmpeg operation list now (without Claude).
  // We pass empty segments here — silence_remove gets real segments injected at process time.
  let ffmpegCommands: Record<string, unknown> = {};
  let operationInstruction = instruction?.trim() ?? '';

  if (hasDirectOps && direct_options) {
    const plan = buildDirectPlan(direct_options, []); // segments injected later
    operationInstruction = operationInstruction || buildOperationLabel(direct_options);
    ffmpegCommands = {
      mode: 'direct',
      preset_operations: plan,
      direct_options,
      subtitle_style: direct_options.subtitleStyle ?? subtitle_style ?? 'capcut',
      subtitle_position: subtitle_position ?? 'bottom',
      subtitle_fontsize: subtitle_fontsize ?? 'md',
    };
  } else if (subtitle_style || instruction) {
    ffmpegCommands = {
      subtitle_style: subtitle_style ?? 'capcut',
      subtitle_position: subtitle_position ?? 'bottom',
      subtitle_fontsize: subtitle_fontsize ?? 'md',
    };
  }

  const { data: operation, error: opError } = await supabase
    .from('edit_operations')
    .insert({
      project_id,
      user_id: user.id,
      instruction: operationInstruction,
      ai_interpretation: {},
      ffmpeg_commands: ffmpegCommands,
      status: 'pending',
    })
    .select()
    .single();

  if (opError || !operation) {
    return NextResponse.json({ error: 'Error al crear operación' }, { status: 500 });
  }

  return NextResponse.json({ operation_id: operation.id }, { status: 201 });
}
