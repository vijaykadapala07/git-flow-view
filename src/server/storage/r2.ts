import type * as S3Sdk from "@aws-sdk/client-s3";

import { assertLiveStorageAllowedForTests, readRequiredEnv } from "./config";

let client: S3Sdk.S3Client | null = null;
let s3ModulePromise: Promise<typeof S3Sdk> | null = null;
/** The most one small R2 call may take, its retries included. */
export const R2_REQUEST_TIMEOUT_MS = 10_000;
/**
 * The most one attempt at a small request may take. The SDK makes up to three
 * attempts, and each gets its own timeout: a single stalled attempt used to
 * spend the whole budget, so a slow R2 answer failed the page outright.
 */
export const R2_ATTEMPT_TIMEOUT_MS = 3_000;
const R2_MAX_ATTEMPTS = 3;

/**
 * Per-call timeouts: one per attempt (a request body of `bytes`, such as an
 * MP4 upload, gets a second more per MB) and one over every attempt.
 */
function requestOptions(bytes = 0) {
  const attempt = R2_ATTEMPT_TIMEOUT_MS + Math.ceil(bytes / 2 ** 20) * 1_000;
  return {
    requestTimeout: attempt,
    abortSignal: AbortSignal.timeout(
      Math.max(R2_REQUEST_TIMEOUT_MS, attempt * R2_MAX_ATTEMPTS + 1_000),
    ),
  };
}

async function getClient() {
  assertLiveStorageAllowedForTests("R2");

  s3ModulePromise ??= import("@aws-sdk/client-s3");
  const s3 = await s3ModulePromise;

  client ??= new s3.S3Client({
    region: "auto",
    // R2_ENDPOINT lets local runs point at a local S3 mock instead of Cloudflare.
    endpoint:
      process.env.R2_ENDPOINT?.trim() ||
      `https://${readRequiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    forcePathStyle: Boolean(process.env.R2_ENDPOINT?.trim()),
    credentials: {
      accessKeyId: readRequiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: readRequiredEnv("R2_SECRET_ACCESS_KEY"),
    },
    maxAttempts: R2_MAX_ATTEMPTS,
    requestHandler: {
      connectionTimeout: 2_000,
      requestTimeout: R2_ATTEMPT_TIMEOUT_MS,
      // Without this an attempt past its timeout only logs a warning.
      throwOnRequestTimeout: true,
    },
  });

  return { client, s3 };
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "NoSuchKey" ||
    error.name === "NotFound" ||
    error.message.includes("NotFound") ||
    error.message.includes("NoSuchKey")
  );
}

export async function getJsonObject<T>(
  bucket: string,
  key: string,
): Promise<T | null> {
  try {
    const { client: storageClient, s3 } = await getClient();
    const response = await storageClient.send(
      new s3.GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      requestOptions(),
    );

    const body = await response.Body?.transformToString();
    if (!body) {
      return null;
    }

    return JSON.parse(body) as T;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function putJsonObject(
  bucket: string,
  key: string,
  payload: unknown,
): Promise<void> {
  const { client: storageClient, s3 } = await getClient();
  await storageClient.send(
    new s3.PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(payload),
      ContentType: "application/json",
    }),
    requestOptions(),
  );
}

export async function putBinaryObject(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { client: storageClient, s3 } = await getClient();
  await storageClient.send(
    new s3.PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
    requestOptions(body.byteLength),
  );
}

/** An object's last-modified time, or null if it does not exist. */
export async function getObjectInfo(
  bucket: string,
  key: string,
): Promise<{ lastModified: Date | null } | null> {
  try {
    const { client: storageClient, s3 } = await getClient();
    const response = await storageClient.send(
      new s3.HeadObjectCommand({ Bucket: bucket, Key: key }),
      requestOptions(),
    );
    return { lastModified: response.LastModified ?? null };
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function checkR2Bucket(bucket: string): Promise<void> {
  // Exercise the same authenticated GetObject path used by the application.
  // A missing sentinel is a successful readiness result; permission failures
  // and transport errors still propagate.
  await getJsonObject(
    bucket,
    "_meta/gitflowview-readiness-sentinel-does-not-exist.json",
  );
}
