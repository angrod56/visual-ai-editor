import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { interpretInstruction } from '@/lib/claude/video-orchestrator';
import { executeEditPlan } from '@/lib/ffmpeg/executor';
import { generateASSFile } from '@/lib/ffmpeg/subtitle-styles';
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

  try {
    let ffmpegOperations: FFmpegOperation[];
    let exportType: ReturnType<typeof mapOperationTypeToExportType> = 'clip';
    let estimatedDuration: number | null = null;
    let aiInterpretation: Record<string, unknown> = {};

    // Download video to /tmp
    const tmpInputPath = path.join('/tmp', `${operation.project_id}_input.mp4`);
    const tmpOutputDir = path.join('/tmp', operationId);
    const videoBuffer = await downloadToBuffer(typedProject.storage_path);
    await fs.writeFile(tmpInputPath, videoBuffer);
    await fs.mkdir(tmpOutputDir, { recursive: true });

    if (isDirectMode) {
      // ── Direct mode: use pre-built plan, inject real transcription segments ──
      const directOptions = storedCommands.direct_options as DirectEditOptions;
      const subtitleStyle = storedCommands.subtitle_style as string ?? 'clasico';

      // Rebuild plan with real segments (silence_remove needs them)
      ffmpegOperations = buildDirectPlan(
        { ...directOptions, subtitleStyle },
        transcription.segments
      );

      // Inject ASS path for subtitle operations
      const subOps = ffmpegOperations.filter((op) => op.command_type === 'subtitle');
      if (subOps.length > 0 && transcription.segments.length > 0) {
        const assPath = await generateASSFile(transcription.segments, tmpOutputDir, subtitleStyle);
        subOps.forEach((op) => {
          (op.parameters as Record<string, unknown>).ass_path = assPath;
        });
      }

      // Determine export type from selected ops
      if (directOptions.subtitles && directOptions.verticalCrop) exportType = 'reel';
      else if (directOptions.subtitles) exportType = 'subtitled';
      else if (directOptions.verticalCrop) exportType = 'resized';
      else if (directOptions.speed) exportType = 'clip';
      else exportType = 'clip';

      aiInterpretation = { mode: 'direct', options: directOptions };

    } else {
      // ── Claude mode: interpret natural language instruction ──
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

      // Inject ASS path for subtitle operations
      const subOps = ffmpegOperations.filter((op) => op.command_type === 'subtitle');
      if (subOps.length > 0 && transcription.segments.length > 0) {
        const claudeStyle = storedCommands.subtitle_style as string ?? 'clasico';
        const assPath = await generateASSFile(transcription.segments, tmpOutputDir, claudeStyle);
        subOps.forEach((op) => {
          (op.parameters as Record<string, unknown>).ass_path = assPath;
        });
      }
    }

    if (ffmpegOperations.length === 0) {
      throw new Error('No se generaron operaciones FFmpeg para ejecutar');
    }

    // Execute FFmpeg pipeline
    const result = await executeEditPlan(tmpInputPath, ffmpegOperations, tmpOutputDir);

    if (!result.success || !result.outputPath) {
      throw new Error(result.error ?? 'FFmpeg terminó sin resultado');
    }

    // Upload result to R2
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
