import { writeFileSync } from "fs";
import { transcribe } from "../providers/base-provider.js";
import { burnSubtitles } from "../providers/ffmpeg.js";
import {
  validateFileExists,
  validateFileSize,
  validateVideoFormat,
  tempPath,
} from "../utils/file-manager.js";
import { segmentsToSRT, segmentsToVTT } from "../utils/format-converter.js";
import { requireString, optionalString, optionalEnum, optionalBoolean, optionalNumber } from "../utils/validators.js";
import type { McpToolResponse } from "../types/common.js";
import { logger } from "../utils/logger.js";

export const generateSubtitlesSchema = {
  name: "generate_subtitles",
  description:
    "Generate subtitles for a video file. Can output SRT/VTT files or burn subtitles directly into the video. Supports styling options for burned-in subtitles.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "Absolute path to the video file",
      },
      output_format: {
        type: "string",
        enum: ["srt", "vtt", "both"],
        description: "Subtitle file format to generate",
        default: "srt",
      },
      burn_in: {
        type: "boolean",
        description:
          "If true, burns subtitles directly into the video and returns a new video file",
        default: false,
      },
      language: {
        type: "string",
        description: "ISO 639-1 language code. Auto-detects if not specified.",
        default: "auto",
      },
      style: {
        type: "object",
        description: "Subtitle styling (only applies when burn_in is true)",
        properties: {
          font_size: { type: "number", default: 24 },
          font_color: { type: "string", default: "white" },
          background_color: { type: "string", default: "black@0.5" },
          position: { type: "string", enum: ["bottom", "top"], default: "bottom" },
          font_name: { type: "string", default: "Arial" },
        },
      },
      max_chars_per_line: {
        type: "number",
        description: "Maximum characters per subtitle line.",
        default: 42,
      },
    },
    required: ["file_path"],
  },
};

export async function generateSubtitles(args: Record<string, unknown>): Promise<McpToolResponse> {
  try {
    const filePath = requireString(args.file_path, "file_path");
    const outputFormat = optionalEnum(args.output_format, "output_format", ["srt", "vtt", "both"], "srt");
    const burnIn = optionalBoolean(args.burn_in, "burn_in", false);
    const language = optionalString(args.language, "language") || "auto";
    const maxCharsPerLine = optionalNumber(args.max_chars_per_line, "max_chars_per_line", 42, 20, 80);
    const style = (args.style as Record<string, unknown>) || {};

    validateFileExists(filePath);
    validateFileSize(filePath);
    validateVideoFormat(filePath);

    logger.info(`Generating subtitles: ${filePath} (format=${outputFormat}, burn_in=${burnIn})`);

    const result = await transcribe(filePath, language === "auto" ? undefined : language);

    const response: Record<string, unknown> = {
      status: "success",
      total_segments: result.segments.length,
      duration_seconds: result.duration,
      language_detected: result.language,
    };

    if (outputFormat === "srt" || outputFormat === "both") {
      const srt = segmentsToSRT(result.segments, maxCharsPerLine);
      const srtPath = tempPath("subtitles", ".srt");
      writeFileSync(srtPath, srt, "utf-8");
      response.subtitle_file = srtPath;

      if (burnIn) {
        const burnedPath = await burnSubtitles(filePath, srtPath, {
          font_size: (style.font_size as number) || 24,
          font_color: (style.font_color as string) || "white",
          background_color: (style.background_color as string) || "black@0.5",
          position: (style.position as "bottom" | "top") || "bottom",
          font_name: (style.font_name as string) || "Arial",
        });
        response.burned_video = burnedPath;
      }
    }

    if (outputFormat === "vtt" || outputFormat === "both") {
      const vtt = segmentsToVTT(result.segments, maxCharsPerLine);
      const vttPath = tempPath("subtitles", ".vtt");
      writeFileSync(vttPath, vtt, "utf-8");
      response.subtitle_file_vtt = vttPath;
      if (!response.subtitle_file) {
        response.subtitle_file = vttPath;
      }
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
