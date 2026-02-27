import type { ErrorCode } from "../types/common.js";

export class ToolInputError extends Error {
  code: ErrorCode;
  suggestion?: string;

  constructor(code: ErrorCode, message: string, suggestion?: string) {
    super(message);
    this.code = code;
    this.suggestion = suggestion;
    this.name = "ToolInputError";
  }
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ToolInputError("INVALID_PARAMS", `'${field}' is required and must be a non-empty string.`);
  }
  return value.trim();
}

export function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ToolInputError("INVALID_PARAMS", `'${field}' must be a string.`);
  }
  return value.trim();
}

export function optionalEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: T[],
  defaultVal: T
): T {
  if (value === undefined || value === null) return defaultVal;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ToolInputError(
      "INVALID_PARAMS",
      `'${field}' must be one of: ${allowed.join(", ")}. Got: ${value}`
    );
  }
  return value as T;
}

export function optionalBoolean(value: unknown, field: string, defaultVal: boolean): boolean {
  if (value === undefined || value === null) return defaultVal;
  if (typeof value !== "boolean") {
    throw new ToolInputError("INVALID_PARAMS", `'${field}' must be a boolean.`);
  }
  return value;
}

export function optionalNumber(
  value: unknown,
  field: string,
  defaultVal: number,
  min?: number,
  max?: number
): number {
  if (value === undefined || value === null) return defaultVal;
  if (typeof value !== "number" || isNaN(value)) {
    throw new ToolInputError("INVALID_PARAMS", `'${field}' must be a number.`);
  }
  if (min !== undefined && value < min) {
    throw new ToolInputError("INVALID_PARAMS", `'${field}' must be >= ${min}.`);
  }
  if (max !== undefined && value > max) {
    throw new ToolInputError("INVALID_PARAMS", `'${field}' must be <= ${max}.`);
  }
  return value;
}
