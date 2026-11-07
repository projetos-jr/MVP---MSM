import "server-only";

import { ApiError, GoogleGenAI, ThinkingLevel, type Content } from "@google/genai";

import { env } from "@/lib/env";
import { SYSTEM_PROMPT } from "@/lib/prompt";

/**
 * Provedor de IA do Assistente MSM.
 *
 * Toda a dependência do modelo fica isolada aqui. Para trocar o Gemini por
 * Claude (ou outro modelo) no produto final, reescreva apenas este arquivo
 * mantendo a mesma interface: `streamAnswer(messages, context, options)`,
 * `isLLMConfigured()`, `diagnoseLLM()` e `LLMError`.
 */

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export type LLMErrorCode = "rate_limit" | "auth" | "unavailable" | "timeout" | "blocked" | "unknown";

export class LLMError extends Error {
  constructor(
    public readonly code: LLMErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export interface StreamOptions {
  /** Cancela a geração (cliente saiu ou prazo total estourou). */
  signal?: AbortSignal;
}

export function isLLMConfigured(): boolean {
  return Boolean(env.geminiApiKey);
}

/** Modelos na ordem de tentativa: principal e reserva. */
export function llmModels(): string[] {
  return [env.geminiModel, env.geminiFallbackModel].filter(
    (m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i,
  );
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
  if (/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket/i.test(message)) {
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

/** Junta o cancelamento externo com o prazo desta tentativa. */
function linkedController(external?: AbortSignal): AbortController {
  const controller = new AbortController();
  if (external) {
    if (external.aborted) controller.abort(external.reason);
    else external.addEventListener("abort", () => controller.abort(external.reason), { once: true });
  }
  return controller;
}

class FirstChunkTimeout extends Error {}

/**
 * Faz uma tentativa com um modelo. Se o primeiro trecho de texto não chegar
 * em GEMINI_FIRST_TOKEN_SECONDS, cancela e lança LLMError("timeout").
 */
async function* streamFromModel(
  model: string,
  contents: Content[],
  systemInstruction: string,
  options: StreamOptions,
): AsyncGenerator<string> {
  const ai = getClient();
  const controller = linkedController(options.signal);
  const firstChunkMs = env.geminiFirstTokenSeconds * 1000;
  const timer = setTimeout(() => controller.abort(new FirstChunkTimeout()), firstChunkMs);
  let yielded = false;

  const request = (withThinking: boolean) =>
    ai.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction,
        thinkingConfig: withThinking ? thinkingConfigFor(model) : undefined,
        abortSignal: controller.signal,
      },
    });

  try {
    let stream;
    try {
      stream = await request(true);
    } catch (error) {
      // Modelo sem suporte ao nível de raciocínio escolhido: tenta sem a opção.
      if (error instanceof ApiError && error.status === 400 && /thinking/i.test(error.message)) {
        stream = await request(false);
      } else {
        throw error;
      }
    }

    let blockedReason: string | undefined;
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        if (!yielded) clearTimeout(timer);
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
  } catch (error) {
    if (controller.signal.aborted && controller.signal.reason instanceof FirstChunkTimeout) {
      throw new LLMError(
        "timeout",
        `O modelo ${model} não começou a responder em ${env.geminiFirstTokenSeconds} s`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (!controller.signal.aborted) controller.abort();
  }
}

/**
 * Gera a resposta em streaming (pedaços de texto).
 *
 * @param messages histórico recente da conversa; a última é a pergunta atual.
 * @param context  regras + documentos da base de conhecimento (texto).
 * @param options  cancelamento externo.
 */
export async function* streamAnswer(
  messages: LLMMessage[],
  context: string,
  options: StreamOptions = {},
): AsyncGenerator<string> {
  if (!isLLMConfigured()) {
    throw new LLMError("auth", "GEMINI_API_KEY não configurada");
  }
  const models = llmModels();
  const contents = toContents(messages);
  const systemInstruction = `${SYSTEM_PROMPT}\n\n${context}`;
  let lastError: LLMError | null = null;

  for (const [attempt, model] of models.entries()) {
    let yielded = false;
    const started = Date.now();
    try {
      for await (const text of streamFromModel(model, contents, systemInstruction, options)) {
        if (!yielded) {
          console.info(`[llm] ${model}: primeiro trecho em ${Date.now() - started} ms`);
        }
        yielded = true;
        yield text;
      }
      console.info(`[llm] ${model}: resposta completa em ${Date.now() - started} ms`);
      if (attempt > 0) console.warn(`[llm] Resposta gerada pelo modelo reserva ${model}.`);
      return;
    } catch (error) {
      if (options.signal?.aborted) throw error; // cancelado por fora: não tenta de novo
      lastError = toLLMError(error);
      console.error(
        `[llm] Erro no modelo ${model} após ${Date.now() - started} ms:`,
        lastError.code,
        lastError.message,
      );
      const canRetry =
        !yielded &&
        attempt < models.length - 1 &&
        (lastError.code === "rate_limit" ||
          lastError.code === "unavailable" ||
          lastError.code === "timeout" ||
          (lastError.code === "unknown" && /not found|404|not supported/i.test(lastError.message)));
      if (!canRetry) throw lastError;
    }
  }
  throw lastError ?? new LLMError("unknown", "Falha desconhecida");
}

export interface ModelDiagnosis {
  model: string;
  ok: boolean;
  firstChunkMs: number | null;
  totalMs: number;
  reply?: string;
  errorCode?: LLMErrorCode;
  error?: string;
}

/** Testa cada modelo com uma pergunta curtíssima (usado em /api/diagnostico). */
export async function diagnoseLLM(): Promise<ModelDiagnosis[]> {
  const results: ModelDiagnosis[] = [];
  const contents = toContents([{ role: "user", content: "Responda apenas com a palavra OK." }]);
  for (const model of llmModels()) {
    const started = Date.now();
    let firstChunkMs: number | null = null;
    let reply = "";
    try {
      for await (const text of streamFromModel(model, contents, "Você é um teste de conexão.", {})) {
        firstChunkMs ??= Date.now() - started;
        reply += text;
      }
      results.push({ model, ok: true, firstChunkMs, totalMs: Date.now() - started, reply: reply.slice(0, 200) });
    } catch (error) {
      const llmError = toLLMError(error);
      results.push({
        model,
        ok: false,
        firstChunkMs,
        totalMs: Date.now() - started,
        errorCode: llmError.code,
        error: llmError.message.slice(0, 500),
      });
    }
  }
  return results;
}
