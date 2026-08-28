import { createHmac, timingSafeEqual } from "node:crypto";

import {
  buildEnvironmentalQueryKey,
  type EnvironmentalQuery,
} from "@/lib/environmental-query";

export const ACTIVITY_TOKEN_VERSION = 1;
export const ACTIVITY_TOKEN_TTL_MS = 30 * 60 * 1000;

export type ActivityTokenPayload = {
  v: typeof ACTIVITY_TOKEN_VERSION;
  activityId: string;
  queryHash: string;
  inputFingerprint: string;
  aoiSideMeters: number;
  retryCount: number;
  exp: number;
};

export class ActivityTokenConfigError extends Error {
  constructor() {
    super("Heat risk service is not configured.");
    this.name = "ActivityTokenConfigError";
  }
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function hashEnvironmentalQuery(query: EnvironmentalQuery): string {
  return buildEnvironmentalQueryKey(query);
}

export function getActivityTokenSigningSecret(): string | null {
  const secret = process.env.HEATSAFE_STATE_SIGNING_SECRET;

  if (!secret || secret.trim().length === 0) {
    return null;
  }

  return secret;
}

export function requireActivityTokenSigningSecret(): string {
  const secret = getActivityTokenSigningSecret();

  if (!secret) {
    throw new ActivityTokenConfigError();
  }

  return secret;
}

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

export function signActivityToken(params: {
  activityId: string;
  environmentalQuery: EnvironmentalQuery;
  inputFingerprint: string;
  retryCount?: number;
  expiresAt?: number;
}): string {
  const secret = requireActivityTokenSigningSecret();
  const payload: ActivityTokenPayload = {
    v: ACTIVITY_TOKEN_VERSION,
    activityId: params.activityId,
    queryHash: hashEnvironmentalQuery(params.environmentalQuery),
    inputFingerprint: params.inputFingerprint,
    aoiSideMeters: params.environmentalQuery.aoiSideMeters,
    retryCount: params.retryCount ?? 0,
    exp: params.expiresAt ?? Date.now() + ACTIVITY_TOKEN_TTL_MS,
  };
  const payloadJson = JSON.stringify(payload);
  const signature = createHmac("sha256", secret)
    .update(payloadJson)
    .digest("base64url");

  return `${base64UrlEncode(payloadJson)}.${signature}`;
}

export function verifyActivityToken(
  token: string
):
  | { ok: true; payload: ActivityTokenPayload }
  | { ok: false; reason: string } {
  if (typeof token !== "string" || token.trim().length === 0) {
    return { ok: false, reason: "Activity token is required." };
  }

  const separatorIndex = token.lastIndexOf(".");

  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return { ok: false, reason: "Activity token is invalid." };
  }

  const encodedPayload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  let payloadJson: string;

  try {
    payloadJson = base64UrlDecode(encodedPayload);
  } catch {
    return { ok: false, reason: "Activity token is invalid." };
  }

  const secret = getActivityTokenSigningSecret();

  if (!secret) {
    return { ok: false, reason: "Heat risk service is not configured." };
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(payloadJson)
    .digest("base64url");

  try {
    const provided = Buffer.from(signature, "base64url");
    const expected = Buffer.from(expectedSignature, "base64url");

    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      return { ok: false, reason: "Activity token signature is invalid." };
    }
  } catch {
    return { ok: false, reason: "Activity token signature is invalid." };
  }

  let payload: ActivityTokenPayload;

  try {
    payload = JSON.parse(payloadJson) as ActivityTokenPayload;
  } catch {
    return { ok: false, reason: "Activity token is invalid." };
  }

  if (payload.v !== ACTIVITY_TOKEN_VERSION) {
    return { ok: false, reason: "Activity token version is unsupported." };
  }

  if (
    typeof payload.activityId !== "string" ||
    typeof payload.queryHash !== "string" ||
    typeof payload.inputFingerprint !== "string" ||
    typeof payload.aoiSideMeters !== "number" ||
    typeof payload.retryCount !== "number" ||
    typeof payload.exp !== "number"
  ) {
    return { ok: false, reason: "Activity token is invalid." };
  }

  if (Date.now() > payload.exp) {
    return { ok: false, reason: "Activity token has expired." };
  }

  return { ok: true, payload };
}

export function assertActivityTokenMatchesAssessment(params: {
  payload: ActivityTokenPayload;
  environmentalQuery: EnvironmentalQuery;
  inputFingerprint: string;
}): { ok: true } | { ok: false; reason: string } {
  const queryHash = hashEnvironmentalQuery(params.environmentalQuery);

  if (params.payload.queryHash !== queryHash) {
    return { ok: false, reason: "Environmental query does not match the signed activity token." };
  }

  if (params.payload.inputFingerprint !== params.inputFingerprint) {
    return {
      ok: false,
      reason: "Input fingerprint does not match the signed activity token.",
    };
  }

  if (params.payload.aoiSideMeters !== params.environmentalQuery.aoiSideMeters) {
    return { ok: false, reason: "AOI stage does not match the signed activity token." };
  }

  return { ok: true };
}
