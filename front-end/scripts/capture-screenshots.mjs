import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.join(here, "..", "e2e", ".auth");
const outDir = path.join(here, "..", "..", "docs", "screenshots");
const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const apiUrl = (process.env.E2E_API_URL ?? "http://localhost:3001/api").replace(
  /\/+$/,
  "",
);

const VIEWPORTS = [
  { suffix: "desktop", width: 1440, height: 900 },
  { suffix: "mobile", width: 390, height: 844 },
];

function storageState(role) {
  return role ? path.join(authDir, `${role}.json`) : undefined;
}

function readToken(role) {
  const state = JSON.parse(
    readFileSync(path.join(authDir, `${role}.json`), "utf8"),
  );
  const entries = state.origins[0].localStorage;
  return entries.find((entry) => entry.name === "digitaly.accessToken").value;
}

async function resolveActiveConsultation() {
  const response = await fetch(`${apiUrl}/appointments/doctor`, {
    headers: { Authorization: `Bearer ${readToken("doctor")}` },
  });
  if (!response.ok) {
    return null;
  }
  const appointments = await response.json();
  const active = appointments.find(
    (item) => item.status === "in_progress" && item.consultationId,
  );
  return active ? `/medico/consultas/${active.consultationId}` : null;
}

const shots = [
  { name: "01-login", path: "/entrar", role: null },
  { name: "02-paciente-inicio", path: "/paciente", role: "patient" },
  { name: "03-paciente-agendar", path: "/paciente/agendar", role: "patient" },
  { name: "04-medico-atendimentos", path: "/medico/atendimentos", role: "doctor" },
  { name: "05-sala-teleconsulta", path: null, role: "doctor" },
];

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const viewport of VIEWPORTS) {
      for (const shot of shots) {
        const target =
          shot.path ??
          (await resolveActiveConsultation()) ??
          "/medico/atendimentos";
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          storageState: storageState(shot.role),
        });
        const page = await context.newPage();
        await page.goto(`${baseUrl}${target}`, { waitUntil: "load" });
        await page.waitForSelector("main h1", { timeout: 30000 });
        await page.waitForTimeout(900);
        await page.screenshot({
          path: path.join(outDir, `${shot.name}-${viewport.suffix}.png`),
          fullPage: true,
        });
        await context.close();
        console.log(`captured ${shot.name}-${viewport.suffix}.png`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
