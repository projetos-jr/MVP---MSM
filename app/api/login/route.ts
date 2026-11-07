import { NextResponse } from "next/server";

import {
  NAME_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  accessMisconfigured,
  checkPassword,
  createSessionToken,
  sanitizeName,
} from "@/lib/auth";

export const runtime = "nodejs";

// Atraso simples contra tentativas repetidas de senha.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: Request) {
  let body: { password?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (accessMisconfigured()) {
    return NextResponse.json(
      { error: "O acesso ainda não foi configurado no servidor (APP_PASSWORD)." },
      { status: 500 },
    );
  }

  const name = sanitizeName(body.name);
  if (!name) {
    return NextResponse.json({ error: "Informe seu nome." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!(await checkPassword(password))) {
    await sleep(600);
    return NextResponse.json({ error: "Senha incorreta. Tente novamente." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, name });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  response.cookies.set(NAME_COOKIE, encodeURIComponent(name), {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS * 12,
  });
  return response;
}
