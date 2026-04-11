// ─── Transcription ────────────────────────────────────────────────────────────

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface Transcription {
  segments: TranscriptionSegment[];
  language?: string;
}

// ─── Video Project ─────────────────────────────────────────────────────────────

export type VideoProjectStatus = 'uploading' | 'processing' | 'ready' | 'error';

export interface VideoProject {
  id: string;
  user_id: string;
  title: string;
  original_filename: string;
  storage_path: string;
  thumbnail_path: string | null;
  thumbnail_url?: string; // signed URL — populated by /api/projects list endpoint
  duration_seconds: number | null;
  resolution: string | null;
  fps: number | null;
  file_size_bytes: number | null;
  status: VideoProjectStatus;
  transcription: Transcription | null;
  metadata: VideoMetadata | null;
  created_at: string;
  updated_at: string;
}

export interface VideoMetadata {
  bitrate?: number;
  video_codec?: string;
  audio_codec?: string;
  audio_tracks?: number;
  format?: string;
}

// ─── Edit Operations ───────────────────────────────────────────────────────────

export type EditOperationStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'needs_clarification';

export interface EditOperation {
  id: string;
  project_id: string;
  user_id: string;
  instruction: string;
  ai_interpretation: EditPlan | Record<string, unknown>;
  ffmpeg_commands: Record<string, unknown>;
  status: EditOperationStatus;
  output_path: string | null;
  error_message: string | null;
  processing_time_ms: number | null;
  created_at: string;
}

// ─── Edit Plan (Claude output) ─────────────────────────────────────────────────

export type OperationType =
  | 'trim'
  | 'clip'
  | 'extract_clips'
  | 'add_subtitles'
  | 'generate_reel'
  | 'remove_silence'
  | 'add_intro_outro'
  | 'change_speed'
  | 'extract_audio'
  | 'add_overlay'
  | 'resize';

export type FFmpegCommandType =
  | 'trim'
  | 'concat'
  | 'subtitle'
  | 'speed'
  | 'resize'
  | 'crop'
  | 'silence_remove'
  | 'audio_extract'
  | 'overlay'
  | 'filter';

export interface FFmpegOperation {
  step: number;
  command_type: FFmpegCommandType;
  parameters: Record<string, unknown>;
  input_file: string; // 'original' | 'step_N'
  output_file: string; // 'step_N' | 'final'
  description: string;
}

export interface EstimatedOutput {
  duration_seconds?: number;
  format: string;
  description: string;
}

export interface EditPlan {
  operation_type: OperationType;
  description: string;
  confidence: number;
  requires_clarification: boolean;
  clarification_question?: string;
  ffmpeg_operations: FFmpegOperation[];
  estimated_output: EstimatedOutput;
}

// ─── Video Export ──────────────────────────────────────────────────────────────

export type ExportType =
  | 'clip'
  | 'trim'
  | 'reel'
  | 'summary'
  | 'subtitled'
  | 'audio'
  | 'resized';

export interface VideoExport {
  id: string;
  project_id: string;
  operation_id: string | null;
  export_type: ExportType;
  storage_path: string;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  download_url: string | null;
  expires_at: string | null;
  created_at: string;
}

// ─── Edit Preset ───────────────────────────────────────────────────────────────

export interface EditPreset {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  template_instruction: string;
  ai_config: Record<string, unknown> | null;
  is_public: boolean;
  usage_count: number;
  created_at: string;
}

// ─── Image Generation ─────────────────────────────────────────────────────────

export interface AdScript {
  id: number;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  visual_description: string;
}

export type ImageFormat = 'square' | 'portrait' | 'landscape';

export interface GeneratedImage {
  id: string;
  user_id: string;
  prompt: string;
  topic: string | null;
  platform: string | null;
  format: ImageFormat;
  width: number;
  height: number;
  storage_path: string;
  script_data: AdScript | null;
  model: string;
  status: string;
  created_at: string;
  signed_url?: string;
}

// ─── API Response types ────────────────────────────────────────────────────────

export interface UploadResponse {
  project_id: string;
  storage_path: string;
}

export interface EditResponse {
  status: EditOperationStatus;
  operation_id: string;
  question?: string;
  output_path?: string;
}

export interface MetadataResponse {
  duration_seconds: number;
  resolution: string;
  fps: number;
  file_size_bytes: number;
  metadata: VideoMetadata;
}
