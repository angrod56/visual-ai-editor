import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { interpretInstruction } from '@/lib/claude/video-orchestrator';
import { executeEditPlan, generateSRTFile } from '@/lib/ffmpeg/executor';
import { downloadToBuffer, uploadBuffer } from '@/lib/utils/storage';
import { buildExportPath } from '@/lib/utils/video';
import { VideoProject, Transcription } from '@/types';
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

  // Load operation
  const { data: operation } = await supabase
    .from('edit_operations')
    .select('*')
    .eq('id', operationId)
    .eq('user_id', user.id)
    .single();

  if (!operation) return NextResponse.json({ error: 'Operación no encontrada' }, { status: 404 });

  // Load project
  const { data: project } = await supabase
    .from('video_projects')
    .select('*')
    .eq('id', operation.project_id)
    .eq('user_id', user.id)
    .single();

  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

  const typedProject = project as VideoProject;
  const startTime = Date.now();

  // Mark as processing
  await supabase
    .from('edit_operations')
    .update({ status: 'processing' })
    .eq('id', operationId);

  const transcription = (typedProject.transcription as Transcription) ?? { segments: [] };

  try {
    // 1. Claude interprets instruction
    const editPlan = await interpretInstruction(operation.instruction, {
      duration: typedProject.duration_seconds ?? 0,
      transcription,
      resolution: typedProject.resolution ?? '1920x1080',
      fps: typedProject.fps ?? 30,
      filename: typedProject.original_filename,
    });

    // 2. Handle clarification request
    if (editPlan.requires_clarification) {
      await supabase
        .from('edit_operations')
        .update({
          status: 'needs_clarification',
          ai_interpretation: editPlan,
        })
        .eq('id', operationId);

      return NextResponse.json({
        status: 'needs_clarification',
        question: editPlan.clarification_question,
      });
    }

    // 3. Download video from R2 to /tmp
    const tmpInputPath = path.join('/tmp', `${operation.project_id}_input.mp4`);
    const tmpOutputDir = path.join('/tmp', operationId);

    const videoBuffer = await downloadToBuffer(typedProject.storage_path);
    await fs.writeFile(tmpInputPath, videoBuffer);
    await fs.mkdir(tmpOutputDir, { recursive: true });

    // 4. Generate SRT if needed
    const opsWithSubtitles = editPlan.ffmpeg_operations.filter(
      (op) => op.command_type === 'subtitle'
    );
    if (opsWithSubtitles.length > 0 && transcription.segments.length > 0) {
      const srtPath = await generateSRTFile(transcription.segments, tmpOutputDir);
      opsWithSubtitles.forEach((op) => {
        (op.parameters as Record<string, unknown>).srt_path = srtPath;
      });
    }

    // 5. Execute FFmpeg plan
    const result = await executeEditPlan(
      tmpInputPath,
      editPlan.ffmpeg_operations,
      tmpOutputDir
    );

    if (!result.success || !result.outputPath) {
      throw new Error(result.error ?? 'FFmpeg ejecutó sin resultado');
    }

    // 6. Upload result to R2
    const isAudio = result.outputPath?.endsWith('.mp3') || result.outputPath?.endsWith('.aac') || result.outputPath?.endsWith('.wav');
    const outputExt = isAudio ? (result.outputPath!.split('.').pop() ?? 'mp3') : 'mp4';
    const outputKey = isAudio
      ? `exports/${user.id}/${operationId}/output.${outputExt}`
      : buildExportPath(user.id, operationId);
    const contentType = isAudio ? `audio/${outputExt}` : 'video/mp4';
    const outputBuffer = await fs.readFile(result.outputPath!);
    await uploadBuffer(outputBuffer, outputKey, contentType);

    // 7. Create export record
    const { data: exportRecord } = await supabase
      .from('video_exports')
      .insert({
        project_id: operation.project_id,
        operation_id: operationId,
        export_type: mapOperationTypeToExportType(editPlan.operation_type),
        storage_path: outputKey,
        file_size_bytes: outputBuffer.length,
        duration_seconds: editPlan.estimated_output.duration_seconds ?? null,
      })
      .select()
      .single();

    // 8. Mark operation as completed
    await supabase
      .from('edit_operations')
      .update({
        status: 'completed',
        ai_interpretation: editPlan,
        ffmpeg_commands: { operations: editPlan.ffmpeg_operations },
        output_path: outputKey,
        processing_time_ms: Date.now() - startTime,
      })
      .eq('id', operationId);

    // 9. Cleanup /tmp
    await fs.rm(tmpOutputDir, { recursive: true, force: true }).catch(() => {});
    await fs.unlink(tmpInputPath).catch(() => {});

    return NextResponse.json({
      status: 'completed',
      export_id: exportRecord?.id,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido al procesar';

    await supabase
      .from('edit_operations')
      .update({
        status: 'failed',
        error_message: errorMessage,
        processing_time_ms: Date.now() - startTime,
      })
      .eq('id', operationId);

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

function mapOperationTypeToExportType(
  opType: string
): 'clip' | 'trim' | 'reel' | 'summary' | 'subtitled' | 'audio' | 'resized' {
  const map: Record<string, 'clip' | 'trim' | 'reel' | 'summary' | 'subtitled' | 'audio' | 'resized'> = {
    trim: 'trim',
    clip: 'clip',
    extract_clips: 'clip',
    add_subtitles: 'subtitled',
    generate_reel: 'reel',
    remove_silence: 'trim',
    add_intro_outro: 'clip',
    change_speed: 'clip',
    extract_audio: 'audio',
    add_overlay: 'clip',
    resize: 'resized',
  };
  return map[opType] ?? 'clip';
}
