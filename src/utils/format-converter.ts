import type { TranscriptionSegment } from "../types/common.js";

function formatTimeSRT(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad3(ms)}`;
}

function formatTimeVTT(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad3(ms)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}

function splitText(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxChars && currentLine.length > 0) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine ? " " : "") + word;
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  return lines.slice(0, 2);
}

export function segmentsToSRT(
  segments: TranscriptionSegment[],
  maxCharsPerLine: number = 42
): string {
  return segments
    .map((seg, i) => {
      const lines = splitText(seg.text, maxCharsPerLine);
      return `${i + 1}\n${formatTimeSRT(seg.start)} --> ${formatTimeSRT(seg.end)}\n${lines.join("\n")}`;
    })
    .join("\n\n") + "\n";
}

export function segmentsToVTT(
  segments: TranscriptionSegment[],
  maxCharsPerLine: number = 42
): string {
  const header = "WEBVTT\n\n";
  const body = segments
    .map((seg, i) => {
      const lines = splitText(seg.text, maxCharsPerLine);
      return `${i + 1}\n${formatTimeVTT(seg.start)} --> ${formatTimeVTT(seg.end)}\n${lines.join("\n")}`;
    })
    .join("\n\n");
  return header + body + "\n";
}
