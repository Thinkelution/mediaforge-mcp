import { extractAudioTrack, getMediaInfo } from "../providers/ffmpeg.js";
import {
  validateFileExists,
  validateFileSize,
  validateVideoFormat,
  getFileSizeMB,
} from "../utils/file-manager.js";
import { requireString, optionalString, optionalEnum } from "../utils/validators.js";
import type { McpToolResponse } from "../types/common.js";
import { logger } from "../utils/logger.js";

export const extractAudioSchema = {
  name: "extract_audio",
  description:
    "Extract audio track from a video file. Supports output as mp3, wav, aac, flac, or ogg. Can also extract a specific time range.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "Absolute path to the video file",
      },
      output_format: {
        type: "string",
        enum: ["mp3", "wav", "aac", "flac", "ogg"],
        description: "Audio output format",
        default: "mp3",
      },
      bitrate: {
        type: "string",
        description: "Audio bitrate (e.g., '128k', '192k', '320k')",
        default: "192k",
      },
      start_time: {
        type: "string",
        description: "Start time for extraction in HH:MM:SS or seconds format.",
      },
      end_time: {
        type: "string",
        description: "End time for extraction in HH:MM:SS or seconds format.",
      },
      channels: {
        type: "string",
        enum: ["mono", "stereo"],
        description: "Output audio channels",
        default: "stereo",
      },
    },
    required: ["file_path"],
  },
};

export async function extractAudio(args: Record<string, unknown>): Promise<McpToolResponse> {
  try {
    const filePath = requireString(args.file_path, "file_path");
    const outputFormat = optionalEnum(
      args.output_format,
      "output_format",
      ["mp3", "wav", "aac", "flac", "ogg"],
      "mp3"
    );
    const bitrate = optionalString(args.bitrate, "bitrate") || "192k";
    const startTime = optionalString(args.start_time, "start_time");
    const endTime = optionalString(args.end_time, "end_time");
    const channels = optionalEnum(args.channels, "channels", ["mono", "stereo"], "stereo");

    validateFileExists(filePath);
    validateFileSize(filePath);
    validateVideoFormat(filePath);

    logger.info(`Extracting audio: ${filePath} -> ${outputFormat} @ ${bitrate}`);

    const outputPath = await extractAudioTrack(filePath, outputFormat, bitrate, channels, startTime, endTime);
    const info = await getMediaInfo(outputPath);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "success",
            output_file: outputPath,
            format: outputFormat,
            duration_seconds: info.duration_seconds,
            file_size_mb: getFileSizeMB(outputPath),
            sample_rate: info.audio?.sample_rate || 44100,
            channels,
          }),
        },
      ],
    };
  } catch (err: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            error_code: err.code || "FFMPEG_ERROR",
            message: err.message || String(err),
            suggestion: err.suggestion,
          }),
        },
      ],
      isError: true,
    };
  }
}
