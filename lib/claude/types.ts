import { z } from 'zod';

// ─── Zod Schemas for runtime validation of Claude's JSON output ────────────────

const FFmpegCommandTypeSchema = z.enum([
  'trim',
  'concat',
  'subtitle',
  'speed',
  'resize',
  'audio_extract',
  'overlay',
  'filter',
]);

const FFmpegOperationSchema = z.object({
  step: z.number().int().positive(),
  command_type: FFmpegCommandTypeSchema,
  parameters: z.record(z.string(), z.unknown()),
  input_file: z.string(),
  output_file: z.string(),
  description: z.string(),
});

const EstimatedOutputSchema = z.object({
  duration_seconds: z.number().optional(),
  format: z.string(),
  description: z.string(),
});

export const EditPlanSchema = z.object({
  operation_type: z.enum([
    'trim',
    'clip',
    'extract_clips',
    'add_subtitles',
    'generate_reel',
    'remove_silence',
    'add_intro_outro',
    'change_speed',
    'extract_audio',
    'add_overlay',
    'resize',
  ]),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  requires_clarification: z.boolean(),
  clarification_question: z.string().nullable().optional(),
  ffmpeg_operations: z.array(FFmpegOperationSchema),
  estimated_output: EstimatedOutputSchema,
});

export type EditPlanValidated = z.infer<typeof EditPlanSchema>;

export interface VideoContext {
  duration: number;
  transcription: {
    segments: Array<{ start: number; end: number; text: string }>;
  };
  resolution: string;
  fps: number;
  filename: string;
}
