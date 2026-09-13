import { expect, test, type Page } from "@playwright/test";
import { readTokens, storageStatePath } from "./auth";

const API_BASE = "http://localhost:3001/api";
const SEED_CONFIRMED_APPOINTMENT = "a0000000-0000-4000-8000-000000000002";
const SEED_COMPLETED_CONSULTATION = "c0000000-0000-4000-8000-000000000001";
const SEED_MEDICAL_RECORD = "d0000000-0000-4000-8000-000000000001";
const BANNED_PALETTE =
  /(?:^|:)(?:sky|slate|gray|zinc|neutral|stone|emerald|amber|red|blue|green|yellow|orange|indigo|violet|purple|pink|rose|teal|cyan|lime|fuchsia)-[0-9]/;

interface DoctorAppointment {
  appointmentId: string;
  patient: { id: string };
  consultationId: string | null;
}

interface SlotSummary {
  startsAt: string;
}

interface AppointmentSummary {
  id: string;
  scheduledAt: string;
}

function authHeaders(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectNoBannedPalette(page: Page): Promise<void> {
  const banned = await page.evaluate((patternSource: string) => {
    const pattern = new RegExp(patternSource);
    const found = new Set<string>();
    for (const element of Array.from(document.querySelectorAll("*"))) {
      for (const className of Array.from(element.classList)) {
        if (pattern.test(className)) {
          found.add(className);
        }
      }
    }
    return Array.from(found);
  }, BANNED_PALETTE.source);
  expect(banned).toEqual([]);
}

async function openRoute(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole("main")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("h1")).toHaveCount(1);
  await page.waitForTimeout(300);
}

const PUBLIC_ROUTES = ["/entrar", "/registro", "/recuperar-senha"] as const;

test.describe("rotas públicas", () => {
  for (const path of PUBLIC_ROUTES) {
    test(`${path} sem rolagem horizontal em 375px e 1280px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 900 });
      await openRoute(page, path);
      await expectNoHorizontalOverflow(page);
      await expectNoBannedPalette(page);
      await page.setViewportSize({ width: 1280, height: 900 });
      await expectNoHorizontalOverflow(page);
      await expectNoBannedPalette(page);
    });
  }

  test("botão primário usa o gradiente da marca", async ({ page }) => {
    await page.goto("/entrar");
    const backgroundImage = await page
      .getByRole("button", { name: /entrar na plataforma/i })
      .evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(backgroundImage).toContain("linear-gradient");
  });

  test("contêiner de notificações anuncia com aria-live", async ({ page }) => {
    await page.goto("/entrar");
    const toastRegion = page.locator('[aria-label="Notificações"]');
    await expect(toastRegion).toHaveAttribute("aria-live", "polite");
  });
});

test.describe("rotas do paciente", () => {
  test.use({ storageState: storageStatePath("patient") });

  const routes = [
    "/paciente",
    "/paciente/agendar",
    `/paciente/confirmar-agendamento?appointmentId=${SEED_CONFIRMED_APPOINTMENT}`,
    "/paciente/calendario",
    "/paciente/historico",
    "/paciente/prontuario",
    `/paciente/consultas/${SEED_COMPLETED_CONSULTATION}`,
  ] as const;

  for (const path of routes) {
    test(`${path} sem rolagem horizontal em 375px e 1280px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 900 });
      await openRoute(page, path);
      await expectNoHorizontalOverflow(page);
      await expectNoBannedPalette(page);
      await page.setViewportSize({ width: 1280, height: 900 });
      await expectNoHorizontalOverflow(page);
      await expectNoBannedPalette(page);
    });
  }

  test("diálogo prende o foco, restaura o foco e anuncia o toast", async ({
    page,
  }) => {
    const token = readTokens("patient").accessToken;
    const headers = authHeaders(token);
    const doctorsResponse = await page.request.get(`${API_BASE}/users/doctors`, {
      headers,
    });
    expect(doctorsResponse.ok()).toBeTruthy();
    const doctors = (await doctorsResponse.json()) as { id: string }[];
    const doctor = doctors[0];
    if (!doctor) {
      throw new Error("Nenhum médico no seed para o teste de diálogo.");
    }
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
    const slotsResponse = await page.request.get(
      `${API_BASE}/appointments/doctors/${doctor.id}/slots?from=${encodeURIComponent(
        from,
      )}&to=${encodeURIComponent(to)}`,
      { headers },
    );
    expect(slotsResponse.ok()).toBeTruthy();
    const slots = (await slotsResponse.json()) as SlotSummary[];
    const slot = slots.find(
      (item) => new Date(item.startsAt).getTime() > Date.now(),
    );
    if (!slot) {
      throw new Error("Nenhum horário livre para o teste de diálogo.");
    }
    const createdResponse = await page.request.post(`${API_BASE}/appointments`, {
      headers,
      data: { doctorId: doctor.id, scheduledAt: slot.startsAt },
    });
    expect(createdResponse.ok()).toBeTruthy();
    const created = (await createdResponse.json()) as AppointmentSummary;

    try {
      await page.goto("/paciente/calendario");
      const monthLabel = new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(created.scheduledAt));
      const expectedMonth =
        monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
      const monthHeading = page.getByRole("heading", { level: 2 }).first();
      await expect(monthHeading).toBeVisible();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = (await monthHeading.textContent())?.trim();
        if (current === expectedMonth) {
          break;
        }
        await page.getByRole("button", { name: /próximo mês/i }).click();
        await page.waitForTimeout(300);
      }
      const entry = page.getByTestId(`calendar-entry-${created.id}`);
      await expect(entry).toBeVisible({ timeout: 15000 });
      const trigger = entry.getByRole("button", { name: /cancelar/i });
      await trigger.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.activeElement?.closest("dialog") !== null,
          ),
        )
        .toBe(true);
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await expect
        .poll(() =>
          page.evaluate(
            () => document.activeElement?.closest("dialog") !== null,
          ),
        )
        .toBe(true);

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();

      await trigger.click();
      await dialog
        .getByRole("button", { name: /cancelar consulta/i })
        .click();
      const toastRegion = page.locator('[aria-label="Notificações"]');
      await expect(toastRegion.getByRole("status")).toContainText(
        /consulta cancelada/i,
      );
      await expect(toastRegion).toHaveAttribute("aria-live", "polite");
    } finally {
      await page.request.post(
        `${API_BASE}/appointments/${created.id}/cancel`,
        { headers, data: {} },
      );
    }
  });
});

test.describe("rotas do médico", () => {
  test.use({ storageState: storageStatePath("doctor") });

  test("resolve o paciente vinculado", async ({ page }) => {
    const token = readTokens("doctor").accessToken;
    const response = await page.request.get(`${API_BASE}/appointments/doctor`, {
      headers: authHeaders(token),
    });
    expect(response.ok()).toBeTruthy();
    const appointments = (await response.json()) as DoctorAppointment[];
    const patientId = appointments[0]?.patient.id;
    if (!patientId) {
      throw new Error("Nenhum atendimento no seed para as rotas do médico.");
    }
    const routes = [
      "/medico",
      "/medico/atendimentos",
      "/medico/prontuario",
      `/medico/prontuario/${SEED_MEDICAL_RECORD}`,
      `/medico/consultas/${SEED_COMPLETED_CONSULTATION}`,
      `/medico/consultas/${SEED_COMPLETED_CONSULTATION}/fechamento`,
      `/medico/pacientes/${patientId}`,
    ] as const;

    for (const path of routes) {
      await page.setViewportSize({ width: 375, height: 900 });
      await openRoute(page, path);
      await expectNoHorizontalOverflow(page);
      await expectNoBannedPalette(page);
      await page.setViewportSize({ width: 1280, height: 900 });
      await expectNoHorizontalOverflow(page);
      await expectNoBannedPalette(page);
    }
  });
});
