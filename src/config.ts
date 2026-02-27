import { existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";

export const config = {
  groqApiKey: process.env.GROQ_API_KEY || "",
  replicateApiToken: process.env.REPLICATE_API_TOKEN || "",
  huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY || "",

  transport: (process.env.MEDIAFORGE_TRANSPORT || "stdio") as "stdio" | "http",
  port: parseInt(process.env.MEDIAFORGE_PORT || "3100", 10),
  tempDir: process.env.MEDIAFORGE_TEMP_DIR || "/tmp/mediaforge",
  maxFileSizeMB: parseInt(process.env.MEDIAFORGE_MAX_FILE_SIZE_MB || "500", 10),
  cleanupAfterHours: parseInt(process.env.MEDIAFORGE_CLEANUP_AFTER_HOURS || "2", 10),
  logLevel: (process.env.MEDIAFORGE_LOG_LEVEL || "info") as "debug" | "info" | "warn" | "error",

  transcriptionProvider: (process.env.TRANSCRIPTION_PROVIDER || "groq") as "groq" | "replicate" | "huggingface",
  imageGenProvider: (process.env.IMAGE_GEN_PROVIDER || "replicate") as "replicate" | "huggingface",
  ttsProvider: (process.env.TTS_PROVIDER || "replicate") as "replicate" | "huggingface",
};

export function ensureTempDir(): void {
  if (!existsSync(config.tempDir)) {
    mkdirSync(config.tempDir, { recursive: true });
  }
}

export function checkFfmpeg(): void {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
  } catch {
    throw new Error(
      "FFmpeg is not installed or not in PATH. Install it with: sudo apt install ffmpeg"
    );
  }
}
