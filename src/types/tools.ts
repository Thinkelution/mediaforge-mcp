export interface TranscribeInput {
  file_path: string;
  language?: string;
  output_format?: "text" | "srt" | "vtt" | "json" | "verbose_json";
  word_timestamps?: boolean;
}

export interface GenerateSubtitlesInput {
  file_path: string;
  output_format?: "srt" | "vtt" | "both";
  burn_in?: boolean;
  language?: string;
  style?: {
    font_size?: number;
    font_color?: string;
    background_color?: string;
    position?: "bottom" | "top";
    font_name?: string;
  };
  max_chars_per_line?: number;
}

export interface ExtractAudioInput {
  file_path: string;
  output_format?: "mp3" | "wav" | "aac" | "flac" | "ogg";
  bitrate?: string;
  start_time?: string;
  end_time?: string;
  channels?: "mono" | "stereo";
}

export interface MediaInfoInput {
  file_path: string;
}
