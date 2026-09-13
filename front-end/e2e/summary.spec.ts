import { expect, test, type Page, type Route } from "@playwright/test";
import { storageStatePath } from "./auth";

const CONSULTATION_ID = "c1c1c1c1-1111-4111-8111-111111111111";
const APPOINTMENT_ID = "a1a1a1a1-1111-4111-8111-111111111111";
const DOCTOR_ID = "d1d1d1d1-1111-4111-8111-111111111111";
const PATIENT_ID = "a2a2a2a2-2222-4222-8222-222222222222";

const SUMMARY = {
  consultationId: CONSULTATION_ID,
  doctorSummary:
    "Paciente com hipertensão arterial compensada, sem queixas novas. Mantida a medicação atual e orientado retorno em 30 dias.",
  patientSummary:
    "Sua pressão está controlada com o remédio que você já usa. Continue tomando todos os dias e agende o retorno em 30 dias.",
  generatedAt: "2026-09-13T14:00:00.000Z",
};

const CONSULTATION = {
  id: CONSULTATION_ID,
  appointmentId: APPOINTMENT_ID,
  status: "ended",
  startedAt: "2026-09-13T13:30:00.000Z",
  endedAt: "2026-09-13T14:00:00.000Z",
};

const APPOINTMENT = {
  id: APPOINTMENT_ID,
  patientId: PATIENT_ID,
  doctorId: DOCTOR_ID,
  scheduledAt: "2026-09-13T13:30:00.000Z",
  status: "completed",
  createdAt: "2026-09-10T10:00:00.000Z",
  updatedAt: "2026-09-13T14:00:00.000Z",
};

const PATIENT = {
  id: PATIENT_ID,
  name: "Maria Souza",
  email: "maria.souza@example.com",
  role: "patient",
  specialty: null,
  crm: null,
  createdAt: "2026-01-10T10:00:00.000Z",
};

const OVERVIEW = {
  patient: PATIENT,
  upcomingAppointment: null,
  history: [],
  preConsult: [],
};

const NOT_FOUND = {
  statusCode: 404,
  error: "NOT_FOUND",
  message: "Consultation summary not found",
  details: null,
  timestamp: "2026-09-13T14:00:05.000Z",
  path: `/api/consultations/${CONSULTATION_ID}/summary`,
  correlationId: "e2e-summary",
};

async function routeJson(
  page: Page,
  pathname: string,
  body: unknown,
  status = 200,
): Promise<void> {
  await page.route(
    (url) => url.pathname === pathname,
    async (route: Route) => {
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    },
  );
}

async function routeConsultationEnded(page: Page): Promise<void> {
  await routeJson(
    page,
    `/api/consultations/${CONSULTATION_ID}`,
    CONSULTATION,
  );
}

test.describe("resumo do atendimento — médico", () => {
  test.use({ storageState: storageStatePath("doctor") });

  test("fechamento exibe o resumo clínico e preenche as notas", async ({
    page,
  }) => {
    await routeConsultationEnded(page);
    await routeJson(page, `/api/appointments/${APPOINTMENT_ID}`, APPOINTMENT);
    await routeJson(
      page,
      `/api/patients/${PATIENT_ID}/overview`,
      OVERVIEW,
    );
    await routeJson(
      page,
      `/api/appointments/${APPOINTMENT_ID}/pre-consult`,
      [],
    );
    await routeJson(
      page,
      `/api/consultations/${CONSULTATION_ID}/summary`,
      SUMMARY,
    );

    await page.goto(`/medico/consultas/${CONSULTATION_ID}/fechamento`);

    await expect(page.getByTestId("consultation-closing")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId("consultation-summary")).toHaveAttribute(
      "data-status",
      "ready",
      { timeout: 30000 },
    );
    await expect(page.getByTestId("summary-doctor")).toContainText(
      SUMMARY.doctorSummary,
    );
    await expect(page.getByTestId("summary-patient")).toContainText(
      SUMMARY.patientSummary,
    );

    await page.getByTestId("use-summary-notes").click();
    await expect(page.getByTestId("closing-notes")).toHaveValue(
      SUMMARY.doctorSummary,
    );
  });
});

test.describe("resumo do atendimento — paciente", () => {
  test.use({ storageState: storageStatePath("patient") });

  test("pós-consulta mostra a orientação simples e o resumo clínico", async ({
    page,
  }) => {
    await routeConsultationEnded(page);
    await routeJson(
      page,
      `/api/consultations/${CONSULTATION_ID}/summary`,
      SUMMARY,
    );

    await page.goto(`/paciente/consultas/${CONSULTATION_ID}`);

    await expect(page.getByTestId("post-call-summary")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId("summary-patient")).toContainText(
      SUMMARY.patientSummary,
    );

    await page.getByTestId("summary-clinical").locator("summary").click();
    await expect(page.getByTestId("summary-doctor")).toContainText(
      SUMMARY.doctorSummary,
    );
  });

  test("estado pendente carrega o resumo ao tentar novamente", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await routeConsultationEnded(page);

    let ready = false;
    await page.route(
      (url) => url.pathname === `/api/consultations/${CONSULTATION_ID}/summary`,
      async (route: Route) => {
        if (!ready) {
          await route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify(NOT_FOUND),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(SUMMARY),
        });
      },
    );

    await page.goto(`/paciente/consultas/${CONSULTATION_ID}`);
    await expect(page.getByTestId("summary-pending")).toBeVisible({
      timeout: 30000,
    });

    ready = true;
    await page.getByRole("button", { name: /verificar novamente/i }).click();

    await expect(page.getByTestId("consultation-summary")).toHaveAttribute(
      "data-status",
      "ready",
      { timeout: 30000 },
    );
    await expect(page.getByTestId("summary-patient")).toContainText(
      SUMMARY.patientSummary,
    );
  });
});
