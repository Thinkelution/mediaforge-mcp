import type { TranscriptionResult } from "../types/common.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { transcribeWithGroq } from "./groq.js";
import { transcribeWithReplicate } from "./replicate.js";

export async function transcribe(
  filePath: string,
  language?: string,
  wordTimestamps: boolean = false
): Promise<TranscriptionResult> {
  const provider = config.transcriptionProvider;

  if (provider === "groq") {
    try {
      return await transcribeWithGroq(filePath, language, wordTimestamps);
    } catch (err: any) {
      if (err?.code === "PROVIDER_RATE_LIMITED" || err?.code === "PROVIDER_ERROR") {
        logger.warn(`Groq failed (${err.code}), falling back to Replicate`);
        if (config.replicateApiToken) {
          return await transcribeWithReplicate(filePath, language);
        }
      }
      throw err;
    }
  }

  if (provider === "replicate") {
    return await transcribeWithReplicate(filePath, language);
  }

  throw {
    code: "PROVIDER_ERROR",
    message: `Unsupported transcription provider: ${provider}`,
  };
}
