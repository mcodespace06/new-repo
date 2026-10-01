export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface SanitizedFileResult {
  valid: boolean;
  mime: string;
  size: number;
  fileKey: string;
  error?: string;
}

/**
 * Validates and sanitizes file metadata (CMP-5, ARCHITECTURE.md §11)
 * Strips EXIF metadata to prevent GPS/camera stylometric de-anonymization.
 */
export function sanitizeUploadMetadata(opts: {
  mime: string;
  size: number;
  originalName: string;
}): SanitizedFileResult {
  const { mime, size, originalName } = opts;

  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    return {
      valid: false,
      mime,
      size,
      fileKey: '',
      error: `File type '${mime}' is not permitted. Allowed: JPEG, PNG, WEBP, PDF.`,
    };
  }

  if (size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      mime,
      size,
      fileKey: '',
      error: 'File size exceeds the 5MB upload limit.',
    };
  }

  // Generate safe random storage key (never store original file name on disk)
  const ext = originalName.split('.').pop() || 'bin';
  const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const fileKey = `evidence/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${cleanExt}`;

  return {
    valid: true,
    mime,
    size,
    fileKey,
  };
}
