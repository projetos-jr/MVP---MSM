import "server-only";

import { ApiError, GoogleGenAI, ThinkingLevel, type Content } from "@google/genai";

import { env } from "@/lib/env";
import { SYSTEM_PROMPT } from "@/lib/prompt";

/**
 * Provedor de IA do Assistente MSM.
 *
 * Toda a dependência do modelo fica isolada aqui. Para trocar o Gemini por
 * Claude (ou outro modelo) no produto final, reescreva apenas este arquivo
 * mantendo a mesma interface: `streamAnswer(messages, context)`,
 * `isLLMConfigured()` e `LLMError`.
 */

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export type LLMErrorCode = "rate_limit" | "auth" | "unavailable" | "blocked" | "unknown";

export class LLMError extends Error {
  constructor(
    public readonly code: LLMErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export function isLLMConfigured(): boolean {
  return Boolean(env.geminiApiKey);
}

let client: GoogleGenAI | null = null;
let clientKey = "";

function getClient(): GoogleGenAI {
  const apiKey = env.geminiApiKey;
  const baseUrl = env.geminiBaseUrl;
  if (!client || clientKey !== `${apiKey}|${baseUrl}`) {
    client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        ...(baseUrl ? { baseUrl } : {}),
        // Repete uma vez em caso de instabilidade momentânea (servidor
        // sobrecarregado). Limite de uso (429) não é repetido: vai direto
        // para o modelo reserva.
        retryOptions: { attempts: 2, initialDelay: 0.8, httpStatusCodes: [500, 502, 503, 504] },
      },
    });
    clientKey = `${apiKey}|${baseUrl}`;
  }
  return client;
}

function toLLMError(error: unknown): LLMError {
  if (error instanceof LLMError) return error;
  const status =
    error instanceof ApiError
      ? error.status
      : Number((error as { status?: number })?.status ?? 0);
  const message = error instanceof Error ? error.message : String(error);

  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)) {
    return new LLMError("rate_limit", message);
  }
  if (status === 401 || status === 403 || /API key not valid|PERMISSION_DENIED/i.test(message)) {
    return new LLMError("auth", message);
  }
  if (status === 500 || status === 503 || status === 504 || /UNAVAILABLE|overloaded/i.test(message)) {
    return new LLMError("unavailable", message);
  }
  if (/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(message)) {
    return new LLMError("unavailable", message);
  }
  return new LLMError("unknown", message);
}

const THINKING_LEVELS: Record<string, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/** Raciocínio curto deixa as respostas bem mais rápidas (modelos Gemini 3+). */
function thinkingConfigFor(model: string) {
  const level = THINKING_LEVELS[env.geminiThinkingLevel];
  if (!level || !/^gemini-([3-9]|\d{2,})|^gemini-flash-latest/.test(model)) return undefined;
  return { thinkingLevel: level };
}

/** Converte para o formato do Gemini, juntando turnos seguidos do mesmo papel. */
function toContents(messages: LLMMessage[]): Content[] {
  const contents: Content[] = [];
  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : "user";
    const last = contents.at(-1);
    if (last && last.role === role) {
      last.parts = [{ text: `${last.parts?.[0]?.text ?? ""}\n\n${m.content}` }];
    } else {
      contents.push({ role, parts: [{ text: m.content }] });
    }
  }
  return contents;
}

/**
 * Gera a resposta em streaming (pedaços de texto).
 *
 * @param messages histórico recente da conversa; a última é a pergunta atual.
 * @param context  regras + documentos da base de conhecimento (texto).
 */
export async function* streamAnswer(
  messages: LLMMessage[],
  context: string,
): AsyncGenerator<string> {
  if (!isLLMConfigured()) {
    throw new LLMError("auth", "GEMINI_API_KEY não configurada");
  }
  const ai = getClient();
  const models = [env.geminiModel, env.geminiFallbackModel].filter(
    (m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i,
  );
  const contents = toContents(messages);
  const systemInstruction = `${SYSTEM_PROMPT}\n\n${context}`;

  let lastError: LLMError | null = null;

  for (const [attempt, model] of models.entries()) {
    let yielded = false;
    let thinking = thinkingConfigFor(model);
    try {
      let stream;
      try {
        stream = await ai.models.generateContentStream({
          model,
          contents,
          config: { systemInstruction, temperature: 0.2, thinkingConfig: thinking },
        });
      } catch (error) {
        // Modelo sem suporte ao nível de raciocínio: tenta sem a opção.
        if (thinking && error instanceof ApiError && error.status === 400 && /thinking/i.test(error.message)) {
          thinking = undefined;
          stream = await ai.models.generateContentStream({
            model,
            contents,
            config: { systemInstruction, temperature: 0.2 },
          });
        } else {
          throw error;
        }
      }

      let blockedReason: string | undefined;
      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          yielded = true;
          yield text;
        }
        blockedReason ??= chunk.promptFeedback?.blockReason ?? undefined;
      }
      if (!yielded) {
        throw new LLMError(
          "blocked",
          blockedReason ? `Resposta bloqueada: ${blockedReason}` : "Resposta vazia do modelo",
        );
      }
      if (attempt > 0) console.warn(`[llm] Resposta gerada pelo modelo reserva ${model}.`);
      return;
    } catch (error) {
      lastError = toLLMError(error);
      console.error(`[llm] Erro no modelo ${model}:`, lastError.code, lastError.message);
      const canRetry =
        !yielded &&
        attempt < models.length - 1 &&
        (lastError.code === "rate_limit" || lastError.code === "unavailable" ||
          (lastError.code === "unknown" && /not found|404/i.test(lastError.message)));
      if (!canRetry) throw lastError;
    }
  }
  throw lastError ?? new LLMError("unknown", "Falha desconhecida");
}
