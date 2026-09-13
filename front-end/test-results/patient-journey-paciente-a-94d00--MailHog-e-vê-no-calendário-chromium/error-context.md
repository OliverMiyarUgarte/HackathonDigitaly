# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: patient-journey.spec.ts >> paciente agenda, confirma com código do MailHog e vê no calendário
- Location: e2e/patient-journey.spec.ts:240:5

# Error details

```
Error: Login falhou para paciente@digitaly.health (HTTP 429)
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | 
  3   | const API_BASE = "http://localhost:3001/api";
  4   | const MAILHOG_MESSAGES = "http://localhost:8025/api/v2/messages";
  5   | const DEMO_PASSWORD = "Demo@1234";
  6   | const PATIENT_EMAIL = "paciente@digitaly.health";
  7   | 
  8   | interface SessionTokens {
  9   |   accessToken: string;
  10  |   refreshToken: string;
  11  | }
  12  | 
  13  | interface DoctorSummary {
  14  |   id: string;
  15  |   name: string;
  16  |   specialty: string | null;
  17  |   crm: string | null;
  18  | }
  19  | 
  20  | interface SlotSummary {
  21  |   startsAt: string;
  22  |   endsAt: string;
  23  |   doctorId: string;
  24  | }
  25  | 
  26  | interface AppointmentSummary {
  27  |   id: string;
  28  |   status: string;
  29  |   scheduledAt: string;
  30  | }
  31  | 
  32  | interface MailHogAddress {
  33  |   Mailbox: string;
  34  |   Domain: string;
  35  | }
  36  | 
  37  | interface MailHogMessage {
  38  |   ID: string;
  39  |   Created: string;
  40  |   To: MailHogAddress[];
  41  |   Content: { Headers: { Subject?: string[]; To?: string[] } };
  42  |   MIME?: { Parts?: { Body?: string }[] } | null;
  43  | }
  44  | 
  45  | interface MailHogResponse {
  46  |   items?: MailHogMessage[];
  47  | }
  48  | 
  49  | test.describe.configure({ mode: "serial" });
  50  | 
  51  | let patientTokens: SessionTokens | null = null;
  52  | 
  53  | async function requestSession(
  54  |   page: Page,
  55  |   email: string,
  56  | ): Promise<SessionTokens> {
  57  |   let lastStatus = 0;
  58  |   for (let attempt = 0; attempt < 4; attempt += 1) {
  59  |     const response = await page.request.post(`${API_BASE}/auth/login`, {
  60  |       data: { email, password: DEMO_PASSWORD },
  61  |     });
  62  |     lastStatus = response.status();
  63  |     if (response.ok()) {
  64  |       const session = (await response.json()) as {
  65  |         user: { role: "doctor" | "patient" };
  66  |         tokens: SessionTokens;
  67  |       };
  68  |       return session.tokens;
  69  |     }
  70  |     if (lastStatus === 429) {
  71  |       await page.waitForTimeout(15000);
  72  |       continue;
  73  |     }
  74  |     break;
  75  |   }
> 76  |   throw new Error(`Login falhou para ${email} (HTTP ${lastStatus})`);
      |         ^ Error: Login falhou para paciente@digitaly.health (HTTP 429)
  77  | }
  78  | 
  79  | async function openAuthenticated(
  80  |   page: Page,
  81  |   tokens: SessionTokens,
  82  | ): Promise<void> {
  83  |   await page.addInitScript((session) => {
  84  |     window.localStorage.setItem("digitaly.accessToken", session.accessToken);
  85  |     window.localStorage.setItem("digitaly.refreshToken", session.refreshToken);
  86  |   }, tokens);
  87  |   await page.goto("/paciente/agendar");
  88  |   await expect(
  89  |     page.getByRole("heading", { name: /agendar consulta/i }),
  90  |   ).toBeVisible({ timeout: 30000 });
  91  | }
  92  | 
  93  | async function ensurePatientSession(page: Page): Promise<SessionTokens> {
  94  |   if (!patientTokens) {
  95  |     patientTokens = await requestSession(page, PATIENT_EMAIL);
  96  |   }
  97  |   await openAuthenticated(page, patientTokens);
  98  |   return patientTokens;
  99  | }
  100 | 
  101 | function authHeaders(token: string): { Authorization: string } {
  102 |   return { Authorization: `Bearer ${token}` };
  103 | }
  104 | 
  105 | async function listDoctors(
  106 |   page: Page,
  107 |   token: string,
  108 | ): Promise<DoctorSummary[]> {
  109 |   const response = await page.request.get(`${API_BASE}/users/doctors`, {
  110 |     headers: authHeaders(token),
  111 |   });
  112 |   expect(response.ok()).toBeTruthy();
  113 |   return (await response.json()) as DoctorSummary[];
  114 | }
  115 | 
  116 | async function listSlots(
  117 |   page: Page,
  118 |   token: string,
  119 |   doctorId: string,
  120 | ): Promise<SlotSummary[]> {
  121 |   const from = new Date().toISOString();
  122 |   const to = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
  123 |   const response = await page.request.get(
  124 |     `${API_BASE}/appointments/doctors/${doctorId}/slots?from=${encodeURIComponent(
  125 |       from,
  126 |     )}&to=${encodeURIComponent(to)}`,
  127 |     { headers: authHeaders(token) },
  128 |   );
  129 |   expect(response.ok()).toBeTruthy();
  130 |   return (await response.json()) as SlotSummary[];
  131 | }
  132 | 
  133 | async function createAppointment(
  134 |   page: Page,
  135 |   token: string,
  136 |   doctorId: string,
  137 |   startsAt: string,
  138 | ): Promise<AppointmentSummary> {
  139 |   const response = await page.request.post(`${API_BASE}/appointments`, {
  140 |     headers: authHeaders(token),
  141 |     data: { doctorId, scheduledAt: startsAt },
  142 |   });
  143 |   expect(response.ok()).toBeTruthy();
  144 |   return (await response.json()) as AppointmentSummary;
  145 | }
  146 | 
  147 | async function getAppointment(
  148 |   page: Page,
  149 |   token: string,
  150 |   appointmentId: string,
  151 | ): Promise<AppointmentSummary> {
  152 |   const response = await page.request.get(
  153 |     `${API_BASE}/appointments/${appointmentId}`,
  154 |     { headers: authHeaders(token) },
  155 |   );
  156 |   expect(response.ok()).toBeTruthy();
  157 |   return (await response.json()) as AppointmentSummary;
  158 | }
  159 | 
  160 | async function cancelAppointment(
  161 |   page: Page,
  162 |   token: string,
  163 |   appointmentId: string,
  164 | ): Promise<void> {
  165 |   await page.request.post(`${API_BASE}/appointments/${appointmentId}/cancel`, {
  166 |     headers: authHeaders(token),
  167 |     data: {},
  168 |   });
  169 | }
  170 | 
  171 | function pickFutureSlot(slots: SlotSummary[], offset: number): SlotSummary {
  172 |   const minimum = Date.now() + 24 * 60 * 60 * 1000;
  173 |   const future = slots.filter(
  174 |     (slot) => new Date(slot.startsAt).getTime() > minimum,
  175 |   );
  176 |   const slot = future[offset];
```