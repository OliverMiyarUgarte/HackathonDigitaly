import { z } from "zod";
import {
  authTokensSchema,
  errorCodeSchema,
  errorResponseSchema,
  type AuthTokensDto,
  type ErrorCode,
} from "./contracts";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"
).replace(/\/+$/, "");

const ACCESS_TOKEN_KEY = "digitaly.accessToken";
const REFRESH_TOKEN_KEY = "digitaly.refreshToken";

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStorage(key: string): string | null {
  if (!canUseStorage()) {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  if (!canUseStorage()) {
    return;
  }
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    return;
  }
}

export function getAccessToken(): string | null {
  return readStorage(ACCESS_TOKEN_KEY) ?? memoryAccessToken;
}

export function getRefreshToken(): string | null {
  return readStorage(REFRESH_TOKEN_KEY) ?? memoryRefreshToken;
}

export function setTokens(tokens: AuthTokensDto): void {
  memoryAccessToken = tokens.accessToken;
  memoryRefreshToken = tokens.refreshToken;
  writeStorage(ACCESS_TOKEN_KEY, tokens.accessToken);
  writeStorage(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  memoryAccessToken = null;
  memoryRefreshToken = null;
  writeStorage(ACCESS_TOKEN_KEY, null);
  writeStorage(REFRESH_TOKEN_KEY, null);
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: string[] | null;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details: string[] | null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function buildUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) {
    const code = errorCodeSchema.safeParse(parsed.data.error);
    return new ApiError(
      response.status,
      code.success ? code.data : "INTERNAL_ERROR",
      parsed.data.message,
      parsed.data.details,
    );
  }
  return new ApiError(
    response.status,
    "INTERNAL_ERROR",
    `A solicitação falhou (HTTP ${response.status})`,
    null,
  );
}

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }
  let response: Response;
  try {
    response = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return false;
  }
  if (!response.ok) {
    clearTokens();
    return false;
  }
  const parsed = authTokensSchema.safeParse(await response.json());
  if (!parsed.success) {
    clearTokens();
    return false;
  }
  setTokens(parsed.data);
  return true;
}

export interface ApiRequestOptions {
  auth?: boolean;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

function serializeBody(body: unknown): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return body;
  }
  if (
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof URLSearchParams
  ) {
    return body;
  }
  return JSON.stringify(body);
}

async function request<T>(
  path: string,
  init: RequestInit,
  options: ApiRequestOptions,
  schema?: z.ZodType<T>,
): Promise<T> {
  const auth = options.auth ?? true;
  const url = buildUrl(path);

  const execute = async (isRetry: boolean): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (options.headers) {
      new Headers(options.headers).forEach((value, key) => {
        headers.set(key, value);
      });
    }
    const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
    if (init.body != null && !isForm && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (auth) {
      const token = getAccessToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    const response = await fetch(url, {
      ...init,
      headers,
      signal: options.signal,
    });

    if (response.status === 401 && auth && !isRetry) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return execute(true);
      }
    }
    return response;
  };

  const response = await execute(false);
  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (text.length === 0) {
    return undefined as T;
  }
  const data: unknown = JSON.parse(text);
  return schema ? schema.parse(data) : (data as T);
}

export function get<T>(
  path: string,
  schema?: z.ZodType<T>,
  options?: ApiRequestOptions,
): Promise<T> {
  return request(path, { method: "GET" }, options ?? {}, schema);
}

export function post<T>(
  path: string,
  body?: unknown,
  schema?: z.ZodType<T>,
  options?: ApiRequestOptions,
): Promise<T> {
  return request(
    path,
    { method: "POST", body: serializeBody(body) },
    options ?? {},
    schema,
  );
}

export function patch<T>(
  path: string,
  body?: unknown,
  schema?: z.ZodType<T>,
  options?: ApiRequestOptions,
): Promise<T> {
  return request(
    path,
    { method: "PATCH", body: serializeBody(body) },
    options ?? {},
    schema,
  );
}

export function put<T>(
  path: string,
  body?: unknown,
  schema?: z.ZodType<T>,
  options?: ApiRequestOptions,
): Promise<T> {
  return request(
    path,
    { method: "PUT", body: serializeBody(body) },
    options ?? {},
    schema,
  );
}

export function del<T>(
  path: string,
  schema?: z.ZodType<T>,
  options?: ApiRequestOptions,
): Promise<T> {
  return request(path, { method: "DELETE" }, options ?? {}, schema);
}

export function postMultipart<T>(
  path: string,
  formData: FormData,
  schema?: z.ZodType<T>,
  options?: ApiRequestOptions,
): Promise<T> {
  return request(
    path,
    { method: "POST", body: formData },
    options ?? {},
    schema,
  );
}
