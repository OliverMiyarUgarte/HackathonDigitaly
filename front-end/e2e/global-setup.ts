import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { request } from "@playwright/test";
import { userDtoSchema, type UserDto } from "../lib/contracts";
import {
  AUTH_DIR,
  DEMO_PASSWORD,
  ROLE_EMAILS,
  storageStatePath,
  type E2ERole,
  type SessionTokens,
} from "./auth";

const API_BASE = (process.env.E2E_API_URL ?? "http://localhost:3001/api").replace(
  /\/+$/,
  "",
);
const WEB_ORIGIN = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ROLES: E2ERole[] = ["patient", "doctor", "patient2", "doctor2"];

interface StoredSession {
  tokens: SessionTokens;
  user: UserDto | null;
}

interface AuthResponse {
  tokens: SessionTokens;
  user: unknown;
}

function accessTokenExpiresAt(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function readStoredSession(role: E2ERole): StoredSession | null {
  try {
    const state = JSON.parse(readFileSync(storageStatePath(role), "utf8")) as {
      origins?: { localStorage?: { name: string; value: string }[] }[];
    };
    const entries = state.origins?.[0]?.localStorage ?? [];
    const lookup = new Map(entries.map((entry) => [entry.name, entry.value]));
    const accessToken = lookup.get("digitaly.accessToken");
    const refreshToken = lookup.get("digitaly.refreshToken");
    if (!accessToken || !refreshToken) {
      return null;
    }
    const expiresAt = accessTokenExpiresAt(accessToken);
    if (expiresAt === null || expiresAt - Date.now() <= 10 * 60_000) {
      return null;
    }
    const rawUser = lookup.get("digitaly.user");
    const parsedUser = rawUser
      ? userDtoSchema.safeParse(JSON.parse(rawUser))
      : null;
    return {
      tokens: { accessToken, refreshToken },
      user: parsedUser?.success ? parsedUser.data : null,
    };
  } catch {
    return null;
  }
}

async function fetchProfile(accessToken: string): Promise<UserDto> {
  const context = await request.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
  });
  try {
    const response = await context.get(`${API_BASE}/auth/me`);
    if (!response.ok()) {
      throw new Error(`Perfil indisponível (HTTP ${response.status()}).`);
    }
    return userDtoSchema.parse(await response.json());
  } finally {
    await context.dispose();
  }
}

async function login(role: E2ERole): Promise<StoredSession> {
  const context = await request.newContext();
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await context.post(`${API_BASE}/auth/login`, {
        data: { email: ROLE_EMAILS[role], password: DEMO_PASSWORD },
      });
      if (response.ok()) {
        const payload = (await response.json()) as AuthResponse;
        return { tokens: payload.tokens, user: userDtoSchema.parse(payload.user) };
      }
      if (response.status() === 429) {
        await new Promise((resolve) => setTimeout(resolve, 60_000));
        continue;
      }
      throw new Error(
        `Login de ${ROLE_EMAILS[role]} falhou (HTTP ${response.status()}).`,
      );
    }
    throw new Error(
      `Login de ${ROLE_EMAILS[role]} excedeu o limite de tentativas.`,
    );
  } finally {
    await context.dispose();
  }
}

function writeStorageState(role: E2ERole, session: StoredSession): void {
  const localStorage = [
    { name: "digitaly.accessToken", value: session.tokens.accessToken },
    { name: "digitaly.refreshToken", value: session.tokens.refreshToken },
  ];
  if (session.user) {
    localStorage.push({
      name: "digitaly.user",
      value: JSON.stringify(session.user),
    });
  }
  writeFileSync(
    storageStatePath(role),
    JSON.stringify(
      {
        cookies: [],
        origins: [{ origin: WEB_ORIGIN, localStorage }],
      },
      null,
      2,
    ),
  );
}

export default async function globalSetup(): Promise<void> {
  mkdirSync(AUTH_DIR, { recursive: true });
  for (const role of ROLES) {
    const stored = readStoredSession(role);
    const session = stored ?? (await login(role));
    const user =
      session.user ?? (await fetchProfile(session.tokens.accessToken));
    writeStorageState(role, { tokens: session.tokens, user });
  }
}
