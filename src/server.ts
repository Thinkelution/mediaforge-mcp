import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { transcribeMedia, transcribeMediaSchema } from "./tools/transcribe.js";
import { generateSubtitles, generateSubtitlesSchema } from "./tools/generate-subtitles.js";
import { extractAudio, extractAudioSchema } from "./tools/extract-audio.js";
import { mediaInfo, mediaInfoSchema } from "./tools/media-info.js";
import { logger } from "./utils/logger.js";

export function createServer(): Server {
  const server = new Server(
    {
      name: "mediaforge-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      transcribeMediaSchema,
      generateSubtitlesSchema,
      extractAudioSchema,
      mediaInfoSchema,
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info(`Tool called: ${name}`);

    switch (name) {
      case "transcribe_media":
        return transcribeMedia(args as Record<string, unknown>);
      case "generate_subtitles":
        return generateSubtitles(args as Record<string, unknown>);
      case "extract_audio":
        return extractAudio(args as Record<string, unknown>);
      case "media_info":
        return mediaInfo(args as Record<string, unknown>);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}
