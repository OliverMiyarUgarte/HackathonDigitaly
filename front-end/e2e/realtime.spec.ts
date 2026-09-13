import { expect, test, type Page } from "@playwright/test";
import {
  buildAudioChunkPayload,
  computeRmsLevel,
  floatTo16BitPCM,
  int16ToBase64,
  PcmFrameBatcher,
} from "../lib/realtime/pcm";

const API_BASE = "http://localhost:3001/api";
const DEMO_PASSWORD = "Demo@1234";

test.describe("codificador PCM s16le", () => {
  test("converte float para 16 bits, base64, lotes e sequência", () => {
    const ints = floatTo16BitPCM(
      new Float32Array([0, 1, -1, 0.5, -0.5]),
    );
    expect(Array.from(ints)).toEqual([0, 32767, -32768, 16384, -16384]);

    expect(int16ToBase64(new Int16Array([0, 32767]))).toBe("AAD/fw==");

    const batcher = new PcmFrameBatcher(4);
    const batches = batcher.push(new Float32Array([1, 2, 3, 4, 5]));
    expect(batches).toHaveLength(1);
    expect(Array.from(batches[0])).toEqual([1, 2, 3, 4]);
    expect(batcher.pending).toBe(1);
    const flushed = batcher.flush();
    expect(Array.from(flushed ?? [])).toEqual([5]);
    expect(batcher.flush()).toBeNull();

    const payload = buildAudioChunkPayload(
      "11111111-1111-4111-8111-111111111111",
      7,
      new Float32Array([0, 1]),
    );
    expect(payload.seq).toBe(7);
    expect(payload.encoding).toBe("pcm_s16le");
    expect(payload.sampleRate).toBe(16000);
    expect(payload.channels).toBe(1);
    expect(payload.data.length).toBeGreaterThan(0);

    expect(computeRmsLevel(new Float32Array([0, 0]))).toBe(0);
    expect(computeRmsLevel(new Float32Array([1, 1]))).toBeCloseTo(1, 5);
  });
});

async function login(page: Page, email: string): Promise<string> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await page.request.post(`${API_BASE}/auth/login`, {
      data: { email, password: DEMO_PASSWORD },
    });
    lastStatus = response.status();
    if (response.ok()) {
      const session = (await response.json()) as {
        user: { role: "doctor" | "patient" };
        tokens: { accessToken: string; refreshToken: string };
      };
      await page.goto("/entrar");
      await page.evaluate((tokens) => {
        window.localStorage.setItem("digitaly.accessToken", tokens.accessToken);
        window.localStorage.setItem("digitaly.refreshToken", tokens.refreshToken);
      }, session.tokens);
      await page.goto(session.user.role === "doctor" ? "/medico" : "/paciente");
      await expect(
        page.locator('[data-testid="realtime-state"]'),
      ).toHaveAttribute("data-state", "connected", { timeout: 30000 });
      return session.tokens.accessToken;
    }
    if (lastStatus === 429) {
      await page.waitForTimeout(15000);
      continue;
    }
    break;
  }
  throw new Error(`Login falhou para ${email} (HTTP ${lastStatus})`);
}

interface DoctorAppointmentResponse {
  appointmentId: string;
  status: string;
  consultationId: string | null;
}

interface StartConsultationResponse {
  consultationId: string;
  appointmentId: string;
}

async function resolveConsultation(
  page: Page,
  token: string,
): Promise<{ consultationId: string; appointmentId: string; fresh: boolean }> {
  const headers = { Authorization: `Bearer ${token}` };
  const listResponse = await page.request.get(
    `${API_BASE}/appointments/doctor`,
    { headers },
  );
  expect(listResponse.ok()).toBeTruthy();
  const appointments =
    (await listResponse.json()) as DoctorAppointmentResponse[];

  const confirmed = appointments.find(
    (appointment) =>
      appointment.status === "confirmed" && appointment.consultationId === null,
  );
  if (confirmed) {
    const startResponse = await page.request.post(
      `${API_BASE}/appointments/${confirmed.appointmentId}/consultations/start`,
      { headers },
    );
    if (startResponse.ok()) {
      const started =
        (await startResponse.json()) as StartConsultationResponse;
      return {
        consultationId: started.consultationId,
        appointmentId: started.appointmentId,
        fresh: true,
      };
    }
  }

  const active = appointments.find(
    (appointment) =>
      appointment.status === "in_progress" && appointment.consultationId,
  );
  if (active?.consultationId) {
    return {
      consultationId: active.consultationId,
      appointmentId: active.appointmentId,
      fresh: false,
    };
  }

  const existing = appointments.find(
    (appointment) => appointment.consultationId !== null,
  );
  if (!existing || !existing.consultationId) {
    throw new Error(
      "Nenhum atendimento disponível. Rode o seed do banco antes dos testes.",
    );
  }
  return {
    consultationId: existing.consultationId,
    appointmentId: existing.appointmentId,
    fresh: false,
  };
}

async function remoteVideoTracks(page: Page): Promise<number> {
  return page.evaluate(() => {
    const video = document.querySelector<HTMLVideoElement>(
      '[data-testid="remote-video"]',
    );
    return video?.srcObject instanceof MediaStream
      ? video.srcObject.getVideoTracks().length
      : 0;
  });
}

test.describe("sala de teleconsulta", () => {
  test("dois navegadores conectam mídia, propagam estado e isolam o copiloto", async ({
    browser,
  }) => {
    test.setTimeout(180_000);

    const doctorContext = await browser.newContext({
      permissions: ["camera", "microphone"],
    });
    const patientContext = await browser.newContext({
      permissions: ["camera", "microphone"],
    });
    const doctorPage = await doctorContext.newPage();
    const patientPage = await patientContext.newPage();

    await login(patientPage, "paciente@digitaly.health");
    const doctorToken = await login(doctorPage, "medico@digitaly.health");

    const worklet = await doctorPage.request.get(
      "http://localhost:3000/worklets/pcm-capture-processor.js",
    );
    expect(worklet.ok()).toBeTruthy();

    const consultation = await resolveConsultation(doctorPage, doctorToken);
    const roomPath = `/medico/consultas/${consultation.consultationId}`;

    if (consultation.fresh) {
      await expect(
        patientPage.getByText(/iniciou o atendimento/i),
      ).toBeVisible({ timeout: 30000 });
      await patientPage.getByRole("button", { name: /entrar na sala/i }).click();
    } else {
      test.info().annotations.push({
        type: "nota",
        description:
          "Consulta já existente no banco; o aviso de consultation.started não é reemitido nesta execução.",
      });
      await patientPage.goto(
        `/paciente/consultas/${consultation.consultationId}`,
      );
    }

    await doctorPage.goto(roomPath);

    await expect(doctorPage.getByTestId("consultation-room")).toBeVisible();
    await expect(patientPage.getByTestId("consultation-room")).toBeVisible();

    await doctorPage.getByTestId("enter-room").click();
    await patientPage.getByTestId("enter-room").click();

    await expect(doctorPage.getByTestId("consultation-room")).toHaveAttribute(
      "data-connection-state",
      "connected",
      { timeout: 60000 },
    );
    await expect(patientPage.getByTestId("consultation-room")).toHaveAttribute(
      "data-connection-state",
      "connected",
      { timeout: 60000 },
    );

    await expect
      .poll(() => remoteVideoTracks(doctorPage), { timeout: 30000 })
      .toBeGreaterThan(0);
    await expect
      .poll(() => remoteVideoTracks(patientPage), { timeout: 30000 })
      .toBeGreaterThan(0);

    const doctorTileOnPatient = patientPage.locator(
      '[data-testid="participant"][data-participant-role="doctor"]',
    );
    await expect(doctorTileOnPatient).toHaveAttribute("data-mic", "true", {
      timeout: 30000,
    });

    await doctorPage.getByTestId("toggle-mic").click();
    await expect(doctorTileOnPatient).toHaveAttribute("data-mic", "false", {
      timeout: 30000,
    });

    await doctorPage.getByTestId("toggle-camera").click();
    await expect(doctorTileOnPatient).toHaveAttribute("data-camera", "false", {
      timeout: 30000,
    });

    await expect(doctorPage.getByTestId("copilot-panel")).toBeVisible();
    await expect(patientPage.getByTestId("copilot-panel")).toHaveCount(0);

    await doctorPage.getByTestId("toggle-mic").click();
    await expect(doctorTileOnPatient).toHaveAttribute("data-mic", "true", {
      timeout: 30000,
    });

    await doctorContext.close();
    await patientContext.close();
  });
});
