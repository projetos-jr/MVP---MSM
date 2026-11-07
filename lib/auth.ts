/**
 * Sessão simples por senha única (APP_PASSWORD).
 *
 * O cookie de sessão é um token assinado com HMAC-SHA256. A chave da
 * assinatura deriva de SESSION_SECRET (se definida) ou da própria senha, então
 * trocar APP_PASSWORD desconecta todo mundo. Usa apenas Web Crypto, para
 * funcionar tanto no middleware (Edge) quanto nas rotas (Node.js).
 */

export const SESSION_COOKIE = "msm_sessao";
export const NAME_COOKIE = "msm_nome";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

function sessionSecret(): string {
  return (
    (process.env.SESSION_SECRET ?? "").trim() ||
    `msm:${(process.env.APP_PASSWORD ?? "").trim()}:assistente`
  );
}

/** Sem APP_PASSWORD, o acesso só é liberado em desenvolvimento. */
export function passwordRequired(): boolean {
  return Boolean((process.env.APP_PASSWORD ?? "").trim());
}

export function accessMisconfigured(): boolean {
  return !passwordRequired() && process.env.NODE_ENV === "production";
}

const encoder = new TextEncoder();

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const issuedAt = Date.now().toString(36);
  return `v1.${issuedAt}.${await hmac(`v1.${issuedAt}`)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [version, issuedAt, signature] = token.split(".");
  if (version !== "v1" || !issuedAt || !signature) return false;
  const issued = Number.parseInt(issuedAt, 36);
  if (!Number.isFinite(issued)) return false;
  if (Date.now() - issued > SESSION_MAX_AGE_SECONDS * 1000) return false;
  return safeEqual(signature, await hmac(`v1.${issuedAt}`));
}

/** Compara a senha digitada com APP_PASSWORD (tempo constante). */
export async function checkPassword(input: string): Promise<boolean> {
  const expected = (process.env.APP_PASSWORD ?? "").trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  // Compara os hashes para não vazar o tamanho da senha.
  const [a, b] = await Promise.all([hmac(`pw:${input.trim()}`), hmac(`pw:${expected}`)]);
  return safeEqual(a, b);
}

export function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
}
