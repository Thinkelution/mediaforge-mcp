export interface GroqTranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }>;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

export interface FfprobeStream {
  codec_type: "video" | "audio" | "subtitle";
  codec_name: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  bit_rate?: string;
  sample_rate?: string;
  channels?: number;
  tags?: Record<string, string>;
}

export interface FfprobeFormat {
  filename: string;
  format_name: string;
  format_long_name: string;
  duration: string;
  size: string;
  bit_rate: string;
  tags?: Record<string, string>;
}

export interface FfprobeOutput {
  streams: FfprobeStream[];
  format: FfprobeFormat;
}
