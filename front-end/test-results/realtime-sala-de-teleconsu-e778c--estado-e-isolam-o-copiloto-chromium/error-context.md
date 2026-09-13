# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: realtime.spec.ts >> sala de teleconsulta >> dois navegadores conectam mídia, propagam estado e isolam o copiloto
- Location: e2e/realtime.spec.ts:162:7

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: locator('[data-testid="realtime-state"]')
Expected: "connected"
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toHaveAttribute" locator('[data-testid="realtime-state"]') with timeout 30000ms
  - waiting for locator('[data-testid="realtime-state"]')

```

```yaml
- banner:
  - img "Digitaly"
  - button "Ativar tema claro"
- main:
  - paragraph: Teleatendimento
  - paragraph: Inteligência em Produção
  - heading "Entrar no teleatendimento" [level=3]
  - paragraph: Use o e-mail e a senha da sua conta. O perfil é identificado automaticamente pelo cadastro.
  - tablist "Perfil de acesso":
    - tab "Paciente" [selected]
    - tab "Médico"
  - text: E-mail
  - textbox "E-mail":
    - /placeholder: voce@exemplo.com
  - text: Senha
  - textbox "Senha":
    - /placeholder: Sua senha
  - button "Mostrar senha"
  - link "Esqueci minha senha":
    - /url: /recuperar-senha
  - button "Entrar na plataforma"
  - paragraph:
    - text: Ainda não tem conta?
    - link "Criar conta de paciente":
      - /url: /registro
- contentinfo: Digitaly · Engenharia de IA para Transformação de Negócios
- alert
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | import {
  3   |   buildAudioChunkPayload,
  4   |   computeRmsLevel,
  5   |   floatTo16BitPCM,
  6   |   int16ToBase64,
  7   |   PcmFrameBatcher,
  8   | } from "../lib/realtime/pcm";
  9   | 
  10  | const API_BASE = "http://localhost:3001/api";
  11  | const DEMO_PASSWORD = "Demo@1234";
  12  | 
  13  | test.describe("codificador PCM s16le", () => {
  14  |   test("converte float para 16 bits, base64, lotes e sequência", () => {
  15  |     const ints = floatTo16BitPCM(
  16  |       new Float32Array([0, 1, -1, 0.5, -0.5]),
  17  |     );
  18  |     expect(Array.from(ints)).toEqual([0, 32767, -32768, 16384, -16384]);
  19  | 
  20  |     expect(int16ToBase64(new Int16Array([0, 32767]))).toBe("AAD/fw==");
  21  | 
  22  |     const batcher = new PcmFrameBatcher(4);
  23  |     const batches = batcher.push(new Float32Array([1, 2, 3, 4, 5]));
  24  |     expect(batches).toHaveLength(1);
  25  |     expect(Array.from(batches[0])).toEqual([1, 2, 3, 4]);
  26  |     expect(batcher.pending).toBe(1);
  27  |     const flushed = batcher.flush();
  28  |     expect(Array.from(flushed ?? [])).toEqual([5]);
  29  |     expect(batcher.flush()).toBeNull();
  30  | 
  31  |     const payload = buildAudioChunkPayload(
  32  |       "11111111-1111-4111-8111-111111111111",
  33  |       7,
  34  |       new Float32Array([0, 1]),
  35  |     );
  36  |     expect(payload.seq).toBe(7);
  37  |     expect(payload.encoding).toBe("pcm_s16le");
  38  |     expect(payload.sampleRate).toBe(16000);
  39  |     expect(payload.channels).toBe(1);
  40  |     expect(payload.data.length).toBeGreaterThan(0);
  41  | 
  42  |     expect(computeRmsLevel(new Float32Array([0, 0]))).toBe(0);
  43  |     expect(computeRmsLevel(new Float32Array([1, 1]))).toBeCloseTo(1, 5);
  44  |   });
  45  | });
  46  | 
  47  | async function login(page: Page, email: string): Promise<string> {
  48  |   let lastStatus = 0;
  49  |   for (let attempt = 0; attempt < 4; attempt += 1) {
  50  |     const response = await page.request.post(`${API_BASE}/auth/login`, {
  51  |       data: { email, password: DEMO_PASSWORD },
  52  |     });
  53  |     lastStatus = response.status();
  54  |     if (response.ok()) {
  55  |       const session = (await response.json()) as {
  56  |         user: { role: "doctor" | "patient" };
  57  |         tokens: { accessToken: string; refreshToken: string };
  58  |       };
  59  |       await page.goto("/entrar");
  60  |       await page.evaluate((tokens) => {
  61  |         window.localStorage.setItem("digitaly.accessToken", tokens.accessToken);
  62  |         window.localStorage.setItem("digitaly.refreshToken", tokens.refreshToken);
  63  |       }, session.tokens);
  64  |       await page.goto(session.user.role === "doctor" ? "/medico" : "/paciente");
  65  |       await expect(
  66  |         page.locator('[data-testid="realtime-state"]'),
> 67  |       ).toHaveAttribute("data-state", "connected", { timeout: 30000 });
      |         ^ Error: expect(locator).toHaveAttribute(expected) failed
  68  |       return session.tokens.accessToken;
  69  |     }
  70  |     if (lastStatus === 429) {
  71  |       await page.waitForTimeout(15000);
  72  |       continue;
  73  |     }
  74  |     break;
  75  |   }
  76  |   throw new Error(`Login falhou para ${email} (HTTP ${lastStatus})`);
  77  | }
  78  | 
  79  | interface DoctorAppointmentResponse {
  80  |   appointmentId: string;
  81  |   status: string;
  82  |   consultationId: string | null;
  83  | }
  84  | 
  85  | interface StartConsultationResponse {
  86  |   consultationId: string;
  87  |   appointmentId: string;
  88  | }
  89  | 
  90  | async function resolveConsultation(
  91  |   page: Page,
  92  |   token: string,
  93  | ): Promise<{ consultationId: string; appointmentId: string; fresh: boolean }> {
  94  |   const headers = { Authorization: `Bearer ${token}` };
  95  |   const listResponse = await page.request.get(
  96  |     `${API_BASE}/appointments/doctor`,
  97  |     { headers },
  98  |   );
  99  |   expect(listResponse.ok()).toBeTruthy();
  100 |   const appointments =
  101 |     (await listResponse.json()) as DoctorAppointmentResponse[];
  102 | 
  103 |   const confirmed = appointments.find(
  104 |     (appointment) =>
  105 |       appointment.status === "confirmed" && appointment.consultationId === null,
  106 |   );
  107 |   if (confirmed) {
  108 |     const startResponse = await page.request.post(
  109 |       `${API_BASE}/appointments/${confirmed.appointmentId}/consultations/start`,
  110 |       { headers },
  111 |     );
  112 |     if (startResponse.ok()) {
  113 |       const started =
  114 |         (await startResponse.json()) as StartConsultationResponse;
  115 |       return {
  116 |         consultationId: started.consultationId,
  117 |         appointmentId: started.appointmentId,
  118 |         fresh: true,
  119 |       };
  120 |     }
  121 |   }
  122 | 
  123 |   const active = appointments.find(
  124 |     (appointment) =>
  125 |       appointment.status === "in_progress" && appointment.consultationId,
  126 |   );
  127 |   if (active?.consultationId) {
  128 |     return {
  129 |       consultationId: active.consultationId,
  130 |       appointmentId: active.appointmentId,
  131 |       fresh: false,
  132 |     };
  133 |   }
  134 | 
  135 |   const existing = appointments.find(
  136 |     (appointment) => appointment.consultationId !== null,
  137 |   );
  138 |   if (!existing || !existing.consultationId) {
  139 |     throw new Error(
  140 |       "Nenhum atendimento disponível. Rode o seed do banco antes dos testes.",
  141 |     );
  142 |   }
  143 |   return {
  144 |     consultationId: existing.consultationId,
  145 |     appointmentId: existing.appointmentId,
  146 |     fresh: false,
  147 |   };
  148 | }
  149 | 
  150 | async function remoteVideoTracks(page: Page): Promise<number> {
  151 |   return page.evaluate(() => {
  152 |     const video = document.querySelector<HTMLVideoElement>(
  153 |       '[data-testid="remote-video"]',
  154 |     );
  155 |     return video?.srcObject instanceof MediaStream
  156 |       ? video.srcObject.getVideoTracks().length
  157 |       : 0;
  158 |   });
  159 | }
  160 | 
  161 | test.describe("sala de teleconsulta", () => {
  162 |   test("dois navegadores conectam mídia, propagam estado e isolam o copiloto", async ({
  163 |     browser,
  164 |   }) => {
  165 |     test.setTimeout(180_000);
  166 | 
  167 |     const doctorContext = await browser.newContext({
```