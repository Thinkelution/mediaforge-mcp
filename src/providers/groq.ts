import Groq from "groq-sdk";
import { createReadStream, statSync } from "fs";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type { TranscriptionResult, TranscriptionSegment } from "../types/common.js";
import { extractAudioFromVideo, splitAudioBySize } from "./ffmpeg.js";
import { isVideoFile } from "../utils/file-manager.js";

const GROQ_MAX_FILE_SIZE_MB = 25;
const GROQ_MODEL = "whisper-large-v3-turbo";

function getClient(): Groq {
  if (!config.groqApiKey) {
    throw {
      code: "PROVIDER_ERROR",
      message: "GROQ_API_KEY is not configured.",
      suggestion: "Set the GROQ_API_KEY environment variable. Get a free key at console.groq.com",
    };
  }
  return new Groq({ apiKey: config.groqApiKey });
}

export async function transcribeWithGroq(
  filePath: string,
  language?: string,
  wordTimestamps: boolean = false
): Promise<TranscriptionResult> {
  const client = getClient();

  let audioPath = filePath;
  if (isVideoFile(filePath)) {
    logger.info("Extracting audio from video for transcription");
    audioPath = await extractAudioFromVideo(filePath);
  }

  const fileSizeMB = statSync(audioPath).size / (1024 * 1024);

  if (fileSizeMB > GROQ_MAX_FILE_SIZE_MB) {
    logger.info(`File is ${fileSizeMB.toFixed(1)}MB, splitting into chunks`);
    return transcribeChunked(client, audioPath, language, wordTimestamps);
  }

  return transcribeSingle(client, audioPath, language, wordTimestamps);
}

async function transcribeSingle(
  client: Groq,
  audioPath: string,
  language?: string,
  wordTimestamps: boolean = false
): Promise<TranscriptionResult> {
  const params: Record<string, unknown> = {
    file: createReadStream(audioPath),
    model: GROQ_MODEL,
    response_format: "verbose_json",
    timestamp_granularities: wordTimestamps ? ["word", "segment"] : ["segment"],
  };

  if (language && language !== "auto") {
    params.language = language;
  }

  logger.info("Calling Groq Whisper API");
  let retries = 0;
  const maxRetries = 2;

  while (true) {
    try {
      const response = await client.audio.transcriptions.create(params as any);
      const resp = response as any;

      const segments: TranscriptionSegment[] = (resp.segments || []).map(
        (seg: any, i: number) => ({
          id: i,
          start: seg.start,
          end: seg.end,
          text: seg.text?.trim() || "",
          ...(wordTimestamps && resp.words
            ? {
                words: (resp.words as any[])
                  .filter((w: any) => w.start >= seg.start && w.end <= seg.end)
                  .map((w: any) => ({ word: w.word, start: w.start, end: w.end })),
              }
            : {}),
        })
      );

      return {
        language: resp.language || language || "unknown",
        duration: resp.duration || 0,
        text: resp.text || "",
        segments,
      };
    } catch (err: any) {
      if (err?.status === 429 && retries < maxRetries) {
        retries++;
        const delay = Math.pow(2, retries) * 1000;
        logger.warn(`Groq rate limited, retrying in ${delay}ms (attempt ${retries}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, delay));
        params.file = createReadStream(audioPath);
        continue;
      }
      throw {
        code: err?.status === 429 ? "PROVIDER_RATE_LIMITED" : "PROVIDER_ERROR",
        message: `Groq transcription failed: ${err?.message || err}`,
        suggestion:
          err?.status === 429
            ? "Rate limited. Try again in a few seconds or switch to replicate provider."
            : undefined,
      };
    }
  }
}

async function transcribeChunked(
  client: Groq,
  audioPath: string,
  language?: string,
  wordTimestamps: boolean = false
): Promise<TranscriptionResult> {
  const chunks = await splitAudioBySize(audioPath, GROQ_MAX_FILE_SIZE_MB - 1);
  logger.info(`Split into ${chunks.length} chunks`);

  let fullText = "";
  const allSegments: TranscriptionSegment[] = [];
  let totalDuration = 0;
  let detectedLanguage = "unknown";
  let segIdOffset = 0;

  for (let i = 0; i < chunks.length; i++) {
    const result = await transcribeSingle(client, chunks[i], language, wordTimestamps);
    if (i === 0) detectedLanguage = result.language;

    fullText += (fullText ? " " : "") + result.text;

    for (const seg of result.segments) {
      allSegments.push({
        ...seg,
        id: segIdOffset + seg.id,
        start: totalDuration + seg.start,
        end: totalDuration + seg.end,
      });
    }

    segIdOffset += result.segments.length;
    totalDuration += result.duration;
  }

  return {
    language: detectedLanguage,
    duration: totalDuration,
    text: fullText,
    segments: allSegments,
  };
}
