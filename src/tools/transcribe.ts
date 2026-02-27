import { writeFileSync } from "fs";
import { transcribe } from "../providers/base-provider.js";
import {
  validateFileExists,
  validateFileSize,
  validateMediaFormat,
  tempPath,
} from "../utils/file-manager.js";
import { segmentsToSRT, segmentsToVTT } from "../utils/format-converter.js";
import { requireString, optionalString, optionalEnum, optionalBoolean } from "../utils/validators.js";
import type { McpToolResponse } from "../types/common.js";
import { logger } from "../utils/logger.js";

export const transcribeMediaSchema = {
  name: "transcribe_media",
  description:
    "Transcribe audio or video file to text with timestamps. Supports mp3, mp4, wav, m4a, webm, ogg, flac formats. Returns full transcript with word-level or segment-level timestamps.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "Absolute path to the audio or video file to transcribe",
      },
      language: {
        type: "string",
        description:
          "ISO 639-1 language code (e.g., 'en', 'hi', 'ta', 'es'). Auto-detects if not specified.",
        default: "auto",
      },
      output_format: {
        type: "string",
        enum: ["text", "srt", "vtt", "json", "verbose_json"],
        description:
          "Output format. 'text' for plain transcript, 'srt'/'vtt' for subtitle formats, 'json' for structured data with timestamps.",
        default: "json",
      },
      word_timestamps: {
        type: "boolean",
        description: "Include word-level timestamps (slower but more precise)",
        default: false,
      },
    },
    required: ["file_path"],
  },
};

export async function transcribeMedia(args: Record<string, unknown>): Promise<McpToolResponse> {
  try {
    const filePath = requireString(args.file_path, "file_path");
    const language = optionalString(args.language, "language") || "auto";
    const outputFormat = optionalEnum(
      args.output_format,
      "output_format",
      ["text", "srt", "vtt", "json", "verbose_json"],
      "json"
    );
    const wordTimestamps = optionalBoolean(args.word_timestamps, "word_timestamps", false);

    validateFileExists(filePath);
    validateFileSize(filePath);
    validateMediaFormat(filePath);

    logger.info(`Transcribing: ${filePath} (format=${outputFormat}, lang=${language})`);

    const result = await transcribe(filePath, language === "auto" ? undefined : language, wordTimestamps);

    let outputFile: string | undefined;

    if (outputFormat === "srt") {
      const srt = segmentsToSRT(result.segments);
      outputFile = tempPath("transcript", ".srt");
      writeFileSync(outputFile, srt, "utf-8");
    } else if (outputFormat === "vtt") {
      const vtt = segmentsToVTT(result.segments);
      outputFile = tempPath("transcript", ".vtt");
      writeFileSync(outputFile, vtt, "utf-8");
    } else if (outputFormat === "json" || outputFormat === "verbose_json") {
      outputFile = tempPath("transcript", ".json");
      writeFileSync(outputFile, JSON.stringify(result, null, 2), "utf-8");
    }

    const response: Record<string, unknown> = {
      status: "success",
      language_detected: result.language,
      duration_seconds: result.duration,
      transcript: result.text,
    };

    if (outputFormat !== "text") {
      response.segments = result.segments;
    }
    if (outputFile) {
      response.output_file = outputFile;
    }

    return {
      content: [{ type: "text", text: JSON.stringify(response) }],
    };
  } catch (err: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            error_code: err.code || "PROVIDER_ERROR",
            message: err.message || String(err),
            suggestion: err.suggestion,
          }),
        },
      ],
      isError: true,
    };
  }
}
