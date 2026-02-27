import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { logger } from "../utils/logger.js";
import { tempPath } from "../utils/file-manager.js";
import type { FfprobeOutput } from "../types/providers.js";
import type { MediaMetadata, MediaStreamInfo } from "../types/common.js";
import { basename, extname } from "path";
import { statSync } from "fs";

const execFileAsync = promisify(execFile);

async function runFfmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  logger.debug("ffmpeg " + args.join(" "));
  try {
    return await execFileAsync("ffmpeg", args, { maxBuffer: 10 * 1024 * 1024 });
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    logger.error(`FFmpeg error: ${error.stderr || error.message}`);
    throw {
      code: "FFMPEG_ERROR",
      message: `FFmpeg failed: ${error.stderr?.split("\n").pop() || error.message}`,
    };
  }
}

async function runFfprobe(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("ffprobe", args, { maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    throw {
      code: "FFMPEG_ERROR",
      message: `ffprobe failed: ${error.stderr?.split("\n").pop() || error.message}`,
    };
  }
}

export async function extractAudioFromVideo(videoPath: string): Promise<string> {
  const outPath = tempPath("audio_extract", ".wav");
  await runFfmpeg([
    "-i", videoPath,
    "-vn",
    "-acodec", "pcm_s16le",
    "-ar", "16000",
    "-ac", "1",
    "-y", outPath,
  ]);
  return outPath;
}

export async function extractAudioTrack(
  inputPath: string,
  format: string,
  bitrate: string,
  channels: "mono" | "stereo",
  startTime?: string,
  endTime?: string
): Promise<string> {
  const outPath = tempPath("audio", `.${format}`);

  const codecMap: Record<string, string> = {
    mp3: "libmp3lame",
    wav: "pcm_s16le",
    aac: "aac",
    flac: "flac",
    ogg: "libvorbis",
  };

  const args: string[] = ["-i", inputPath];
  if (startTime) args.push("-ss", startTime);
  if (endTime) args.push("-to", endTime);
  args.push(
    "-vn",
    "-acodec", codecMap[format] || "libmp3lame",
    "-b:a", bitrate,
    "-ac", channels === "mono" ? "1" : "2",
    "-y", outPath
  );

  await runFfmpeg(args);
  return outPath;
}

export async function getMediaInfo(filePath: string): Promise<MediaMetadata> {
  const raw = await runFfprobe([
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);

  const data: FfprobeOutput = JSON.parse(raw);
  const stats = statSync(filePath);
  const duration = parseFloat(data.format.duration || "0");

  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.floor(duration % 60);
  const durationFormatted = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  let video: MediaStreamInfo | undefined;
  let audio: MediaStreamInfo | undefined;
  const subtitleTracks: string[] = [];

  for (const stream of data.streams) {
    if (stream.codec_type === "video" && !video) {
      const fpsMatch = stream.r_frame_rate?.match(/^(\d+)\/(\d+)$/);
      const fps = fpsMatch ? Math.round(parseInt(fpsMatch[1]) / parseInt(fpsMatch[2])) : undefined;
      video = {
        codec: stream.codec_name,
        resolution: stream.width && stream.height ? `${stream.width}x${stream.height}` : undefined,
        fps,
        bitrate_kbps: stream.bit_rate ? Math.round(parseInt(stream.bit_rate) / 1000) : undefined,
      };
    } else if (stream.codec_type === "audio" && !audio) {
      audio = {
        codec: stream.codec_name,
        sample_rate: stream.sample_rate ? parseInt(stream.sample_rate) : undefined,
        channels: stream.channels,
        bitrate_kbps: stream.bit_rate ? Math.round(parseInt(stream.bit_rate) / 1000) : undefined,
      };
    } else if (stream.codec_type === "subtitle") {
      subtitleTracks.push(stream.tags?.language || stream.codec_name);
    }
  }

  const ext = extname(filePath).replace(".", "");

  return {
    file_name: basename(filePath),
    file_size_mb: Math.round((stats.size / (1024 * 1024)) * 100) / 100,
    duration_seconds: Math.round(duration * 100) / 100,
    duration_formatted: durationFormatted,
    format: ext || data.format.format_name.split(",")[0],
    video,
    audio,
    has_subtitles: subtitleTracks.length > 0,
    subtitle_tracks: subtitleTracks,
  };
}

export async function burnSubtitles(
  videoPath: string,
  srtPath: string,
  style: {
    font_size?: number;
    font_color?: string;
    background_color?: string;
    position?: "bottom" | "top";
    font_name?: string;
  }
): Promise<string> {
  const outPath = tempPath("subtitled", ".mp4");

  const fontSize = style.font_size || 24;
  const fontName = style.font_name || "Arial";
  const primaryColor = colorToASS(style.font_color || "white");
  const backColor = colorToASS(style.background_color || "black");
  const marginV = style.position === "top" ? 40 : 20;
  const alignment = style.position === "top" ? 6 : 2;

  const escapedSrt = srtPath.replace(/:/g, "\\:").replace(/'/g, "'\\''");

  const filterStr = `subtitles='${escapedSrt}':force_style='FontSize=${fontSize},FontName=${fontName},PrimaryColour=${primaryColor},BackColour=${backColor},MarginV=${marginV},Alignment=${alignment}'`;

  await runFfmpeg([
    "-i", videoPath,
    "-vf", filterStr,
    "-c:a", "copy",
    "-y", outPath,
  ]);

  return outPath;
}

function colorToASS(color: string): string {
  const map: Record<string, string> = {
    white: "&H00FFFFFF",
    black: "&H00000000",
    red: "&H000000FF",
    yellow: "&H0000FFFF",
    green: "&H0000FF00",
    blue: "&H00FF0000",
  };
  if (color.includes("@")) return map["black"] || "&H80000000";
  return map[color.toLowerCase()] || map["white"];
}

export async function getAudioDuration(filePath: string): Promise<number> {
  const raw = await runFfprobe([
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    filePath,
  ]);
  const data = JSON.parse(raw);
  return parseFloat(data.format.duration || "0");
}

export async function splitAudioBySize(
  filePath: string,
  maxSizeMB: number
): Promise<string[]> {
  const duration = await getAudioDuration(filePath);
  const fileSizeMB = statSync(filePath).size / (1024 * 1024);
  const numChunks = Math.ceil(fileSizeMB / maxSizeMB);
  const chunkDuration = duration / numChunks;

  const chunks: string[] = [];
  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkDuration;
    const outPath = tempPath(`chunk_${i}`, ".wav");
    await runFfmpeg([
      "-i", filePath,
      "-ss", start.toString(),
      "-t", chunkDuration.toString(),
      "-acodec", "pcm_s16le",
      "-ar", "16000",
      "-ac", "1",
      "-y", outPath,
    ]);
    chunks.push(outPath);
  }
  return chunks;
}
