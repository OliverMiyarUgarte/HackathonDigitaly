import { redirect } from "next/navigation";

const LEGACY_ROUTES: Record<string, string> = {
  login: "/entrar",
  registro: "/registro",
  "recuperacao-acesso": "/recuperar-senha",
};

export default async function LegacyAuthPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const key = slug?.[0];
  redirect(key && LEGACY_ROUTES[key] ? LEGACY_ROUTES[key] : "/entrar");
}
