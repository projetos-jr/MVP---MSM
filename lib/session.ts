import "server-only";

import { cookies } from "next/headers";

import { NAME_COOKIE, sanitizeName } from "@/lib/auth";

/** Nome do colaborador informado na entrada (cookie). */
export async function getUserName(): Promise<string> {
  const store = await cookies();
  return sanitizeName(store.get(NAME_COOKIE)?.value ?? "");
}
