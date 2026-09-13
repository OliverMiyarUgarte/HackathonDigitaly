import { expect, test, type Page } from "@playwright/test";
import { readTokens, storageStatePath, type SessionTokens } from "./auth";

const API_BASE = "http://localhost:3001/api";
const MAILHOG_MESSAGES = "http://localhost:8025/api/v2/messages";
const PATIENT_EMAIL = "paciente2@digitaly.health";

interface UserSummary {
  id: string;
  name: string;
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

interface DoctorAppointment {
  appointmentId: string;
  scheduledAt: string;
  status: string;
  patient: { id: string; name: string; role: string; specialty: string | null };
  consultationId: string | null;
  hasPreConsult: boolean;
}

interface MailHogAddress {
  Mailbox: string;
  Domain: string;
}

interface MailHogMessage {
  ID: string;
  To: MailHogAddress[];
  MIME?: { Parts?: { Body?: string }[] } | null;
}

interface MailHogResponse {
  items?: MailHogMessage[];
}

test.use({ storageState: storageStatePath("doctor2") });

test.describe.configure({ mode: "serial" });

let sharedDoctorTokens: SessionTokens | null = null;
let sharedPatientTokens: SessionTokens | null = null;

function doctorSession(): SessionTokens {
  sharedDoctorTokens = sharedDoctorTokens ?? readTokens("doctor2");
  return sharedDoctorTokens;
}

function patientSession(): SessionTokens {
  sharedPatientTokens = sharedPatientTokens ?? readTokens("patient2");
  return sharedPatientTokens;
}

function authHeaders(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

async function getMe(page: Page, token: string): Promise<UserSummary> {
  const response = await page.request.get(`${API_BASE}/auth/me`, {
    headers: authHeaders(token),
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as UserSummary;
}

async function listDoctorAppointments(
  page: Page,
  token: string,
): Promise<DoctorAppointment[]> {
  const response = await page.request.get(`${API_BASE}/appointments/doctor`, {
    headers: authHeaders(token),
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as DoctorAppointment[];
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
): Promise<AppointmentSummary | null> {
  const response = await page.request.post(`${API_BASE}/appointments`, {
    headers: authHeaders(token),
    data: { doctorId, scheduledAt: startsAt },
  });
  if (response.status() === 409) {
    return null;
  }
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as AppointmentSummary;
}

async function requestCode(
  page: Page,
  token: string,
  appointmentId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await page.request.post(
      `${API_BASE}/appointments/${appointmentId}/request-code`,
      { headers: authHeaders(token) },
    );
    if (response.ok()) {
      return;
    }
    if (response.status() === 429) {
      await page.waitForTimeout(61_000);
      continue;
    }
    throw new Error(`request-code falhou (HTTP ${response.status()})`);
  }
  throw new Error("request-code atingiu o limite de tentativas");
}

async function verifyCode(
  page: Page,
  token: string,
  appointmentId: string,
  code: string,
): Promise<AppointmentSummary> {
  const response = await page.request.post(
    `${API_BASE}/appointments/${appointmentId}/verify-code`,
    {
      headers: authHeaders(token),
      data: { code },
    },
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

async function mailhogMessages(page: Page): Promise<MailHogMessage[]> {
  const response = await page.request.get(MAILHOG_MESSAGES);
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as MailHogResponse;
  return payload.items ?? [];
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
          (address) => `${address.Mailbox}@${address.Domain}` === PATIENT_EMAIL,
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

async function latestMessageId(page: Page): Promise<string | null> {
  const messages = await mailhogMessages(page);
  return messages[0]?.ID ?? null;
}

async function ensureConfirmedAppointment(
  page: Page,
  doctorToken: string,
): Promise<{
  appointment: DoctorAppointment;
  created: boolean;
  patientToken: SessionTokens | null;
}> {
  const existing = (await listDoctorAppointments(page, doctorToken)).find(
    (appointment) =>
      appointment.status === "confirmed" && appointment.consultationId === null,
  );
  if (existing) {
    return { appointment: existing, created: false, patientToken: null };
  }

  const patientToken = patientSession();
  const doctor = await getMe(page, doctorToken);
  const slots = await listSlots(page, patientToken.accessToken, doctor.id);
  const candidates = slots.filter(
    (slot) => new Date(slot.startsAt).getTime() > Date.now(),
  );

  let appointment: AppointmentSummary | null = null;
  for (const slot of candidates.slice(0, 8)) {
    appointment = await createAppointment(
      page,
      patientToken.accessToken,
      doctor.id,
      slot.startsAt,
    );
    if (appointment) {
      break;
    }
  }
  if (!appointment) {
    throw new Error("Não foi possível criar um agendamento livre para o teste.");
  }

  const previousMessageId = await latestMessageId(page);
  await requestCode(page, patientToken.accessToken, appointment.id);
  const code = await waitForCode(page, previousMessageId);
  const confirmed = await verifyCode(
    page,
    patientToken.accessToken,
    appointment.id,
    code,
  );
  expect(confirmed.status).toBe("confirmed");

  const created = (await listDoctorAppointments(page, doctorToken)).find(
    (item) => item.appointmentId === appointment.id,
  );
  if (!created) {
    throw new Error("Agendamento confirmado não apareceu na agenda do médico.");
  }
  return { appointment: created, created: true, patientToken };
}

function urlConsultationId(page: Page): string {
  const match = page.url().match(/\/medico\/consultas\/([^/?#]+)/);
  if (!match) {
    throw new Error(`URL sem consultationId: ${page.url()}`);
  }
  return match[1];
}

function saoPauloDateKey(value: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const read = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

test("médico inicia o atendimento, encerra, registra o prontuário e o vê no paciente", async ({
  page,
}) => {
  test.setTimeout(240_000);

  const doctorTokens = doctorSession();
  await page.goto("/medico");
  await expect(page.getByTestId("doctor-home")).toBeVisible({
    timeout: 30000,
  });

  const { appointment, created, patientToken } =
    await ensureConfirmedAppointment(page, doctorTokens.accessToken);
  if (patientToken) {
    sharedPatientTokens = patientToken;
  }

  let started = false;
  try {
    await page.goto("/medico/atendimentos");
    await expect(page.getByTestId("doctor-agenda")).toBeVisible({
      timeout: 30000,
    });
    await page
      .getByLabel("Data", { exact: true })
      .fill(saoPauloDateKey(appointment.scheduledAt));

    const actionCell = page.locator(
      `[data-testid="appointment-actions"][data-appointment-id="${appointment.appointmentId}"]:visible`,
    );
    await expect(actionCell).toBeVisible({ timeout: 30000 });
    await actionCell
      .getByRole("button", { name: /iniciar teleatendimento/i })
      .click();

    const confirmDialog = page.getByRole("dialog");
    await expect(
      confirmDialog.getByText(appointment.patient.name, { exact: false }),
    ).toBeVisible();
    await confirmDialog
      .getByRole("button", { name: /^iniciar teleatendimento$/i })
      .click();

    await expect(page).toHaveURL(/\/medico\/consultas\/[^/]+$/, {
      timeout: 30000,
    });
    const consultationId = urlConsultationId(page);
    started = true;

    await expect(page.getByTestId("consultation-room")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId("consultation-room")).toHaveAttribute(
      "data-role",
      "doctor",
    );

    await page.getByTestId("enter-room").click();
    await expect(page.getByTestId("local-video")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId("copilot-panel")).toBeVisible();
    await expect(page.getByTestId("copilot-status")).toBeVisible();

    await page.getByTestId("toggle-copilot-audio").click();
    await expect(page.getByTestId("toggle-copilot-audio")).toHaveAttribute(
      "data-streaming",
      "true",
      { timeout: 30000 },
    );

    await page.getByTestId("end-call").click();
    const endDialog = page.getByRole("dialog");
    await endDialog.getByRole("button", { name: /^encerrar$/i }).click();

    await expect(page).toHaveURL(
      new RegExp(`/medico/consultas/${consultationId}/fechamento$`),
      { timeout: 30000 },
    );
    await expect(page.getByTestId("consultation-closing")).toBeVisible({
      timeout: 30000,
    });

    const notes = "Paciente estável, sem queixas novas durante o atendimento.";
    const diagnosis = "Hipertensão arterial sistêmica compensada";
    await page.getByTestId("closing-notes").fill(notes);
    await page.getByTestId("closing-diagnosis").fill(diagnosis);
    await page
      .getByTestId("prescription-input-0")
      .fill("Losartana 50 mg, 1 comprimido pela manhã");
    await page.getByTestId("add-prescription").click();
    await page
      .getByTestId("prescription-input-1")
      .fill("Hidroclorotiazida 25 mg, 1 comprimido pela manhã");
    await page.getByTestId("submit-record").click();

    await expect(page.getByTestId("closing-success")).toBeVisible({
      timeout: 30000,
    });

    const patientId = appointment.patient.id;
    const overviewResponse = await page.request.get(
      `${API_BASE}/patients/${patientId}/overview`,
      { headers: authHeaders(doctorTokens.accessToken) },
    );
    expect(overviewResponse.ok()).toBeTruthy();
    const overview = (await overviewResponse.json()) as {
      history: { id: string; consultationId: string }[];
    };
    const record = overview.history.find(
      (entry) => entry.consultationId === consultationId,
    );
    expect(record).toBeTruthy();

    await page.goto(`/medico/pacientes/${patientId}`);
    await expect(page.getByTestId("patient-overview")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(diagnosis).first()).toBeVisible();

    await page.goto(`/medico/prontuario?patientId=${patientId}`);
    await expect(page.getByTestId("records-history")).toBeVisible({
      timeout: 30000,
    });

    if (record) {
      await page.goto(`/medico/prontuario/${record.id}`);
      await expect(page.getByTestId("medical-record-detail")).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByText(diagnosis).first()).toBeVisible();
      await expect(page.getByText(notes).first()).toBeVisible();
    }
  } finally {
    if (created && !started && patientToken) {
      await cancelAppointment(
        page,
        patientToken.accessToken,
        appointment.appointmentId,
      );
    }
  }
});

test("CONSULTATION_EXISTS abre a sala já existente", async ({ page }) => {
  test.setTimeout(120_000);

  const doctorToken = doctorSession();
  sharedDoctorTokens = doctorToken;

  const appointmentId = "aaaaaaaa-0000-4000-8000-000000000001";
  const consultationId = "bbbbbbbb-0000-4000-8000-000000000002";
  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const patient = {
    id: "aaaaaaaa-0000-4000-8000-000000000003",
    name: "Paciente Teste",
    role: "patient",
    specialty: null,
  };

  let startAttempted = false;

  await page.route("**/appointments/doctor**", async (route) => {
    const payload: DoctorAppointment = startAttempted
      ? {
          appointmentId,
          scheduledAt,
          status: "in_progress",
          patient,
          consultationId,
          hasPreConsult: false,
        }
      : {
          appointmentId,
          scheduledAt,
          status: "confirmed",
          patient,
          consultationId: null,
          hasPreConsult: false,
        };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([payload]),
    });
  });

  await page.route(
    `**/appointments/${appointmentId}/consultations/start`,
    async (route) => {
      startAttempted = true;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          statusCode: 409,
          error: "CONSULTATION_EXISTS",
          message: "Consultation already exists",
          details: null,
          timestamp: new Date().toISOString(),
          path: `/api/appointments/${appointmentId}/consultations/start`,
          correlationId: "e2e-test",
        }),
      });
    },
  );

  await page.goto("/medico/atendimentos");
  await expect(page.getByTestId("doctor-agenda")).toBeVisible({
    timeout: 30000,
  });

  const actionCell = page.locator(
    `[data-testid="appointment-actions"][data-appointment-id="${appointmentId}"]:visible`,
  );
  await expect(actionCell).toBeVisible({ timeout: 30000 });
  await actionCell
    .getByRole("button", { name: /iniciar teleatendimento/i })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^iniciar teleatendimento$/i })
    .click();

  await expect(page).toHaveURL(
    new RegExp(`/medico/consultas/${consultationId}$`),
    { timeout: 30000 },
  );
});

test.describe("permissões do paciente", () => {
  test.use({ storageState: storageStatePath("patient2") });

  test("paciente não acessa rotas do médico", async ({ page }) => {
    patientSession();

    await page.goto("/medico");
    await expect(page).toHaveURL(/\/paciente$/, { timeout: 30000 });

    await page.goto("/medico/atendimentos");
    await expect(page).toHaveURL(/\/paciente$/, { timeout: 30000 });

    await page.goto("/medico/prontuario");
    await expect(page).toHaveURL(/\/paciente$/, { timeout: 30000 });
  });
});
