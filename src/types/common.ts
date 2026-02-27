export interface ToolSuccess {
  status: "success";
  [key: string]: unknown;
}

export interface ToolError {
  status: "error";
  error_code: ErrorCode;
  message: string;
  suggestion?: string;
}

export type ErrorCode =
  | "FILE_NOT_FOUND"
  | "UNSUPPORTED_FORMAT"
  | "FILE_TOO_LARGE"
  | "PROVIDER_ERROR"
  | "PROVIDER_RATE_LIMITED"
  | "FFMPEG_ERROR"
  | "INVALID_PARAMS"
  | "TIMEOUT";

export interface McpToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

export interface TranscriptionResult {
  language: string;
  duration: number;
  text: string;
  segments: TranscriptionSegment[];
}

export interface MediaStreamInfo {
  codec: string;
  resolution?: string;
  fps?: number;
  bitrate_kbps?: number;
  sample_rate?: number;
  channels?: number;
}

export interface MediaMetadata {
  file_name: string;
  file_size_mb: number;
  duration_seconds: number;
  duration_formatted: string;
  format: string;
  video?: MediaStreamInfo;
  audio?: MediaStreamInfo;
  has_subtitles: boolean;
  subtitle_tracks: string[];
}
