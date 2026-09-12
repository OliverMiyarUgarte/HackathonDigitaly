import { expect, test } from "@playwright/test";

test("login exibe a marca Digitaly e valida campos vazios", async ({ page }) => {
  await page.goto("/entrar");

  await expect(
    page.getByRole("heading", { name: /entrar no teleatendimento/i }),
  ).toBeVisible();
  await expect(page.locator('img[alt="Digitaly"]:visible')).toHaveCount(1);

  await page.getByRole("button", { name: /entrar na plataforma/i }).click();

  await expect(page.getByText("Informe um e-mail válido")).toBeVisible();
  await expect(page.getByText("Informe a senha")).toBeVisible();
});

test("registro informa que o cadastro de médicos é feito pela Digitaly", async ({
  page,
}) => {
  await page.goto("/registro");

  await expect(
    page.getByRole("heading", { name: /criar conta de paciente/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/acesso de médicos é liberado pela equipe Digitaly/i),
  ).toBeVisible();
});

test("recuperação de senha descreve os próximos passos sem simular fluxo", async ({
  page,
}) => {
  await page.goto("/recuperar-senha");

  await expect(
    page.getByRole("heading", { name: /recuperar acesso/i }),
  ).toBeVisible();
  await expect(page.getByText(/ainda não está disponível/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /voltar para o login/i }),
  ).toBeVisible();
});

test("rota legada de autenticação redireciona para /entrar", async ({
  page,
}) => {
  await page.goto("/auth/login");
  await expect(page).toHaveURL(/\/entrar$/);
});
