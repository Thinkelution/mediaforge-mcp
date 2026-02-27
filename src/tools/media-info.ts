import { getMediaInfo } from "../providers/ffmpeg.js";
import { validateFileExists, validateMediaFormat } from "../utils/file-manager.js";
import { requireString } from "../utils/validators.js";
import type { McpToolResponse } from "../types/common.js";
import { logger } from "../utils/logger.js";

export const mediaInfoSchema = {
  name: "media_info",
  description:
    "Get detailed metadata and technical information about an audio or video file. Returns duration, codecs, resolution, bitrate, and more.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "Absolute path to the media file",
      },
    },
    required: ["file_path"],
  },
};

export async function mediaInfo(args: Record<string, unknown>): Promise<McpToolResponse> {
  try {
    const filePath = requireString(args.file_path, "file_path");

    validateFileExists(filePath);
    validateMediaFormat(filePath);

    logger.info(`Getting media info: ${filePath}`);

    const info = await getMediaInfo(filePath);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ status: "success", ...info }),
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
