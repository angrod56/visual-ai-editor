import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { interpretInstruction } from '@/lib/claude/video-orchestrator';
import { executeEditPlan } from '@/lib/ffmpeg/executor';
import { buildDirectPlan, DirectEditOptions } from '@/lib/ffmpeg/plan-builder';
import { downloadToBuffer, uploadBuffer } from '@/lib/utils/storage';
import { buildExportPath } from '@/lib/utils/video';
import { VideoProject, Transcription, FFmpegOperation } from '@/types';
import fs from 'fs/promises';
import path from 'path';

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: operationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: operation } = await supabase
    .from('edit_operations')
    .select('*')
    .eq('id', operationId)
    .eq('user_id', user.id)
    .single();

  if (!operation) return NextResponse.json({ error: 'Operación no encontrada' }, { status: 404 });

  // Idempotency: only proceed if still pending
  if (operation.status !== 'pending') {
    return NextResponse.json({ status: operation.status });
  }

  const { data: claimed } = await supabase
    .from('edit_operations')
    .update({ status: 'processing' })
    .eq('id', operationId)
    .eq('status', 'pending')
    .select('id')
    .single();

  if (!claimed) {
    return NextResponse.json({ status: 'already_processing' });
  }

  const { data: project } = await supabase
    .from('video_projects')
    .select('*')
    .eq('id', operation.project_id)
    .eq('user_id', user.id)
    .single();

  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

  const typedProject = project as VideoProject;
  const startTime = Date.now();
  const transcription = (typedProject.transcription as Transcription) ?? { segments: [] };

  const storedCommands = (operation.ffmpeg_commands ?? {}) as Record<string, unknown>;
  const isDirectMode = storedCommands.mode === 'direct';

  // Helper: push a progress step visible to the client via Realtime
  const setStep = (step: string) =>
    supabase
      .from('edit_operations')
      .update({ ai_interpretation: { _progress: step } })
      .eq('id', operationId)
      .then(() => {});

  try {
    let ffmpegOperations: FFmpegOperation[];
    let exportType: ReturnType<typeof mapOperationTypeToExportType> = 'clip';
    let estimatedDuration: number | null = null;
    let aiInterpretation: Record<string, unknown> = {};

    const subtitlePosition = storedCommands.subtitle_position as string ?? 'bottom';
  const subtitleFontSize = storedCommands.subtitle_fontsize as string ?? 'md';

  if (isDirectMode) {
      await setStep('Preparando edición...');
      const directOptions = storedCommands.direct_options as DirectEditOptions;
      const subtitleStyle = storedCommands.subtitle_style as string ?? 'capcut';

      ffmpegOperations = buildDirectPlan(
        { ...directOptions, subtitleStyle },
        transcription.segments
      );

      const subOps = ffmpegOperations.filter((op) => op.command_type === 'subtitle');
      if (subOps.length > 0 && transcription.segments.length > 0) {
        subOps.forEach((op) => {
          (op.parameters as Record<string, unknown>).segments = transcription.segments;
          (op.parameters as Record<string, unknown>).style = subtitleStyle;
          (op.parameters as Record<string, unknown>).position = subtitlePosition;
          (op.parameters as Record<string, unknown>).fontsize = subtitleFontSize;
        });
      }

      if (directOptions.subtitles && directOptions.verticalCrop) exportType = 'reel';
      else if (directOptions.subtitles) exportType = 'subtitled';
      else if (directOptions.verticalCrop) exportType = 'resized';
      else if (directOptions.speed) exportType = 'clip';
      else exportType = 'clip';

      aiInterpretation = { mode: 'direct', options: directOptions };

    } else {
      await setStep('Interpretando instrucción con IA...');
      const editPlan = await interpretInstruction(operation.instruction, {
        duration: typedProject.duration_seconds ?? 0,
        transcription,
        resolution: typedProject.resolution ?? '1920x1080',
        fps: typedProject.fps ?? 30,
        filename: typedProject.original_filename,
      });

      if (editPlan.requires_clarification) {
        await supabase
          .from('edit_operations')
          .update({ status: 'needs_clarification', ai_interpretation: editPlan })
          .eq('id', operationId);
        return NextResponse.json({ status: 'needs_clarification', question: editPlan.clarification_question });
      }

      ffmpegOperations = editPlan.ffmpeg_operations;
      exportType = mapOperationTypeToExportType(editPlan.operation_type);
      estimatedDuration = editPlan.estimated_output.duration_seconds ?? null;
      aiInterpretation = editPlan as unknown as Record<string, unknown>;

      const subOps = ffmpegOperations.filter((op) => op.command_type === 'subtitle');
      if (subOps.length > 0 && transcription.segments.length > 0) {
        subOps.forEach((op) => {
          (op.parameters as Record<string, unknown>).segments = transcription.segments;
          (op.parameters as Record<string, unknown>).style = storedCommands.subtitle_style as string ?? 'capcut';
          (op.parameters as Record<string, unknown>).position = subtitlePosition;
          (op.parameters as Record<string, unknown>).fontsize = subtitleFontSize;
        });
      }
    }

    if (ffmpegOperations.length === 0) {
      throw new Error('No se generaron operaciones FFmpeg para ejecutar');
    }

    // Download video to /tmp
    await setStep('Descargando video...');
    const tmpInputPath = path.join('/tmp', `${operation.project_id}_input.mp4`);
    const tmpOutputDir = path.join('/tmp', operationId);
    const videoBuffer = await downloadToBuffer(typedProject.storage_path);
    await fs.writeFile(tmpInputPath, videoBuffer);
    await fs.mkdir(tmpOutputDir, { recursive: true });

    // Execute FFmpeg pipeline
    await setStep('Ejecutando edición con FFmpeg...');
    const result = await executeEditPlan(tmpInputPath, ffmpegOperations, tmpOutputDir);

    if (!result.success || !result.outputPath) {
      throw new Error(result.error ?? 'FFmpeg terminó sin resultado');
    }

    // Upload result to R2
    await setStep('Subiendo resultado...');
    const isAudio = /\.(mp3|aac|wav)$/.test(result.outputPath);
    const outputExt = isAudio ? result.outputPath.split('.').pop()! : 'mp4';
    const outputKey = isAudio
      ? `exports/${user.id}/${operationId}/output.${outputExt}`
      : buildExportPath(user.id, operationId);
    const contentType = isAudio ? `audio/${outputExt}` : 'video/mp4';
    const outputBuffer = await fs.readFile(result.outputPath);
    await uploadBuffer(outputBuffer, outputKey, contentType);

    // Create export record
    const { data: exportRecord } = await supabase
      .from('video_exports')
      .insert({
        project_id: operation.project_id,
        operation_id: operationId,
        export_type: exportType,
        storage_path: outputKey,
        file_size_bytes: outputBuffer.length,
        duration_seconds: estimatedDuration,
      })
      .select()
      .single();

    // Mark completed
    await supabase
      .from('edit_operations')
      .update({
        status: 'completed',
        ai_interpretation: aiInterpretation,
        ffmpeg_commands: storedCommands,
        output_path: outputKey,
        processing_time_ms: Date.now() - startTime,
      })
      .eq('id', operationId);

    // Cleanup
    await fs.rm(tmpOutputDir, { recursive: true, force: true }).catch(() => {});
    await fs.unlink(tmpInputPath).catch(() => {});

    return NextResponse.json({ status: 'completed', export_id: exportRecord?.id });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido al procesar';
    await supabase
      .from('edit_operations')
      .update({ status: 'failed', error_message: errorMessage, processing_time_ms: Date.now() - startTime })
      .eq('id', operationId);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

function mapOperationTypeToExportType(
  opType: string
): 'clip' | 'trim' | 'reel' | 'summary' | 'subtitled' | 'audio' | 'resized' {
  const map: Record<string, 'clip' | 'trim' | 'reel' | 'summary' | 'subtitled' | 'audio' | 'resized'> = {
    trim: 'trim', clip: 'clip', extract_clips: 'clip',
    add_subtitles: 'subtitled', generate_reel: 'reel',
    remove_silence: 'trim', change_speed: 'clip',
    extract_audio: 'audio', add_overlay: 'clip', resize: 'resized',
  };
  return map[opType] ?? 'clip';
}
