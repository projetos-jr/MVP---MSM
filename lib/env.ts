/**
 * Leitura centralizada das variáveis de ambiente (somente servidor).
 * Veja .env.example para a documentação de cada variável.
 */

function str(name: string): string {
  return (process.env[name] ?? "").trim();
}

function int(name: string, fallback: number): number {
  const value = Number.parseInt(str(name), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Aceita tanto o ID puro quanto a URL completa da pasta do Drive. */
export function parseDriveFolderId(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const fromUrl = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (fromUrl) return fromUrl[1];
  const fromQuery = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fromQuery) return fromQuery[1];
  return value;
}

/**
 * A chave privada costuma ser colada com "\n" literais (Vercel, .env),
 * às vezes entre aspas. Normaliza para o formato PEM com quebras reais.
 */
export function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\r/g, "").replace(/\\n/g, "\n");
}

export const env = {
  get appPassword() {
    return str("APP_PASSWORD");
  },
  get geminiApiKey() {
    return str("GEMINI_API_KEY");
  },
  get geminiModel() {
    return str("GEMINI_MODEL") || "gemini-3.8-flash";
  },
  /** Modelo usado se o principal estiver no limite (429) ou indisponível. "none" desativa. */
  get geminiFallbackModel() {
    const value = str("GEMINI_FALLBACK_MODEL");
    if (value.toLowerCase() === "none") return "";
    return value || "gemini-3.5-flash-lite";
  },
  /** Nível de raciocínio dos modelos Gemini 3+: minimal, low, medium, high ou "default". */
  get geminiThinkingLevel() {
    return (str("GEMINI_THINKING_LEVEL") || "low").toLowerCase();
  },
  get driveFolderId() {
    return parseDriveFolderId(str("DRIVE_FOLDER_ID"));
  },
  get serviceAccountEmail() {
    return str("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  },
  get privateKey() {
    return normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY ?? "");
  },
  /** Limite de caracteres de contexto enviados ao modelo por pergunta. */
  get maxContextChars() {
    return int("MAX_CONTEXT_CHARS", 150_000);
  },
  /** Intervalo mínimo entre verificações da pasta do Drive. */
  get refreshIntervalMs() {
    return int("DRIVE_REFRESH_SECONDS", 120) * 1000;
  },
};

export type KnowledgeMode = "drive" | "local";

/** Sem DRIVE_FOLDER_ID, o app lê os arquivos de seed-docs/ (modo de teste). */
export function knowledgeMode(): KnowledgeMode {
  return env.driveFolderId ? "drive" : "local";
}
