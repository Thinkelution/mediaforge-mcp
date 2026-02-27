import Replicate from "replicate";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type { TranscriptionResult, TranscriptionSegment } from "../types/common.js";

function getClient(): Replicate {
  if (!config.replicateApiToken) {
    throw {
      code: "PROVIDER_ERROR",
      message: "REPLICATE_API_TOKEN is not configured.",
      suggestion: "Set the REPLICATE_API_TOKEN environment variable.",
    };
  }
  return new Replicate({ auth: config.replicateApiToken });
}

export async function transcribeWithReplicate(
  filePath: string,
  language?: string
): Promise<TranscriptionResult> {
  const client = getClient();

  logger.info("Calling Replicate Whisper as fallback");

  try {
    const output: any = await client.run(
      "openai/whisper:4d50797290df275329f202e48c76360b3f22b08d28c65c7c18e397ea714571d",
      {
        input: {
          audio: `file://${filePath}`,
          model: "large-v3",
          language: language && language !== "auto" ? language : undefined,
          translate: false,
          transcription: "srt",
        },
      }
    );

    const segments: TranscriptionSegment[] = (output.segments || []).map(
      (seg: any, i: number) => ({
        id: i,
        start: seg.start,
        end: seg.end,
        text: seg.text?.trim() || "",
      })
    );

    return {
      language: output.detected_language || language || "unknown",
      duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
      text: output.transcription || "",
      segments,
    };
  } catch (err: any) {
    throw {
      code: "PROVIDER_ERROR",
      message: `Replicate transcription failed: ${err?.message || err}`,
    };
  }
}
