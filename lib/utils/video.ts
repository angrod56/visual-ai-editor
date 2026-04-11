/**
 * Format seconds into MM:SS or HH:MM:SS display string
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Format bytes to human-readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Generate a storage path for an original video upload
 */
export function buildOriginalPath(userId: string, projectId: string, filename: string): string {
  const ext = filename.split('.').pop() ?? 'mp4';
  return `originals/${userId}/${projectId}/original.${ext}`;
}

/**
 * Generate a storage path for an export
 */
export function buildExportPath(userId: string, operationId: string): string {
  return `exports/${userId}/${operationId}/output.mp4`;
}
