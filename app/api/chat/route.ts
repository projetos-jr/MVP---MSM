import { SourcesMarkerFilter, resolveSources } from "@/lib/answer";
import { env } from "@/lib/env";
import { getReadableDocs } from "@/lib/knowledge";
import { LLMError, isLLMConfigured, streamAnswer, type LLMMessage } from "@/lib/llm";
import { streamOfflineAnswer } from "@/lib/llm-offline";
import { buildContext } from "@/lib/prompt";
import { selectContext } from "@/lib/retrieval";
import { getUserName } from "@/lib/session";
import type { ChatErrorCode, ChatStreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Mensagens anteriores enviadas junto com a pergunta (acompanhamento). */
const HISTORY_SIZE = 6;
const MAX_MESSAGE_CHARS = 8000;
/** Prazo total da resposta, abaixo do maxDuration, para sempre avisar o usuário. */
const DEADLINE_MS = 52_000;
/** Sinal de vida enquanto a IA pensa (evita conexões ociosas derrubadas no caminho). */
const PING_INTERVAL_MS = 4_000;

const FRIENDLY_ERRORS: Record<ChatErrorCode, string> = {
  rate_limit:
    "O assistente atingiu o limite de uso gratuito da IA neste momento. Aguarde cerca de 1 minuto e tente novamente.",
  auth: "A chave da IA (GEMINI_API_KEY) é inválida ou não tem permissão. Avise o responsável pelo sistema.",
  unavailable: "O serviço de IA está instável no momento. Tente novamente em alguns instantes.",
  timeout:
    "A IA demorou demais para responder. Tente novamente; se continuar, avise o responsável pelo sistema.",
  blocked: "Não consegui gerar uma resposta para essa pergunta. Tente reformular.",
  knowledge: "Não foi possível carregar a base de conhecimento.",
  bad_request: "Não entendi a mensagem enviada. Tente novamente.",
  unknown: "Ocorreu um erro inesperado ao gerar a resposta. Tente novamente.",
};

function parseMessages(raw: unknown): LLMMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const messages: LLMMessage[] = [];
  for (const item of raw) {
    const role = (item as { role?: unknown })?.role;
    const content = (item as { content?: unknown })?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const text = content.trim().slice(0, MAX_MESSAGE_CHARS);
    if (text) messages.push({ role, content: text });
  }
  // Pergunta atual + as últimas 6 mensagens da conversa.
  const recent = messages.slice(-(HISTORY_SIZE + 1));
  // O Gemini exige que a conversa comece com o usuário.
  while (recent.length && recent[0].role !== "user") recent.shift();
  if (!recent.length || recent.at(-1)!.role !== "user") return null;
  return recent;
}

export async function POST(request: Request) {
  let body: { messages?: unknown; checkedAfter?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: FRIENDLY_ERRORS.bad_request }, { status: 400 });
  }

  const messages = parseMessages(body.messages);
  if (!messages) {
    return Response.json({ error: FRIENDLY_ERRORS.bad_request }, { status: 400 });
  }
  const checkedAfter = typeof body.checkedAfter === "number" ? body.checkedAfter : undefined;
  const userName = await getUserName();

  const encoder = new TextEncoder();
  const started = Date.now();
  // Cancela a geração quando o cliente sai (stream cancelado) ou o prazo estoura.
  // Não usamos request.signal: em alguns ambientes ele dispara antes da hora.
  const abort = new AbortController();
  let cancelled = false;
  let deadlineHit = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: ChatStreamEvent) => {
        if (closed || cancelled) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true; // cliente desconectou
        }
      };
      const ping = setInterval(() => send({ type: "ping" }), PING_INTERVAL_MS);
      const deadline = setTimeout(() => {
        deadlineHit = true;
        abort.abort(new Error("deadline"));
      }, DEADLINE_MS);

      try {
        const { docs, error: kbError } = await getReadableDocs({ checkedAfter });
        const kbMs = Date.now() - started;
        if (docs.length === 0 && kbError) {
          send({ type: "error", code: "knowledge", message: `${FRIENDLY_ERRORS.knowledge} ${kbError}` });
          return;
        }

        const offline = !isLLMConfigured();
        send({ type: "meta", offline, documents: docs.length });

        // Consulta para a busca: pergunta atual + pergunta anterior (acompanhamento).
        const userTurns = messages.filter((m) => m.role === "user");
        const query = userTurns.slice(-2).map((m) => m.content).join("\n");
        const selection = selectContext(docs, query, env.maxContextChars);
        const context = buildContext({ docs: selection.docs, userName, selected: selection.selected });
        console.info(
          `[chat] base pronta em ${kbMs} ms: ${docs.length} documento(s), contexto de ${context.length} caracteres`,
        );

        const generator = offline
          ? streamOfflineAnswer(messages, selection.docs)
          : streamAnswer(messages, context, { signal: abort.signal });

        const filter = new SourcesMarkerFilter();
        for await (const chunk of generator) {
          if (cancelled || abort.signal.aborted) break;
          const text = filter.push(chunk);
          if (text) send({ type: "text", text });
        }
        if (cancelled) return;
        if (deadlineHit) throw new LLMError("timeout", "Prazo total da resposta estourado");

        const rest = filter.flush();
        if (rest) send({ type: "text", text: rest });

        send({
          type: "sources",
          sources: resolveSources(filter.answer, filter.citedNumbers, selection.docs),
        });
        send({ type: "done" });
        console.info(`[chat] resposta enviada em ${Date.now() - started} ms`);
      } catch (error) {
        if (cancelled) return;
        const code: ChatErrorCode = deadlineHit
          ? "timeout"
          : error instanceof LLMError
            ? error.code
            : "unknown";
        if (!(error instanceof LLMError) && !deadlineHit) console.error("[chat] Erro inesperado:", error);
        console.warn(`[chat] erro "${code}" após ${Date.now() - started} ms`);
        send({ type: "error", code, message: FRIENDLY_ERRORS[code] });
      } finally {
        clearInterval(ping);
        clearTimeout(deadline);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // já fechado
          }
        }
      }
    },
    cancel() {
      cancelled = true;
      abort.abort(new Error("cancelled"));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
