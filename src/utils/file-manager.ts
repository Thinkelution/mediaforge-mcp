import { existsSync, statSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join, basename, extname } from "path";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import { logger } from "./logger.js";

const SUPPORTED_VIDEO = [".mp4", ".mkv", ".mov", ".avi", ".webm", ".flv", ".wmv", ".m4v"];
const SUPPORTED_AUDIO = [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".wma", ".webm"];
const SUPPORTED_MEDIA = [...SUPPORTED_VIDEO, ...SUPPORTED_AUDIO];

export function ensureTempDir(): void {
  if (!existsSync(config.tempDir)) {
    mkdirSync(config.tempDir, { recursive: true });
  }
}

export function tempPath(prefix: string, ext: string): string {
  ensureTempDir();
  const id = uuidv4().slice(0, 8);
  return join(config.tempDir, `${prefix}_${id}${ext}`);
}

export function validateFileExists(filePath: string): void {
  if (!existsSync(filePath)) {
    throw { code: "FILE_NOT_FOUND", message: `File not found: ${filePath}` };
  }
}

export function validateFileSize(filePath: string): void {
  const stats = statSync(filePath);
  const sizeMB = stats.size / (1024 * 1024);
  if (sizeMB > config.maxFileSizeMB) {
    throw {
      code: "FILE_TOO_LARGE",
      message: `File is ${sizeMB.toFixed(1)}MB, max is ${config.maxFileSizeMB}MB`,
      suggestion: "Use video_clip to trim the file first.",
    };
  }
}

export function validateMediaFormat(filePath: string): void {
  const ext = extname(filePath).toLowerCase();
  if (!SUPPORTED_MEDIA.includes(ext)) {
    throw {
      code: "UNSUPPORTED_FORMAT",
      message: `Unsupported format: ${ext}`,
      suggestion: `Supported formats: ${SUPPORTED_MEDIA.join(", ")}`,
    };
  }
}

export function validateVideoFormat(filePath: string): void {
  const ext = extname(filePath).toLowerCase();
  if (!SUPPORTED_VIDEO.includes(ext)) {
    throw {
      code: "UNSUPPORTED_FORMAT",
      message: `Expected a video file, got: ${ext}`,
      suggestion: `Supported video formats: ${SUPPORTED_VIDEO.join(", ")}`,
    };
  }
}

export function isVideoFile(filePath: string): boolean {
  return SUPPORTED_VIDEO.includes(extname(filePath).toLowerCase());
}

export function isAudioFile(filePath: string): boolean {
  return SUPPORTED_AUDIO.includes(extname(filePath).toLowerCase());
}

export function getFileName(filePath: string): string {
  return basename(filePath);
}

export function getFileSizeMB(filePath: string): number {
  const stats = statSync(filePath);
  return Math.round((stats.size / (1024 * 1024)) * 100) / 100;
}

export function cleanupOldFiles(): void {
  if (!existsSync(config.tempDir)) return;

  const cutoff = Date.now() - config.cleanupAfterHours * 60 * 60 * 1000;
  const files = readdirSync(config.tempDir);

  for (const file of files) {
    const filePath = join(config.tempDir, file);
    try {
      const stats = statSync(filePath);
      if (stats.mtimeMs < cutoff) {
        unlinkSync(filePath);
        logger.debug(`Cleaned up old file: ${file}`);
      }
    } catch {
      // ignore cleanup errors
    }
  }
}
