import { readFileSync } from "node:fs";
import path from "node:path";

export type E2ERole = "patient" | "doctor" | "patient2" | "doctor2";

export const ROLE_EMAILS: Record<E2ERole, string> = {
  patient: "paciente@digitaly.health",
  doctor: "medico@digitaly.health",
  patient2: "paciente2@digitaly.health",
  doctor2: "medico2@digitaly.health",
};

export const DEMO_PASSWORD = "Demo@1234";

export const AUTH_DIR = path.join(__dirname, ".auth");

export function storageStatePath(role: E2ERole): string {
  return path.join(AUTH_DIR, `${role}.json`);
}

interface StoredOrigin {
  origin: string;
  localStorage?: { name: string; value: string }[];
}

interface StoredState {
  origins?: StoredOrigin[];
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export function readTokens(role: E2ERole): SessionTokens {
  const state = JSON.parse(
    readFileSync(storageStatePath(role), "utf8"),
  ) as StoredState;
  const entries = state.origins?.[0]?.localStorage ?? [];
  const lookup = new Map(entries.map((entry) => [entry.name, entry.value]));
  const accessToken = lookup.get("digitaly.accessToken");
  const refreshToken = lookup.get("digitaly.refreshToken");
  if (!accessToken || !refreshToken) {
    throw new Error(
      `Sessão ausente para o perfil ${role}. Rode o globalSetup do Playwright.`,
    );
  }
  return { accessToken, refreshToken };
}
