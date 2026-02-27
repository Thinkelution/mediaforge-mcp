#!/usr/bin/env node

import { config, ensureTempDir, checkFfmpeg } from "./config.js";
import { createServer } from "./server.js";
import { logger } from "./utils/logger.js";
import { cleanupOldFiles } from "./utils/file-manager.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";

async function main() {
  checkFfmpeg();
  ensureTempDir();

  cleanupOldFiles();
  setInterval(cleanupOldFiles, 30 * 60 * 1000);

  const server = createServer();

  if (config.transport === "http") {
    await startHttpTransport(server);
  } else {
    await startStdioTransport(server);
  }
}

async function startStdioTransport(server: ReturnType<typeof createServer>) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MediaForge MCP server running on stdio");
}

async function startHttpTransport(server: ReturnType<typeof createServer>) {
  const app = express();
  app.use(cors());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      name: "mediaforge-mcp",
      version: "1.0.0",
      tools: ["transcribe_media", "generate_subtitles", "extract_audio", "media_info"],
      uptime: process.uptime(),
    });
  });

  // Track active SSE transports per session
  const transports = new Map<string, SSEServerTransport>();

  app.get("/sse", async (req, res) => {
    logger.info(`New SSE connection from ${req.ip}`);
    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport.sessionId, transport);

    res.on("close", () => {
      transports.delete(transport.sessionId);
      logger.info(`SSE connection closed: ${transport.sessionId}`);
    });

    await server.connect(transport);
  });

  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(400).json({ error: "Unknown session. Connect to /sse first." });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  app.listen(config.port, "0.0.0.0", () => {
    logger.info(`MediaForge MCP server running on http://0.0.0.0:${config.port}`);
    logger.info(`  SSE endpoint:    http://0.0.0.0:${config.port}/sse`);
    logger.info(`  Health check:    http://0.0.0.0:${config.port}/health`);
  });
}

main().catch((err) => {
  logger.error(`Fatal error: ${err.message || err}`);
  process.exit(1);
});
