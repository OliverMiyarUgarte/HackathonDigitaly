import { expect, test, type Page } from "@playwright/test";
import { readTokens, storageStatePath, type SessionTokens } from "./auth";

const API_BASE = "http://localhost:3001/api";
const MAILHOG_MESSAGES = "http://localhost:8025/api/v2/messages";
const PATIENT_EMAIL = "paciente@digitaly.health";

interface DoctorSummary {
  id: string;
  name: string;
  specialty: string | null;
  crm: string | null;
}

interface SlotSummary {
  startsAt: string;
  endsAt: string;
  doctorId: string;
}

interface AppointmentSummary {
  id: string;
  status: string;
  scheduledAt: string;
}

interface MailHogAddress {
  Mailbox: string;
  Domain: string;
}

interface MailHogMessage {
  ID: string;
  Created: string;
  To: MailHogAddress[];
  Content: { Headers: { Subject?: string[]; To?: string[] } };
  MIME?: { Parts?: { Body?: string }[] } | null;
}

interface MailHogResponse {
  items?: MailHogMessage[];
}

test.use({ storageState: storageStatePath("patient") });

test.describe.configure({ mode: "serial" });

async function openBooking(page: Page): Promise<SessionTokens> {
  const tokens = readTokens("patient");
  await page.goto("/paciente/agendar");
  await expect(
    page.getByRole("heading", { name: /agendar consulta/i }),
  ).toBeVisible({ timeout: 30000 });
  return tokens;
}

function authHeaders(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

async function waitForCodeInput(page: Page): Promise<void> {
  const input = page.getByTestId("code-input-0");
  const retry = page.getByRole("button", { name: /tentar novamente/i });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expect(input.or(retry).first()).toBeVisible({ timeout: 30000 });
    if (await input.isVisible().catch(() => false)) {
      return;
    }
    await retry.click();
    await page.waitForTimeout(1000);
  }
  await expect(input).toBeVisible({ timeout: 30000 });
}

async function listDoctors(
  page: Page,
  token: string,
): Promise<DoctorSummary[]> {
  const response = await page.request.get(`${API_BASE}/users/doctors`, {
    headers: authHeaders(token),
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as DoctorSummary[];
}

async function listSlots(
  page: Page,
  token: string,
  doctorId: string,
): Promise<SlotSummary[]> {
  const from = new Date().toISOString();
  const to = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
  const response = await page.request.get(
    `${API_BASE}/appointments/doctors/${doctorId}/slots?from=${encodeURIComponent(
      from,
    )}&to=${encodeURIComponent(to)}`,
    { headers: authHeaders(token) },
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as SlotSummary[];
}

async function createAppointment(
  page: Page,
  token: string,
  doctorId: string,
  startsAt: string,
): Promise<AppointmentSummary> {
  const response = await page.request.post(`${API_BASE}/appointments`, {
    headers: authHeaders(token),
    data: { doctorId, scheduledAt: startsAt },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as AppointmentSummary;
}

async function getAppointment(
  page: Page,
  token: string,
  appointmentId: string,
): Promise<AppointmentSummary> {
  const response = await page.request.get(
    `${API_BASE}/appointments/${appointmentId}`,
    { headers: authHeaders(token) },
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as AppointmentSummary;
}

async function cancelAppointment(
  page: Page,
  token: string,
  appointmentId: string,
): Promise<void> {
  await page.request.post(`${API_BASE}/appointments/${appointmentId}/cancel`, {
    headers: authHeaders(token),
    data: {},
  });
}

function pickFutureSlot(slots: SlotSummary[], offset: number): SlotSummary {
  const minimum = Date.now() + 24 * 60 * 60 * 1000;
  const future = slots.filter(
    (slot) => new Date(slot.startsAt).getTime() > minimum,
  );
  const slot = future[offset];
  if (!slot) {
    throw new Error(
      "Nenhum horário futuro disponível nos próximos 21 dias para o médico escolhido.",
    );
  }
  return slot;
}

async function mailhogMessages(page: Page): Promise<MailHogMessage[]> {
  const response = await page.request.get(MAILHOG_MESSAGES);
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as MailHogResponse;
  return payload.items ?? [];
}

async function latestMessageId(page: Page): Promise<string | null> {
  const messages = await mailhogMessages(page);
  return messages[0]?.ID ?? null;
}

function extractCode(message: MailHogMessage): string | null {
  const parts = message.MIME?.Parts ?? [];
  const body = parts.map((part) => part.Body ?? "").join("\n");
  const match = body.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

async function waitForCode(
  page: Page,
  sinceMessageId: string | null,
): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const messages = await mailhogMessages(page);
    const candidate = messages.find(
      (message) =>
        message.ID !== sinceMessageId &&
        message.To.some(
          (address) =>
            `${address.Mailbox}@${address.Domain}` === PATIENT_EMAIL,
        ),
    );
    if (candidate) {
      const code = extractCode(candidate);
      if (code) {
        return code;
      }
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Código de validação não encontrado no MailHog.");
}

function pickDoctor(doctors: DoctorSummary[]): DoctorSummary {
  const preferred =
    doctors.find((doctor) => doctor.specialty === "Dermatologia") ??
    doctors.find((doctor) => !doctor.name.includes("Helena")) ??
    doctors[0];
  if (!preferred) {
    throw new Error("Nenhum médico disponível no seed.");
  }
  return preferred;
}

test("paciente agenda, confirma com código do MailHog e vê no calendário", async ({
  page,
}) => {
  const tokens = await openBooking(page);
  const doctors = await listDoctors(page, tokens.accessToken);
  const doctor = pickDoctor(doctors);
  const slots = await listSlots(page, tokens.accessToken, doctor.id);
  const slot = pickFutureSlot(slots, 0);

  let appointmentId: string | null = null;

  try {
    await page
      .getByRole("radio")
      .filter({ hasText: doctor.name })
      .click();
    await page.getByRole("button", { name: /^continuar$/i }).click();

    const slotButton = page.locator(`[data-slot="${slot.startsAt}"]`);
    await expect(slotButton).toBeVisible({ timeout: 30000 });
    await slotButton.click();
    await page.getByRole("button", { name: /^continuar$/i }).click();
    await page.getByRole("button", { name: /^continuar$/i }).click();

    const previousMessageId = await latestMessageId(page);
    await page.getByTestId("confirm-booking").click();

    await expect(page).toHaveURL(/\/paciente\/confirmar-agendamento/);
    const url = new URL(page.url());
    const createdId = url.searchParams.get("appointmentId");
    if (!createdId) {
      throw new Error("appointmentId ausente na URL de confirmação.");
    }
    appointmentId = createdId;

    await waitForCodeInput(page);

    const code = await waitForCode(page, previousMessageId);
    await page.getByTestId("code-input-0").click();
    await page.keyboard.type(code);
    await page.getByTestId("verify-code").click();

    await expect(
      page.getByRole("heading", { name: /agendamento confirmado/i }),
    ).toBeVisible({ timeout: 30000 });

    const confirmed = await getAppointment(
      page,
      tokens.accessToken,
      createdId,
    );
    expect(confirmed.status).toBe("confirmed");

    await page.goto("/paciente/calendario");
    await expect(
      page.getByRole("main").getByRole("heading", { name: /^calendário$/i }),
    ).toBeVisible();
    await expect(page.getByText(doctor.name).first()).toBeVisible();
    await expect(page.getByText("Confirmada").first()).toBeVisible({
      timeout: 30000,
    });
  } finally {
    if (appointmentId) {
      await cancelAppointment(page, tokens.accessToken, appointmentId);
    }
  }
});

test("código incorreto mostra erro genérico e mantém o agendamento pendente", async ({
  page,
}) => {
  const tokens = await openBooking(page);
  const doctors = await listDoctors(page, tokens.accessToken);
  const doctor = pickDoctor(doctors);
  const slots = await listSlots(page, tokens.accessToken, doctor.id);
  const slot = pickFutureSlot(slots, 2);
  const appointment = await createAppointment(
    page,
    tokens.accessToken,
    doctor.id,
    slot.startsAt,
  );

  try {
    await page.goto(
      `/paciente/confirmar-agendamento?appointmentId=${appointment.id}`,
    );
    await waitForCodeInput(page);

    const code = await waitForCode(page, null);
    const wrongCode = code === "000000" ? "000001" : "000000";
    await page.getByTestId("code-input-0").click();
    await page.keyboard.type(wrongCode);
    await page.getByTestId("verify-code").click();

    await expect(
      page.getByText(/código inválido ou expirado/i),
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/tentativas restantes: 4/i)).toBeVisible();

    const pending = await getAppointment(
      page,
      tokens.accessToken,
      appointment.id,
    );
    expect(pending.status).toBe("pending_code");
  } finally {
    await cancelAppointment(page, tokens.accessToken, appointment.id);
  }
});
